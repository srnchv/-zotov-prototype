<script setup lang="ts">
// Карточка сущности: единый шаблон, различия — данными типа.
// Слева: поля (Сущность → Название → Тип → Подтип → Дата → специфичные → Описание), блок «Главная страница», связи.
// Справа: медиа по этажам (фото с обложкой и кадром, видео/аудио с субтитрами, 3D-тур, документы), служебное, статистика и журнал.
import { ref, reactive, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { S, SITE, api, load, loadAudit, toast, canEdit, dictValues, subOptions, uploadFile, homeCheck, collHighlights } from "../lib/store";
import { TYPES, TYPEKEY, SUBKEY, TYPELABEL, SUBLABEL, DATEKEY, DATELABEL, SPECIFIC, PAYLOAD_KEYS, SRCKIND, isRecord, ACCESS, ACTL, REL_ORDER, REL_HEAD, MEDIA_FLOORS, HOME_TYPES, HOME_KEY, kindOf, fmtAt, fmtSize, type Entity } from "../lib/model";
import Picker from "../components/Picker.vue";
import Modal from "../components/Modal.vue";
import CollItems from "../components/CollItems.vue";
import CropModal from "../components/CropModal.vue";
import TourModal from "../components/TourModal.vue";
import GeoPick from "../components/GeoPick.vue";
import { JOB, jobText } from "../lib/tourJob";

const props = defineProps<{ id: string }>();
const router = useRouter();
const o = computed(() => S.db[props.id]);
const f = reactive<Record<string, any>>({});
const home = reactive({ on: false, featured: false, items: null as null | Record<string, any> });
function fill() {
  const e = o.value; if (!e) return;
  f.title = e.title; PAYLOAD_KEYS.forEach((k) => (f[k] = e[k] ?? ""));
  home.on = !!e[HOME_KEY(e.type)]; home.featured = !!e.featured;
}
watch(o, fill, { immediate: true });
onMounted(() => loadAudit());

const tk = computed(() => TYPEKEY[o.value?.type] || "subtype"), sk = computed(() => SUBKEY[o.value?.type] || "subtype"), dk = computed(() => DATEKEY[o.value?.type] || "date");
const rec = computed(() => isRecord(o.value));
const typeVals = computed(() => [...new Set([...dictValues(tk.value), ...(f[tk.value] ? [f[tk.value]] : [])])]);
const subVals = computed(() => [...new Set([...subOptions(tk.value, f[tk.value]), ...(f[sk.value] ? [f[sk.value]] : [])])]);
const byType = computed(() => { const m: Record<string, Entity[]> = {}; (o.value?.links || []).forEach((id) => { const x = S.db[id]; if (x) (m[x.type] ||= []).push(x); }); return m; });
const files = computed(() => (o.value?.links || []).map((id) => S.db[id]).filter((x) => x && x.type === "media"));
const isCover = (m: Entity) => (o.value.cover ? o.value.cover === m.id : !!m.thumb && o.value.img === m.thumb);
const sum = computed(() => S.audit?.summary?.[props.id]);
const hist = computed(() => (S.audit?.recent || []).filter((a) => a.entity_id === props.id).slice(0, 5));
const picker = ref<null | "link" | "media" | "tag">(null);
const crop = ref<Entity | null>(null), tour = ref(false), uplStatus = ref("");
const fileInput = ref<HTMLInputElement>(), subsInput = ref<HTMLInputElement>();
const subsFor = ref("");

async function save() {
  const e = o.value;
  const draft: any = { id: e.id, [HOME_KEY(e.type)]: home.on };
  if (e.type === "project") draft.featured = home.featured;
  if (e.type === "collection" && home.items) draft.items = home.items;
  const chk = HOME_TYPES.includes(e.type) ? homeCheck(draft) : { errors: [], warnings: [] };
  if (chk.errors.length) { toast(chk.errors[0]); return; }
  const payload: Record<string, any> = {};
  PAYLOAD_KEYS.forEach((k) => (payload[k] = Array.isArray(f[k]) ? f[k] : (f[k] ?? "")));
  if (HOME_TYPES.includes(e.type)) Object.assign(payload, draft, { id: undefined });
  delete payload.id;
  try {
    await api("/entities/" + e.id, { method: "PATCH", body: JSON.stringify({ title: f.title, payload }) });
    await load(); loadAudit(true); toast(chk.warnings[0] || "Сохранено — объект обновлён во всех разделах");
  } catch (err: any) { toast("Ошибка: " + err.message); }
}
async function patch(p: Record<string, unknown>) {
  try { await api("/entities/" + props.id, { method: "PATCH", body: JSON.stringify(p) }); await load(); toast("Сохранено"); } catch (e: any) { toast("Ошибка: " + e.message); }
}
async function del(id = props.id) {
  const isFile = S.db[id]?.type === "media";
  if (!confirm(isFile ? "Удалить файл из архива? Файл пропадёт из всех карточек." : "Удалить сущность и все её связи?")) return;
  try { await api("/entities/" + id, { method: "DELETE" }); await load(); toast("Удалено"); if (!isFile) router.push("/entities"); } catch (e: any) { toast("Ошибка: " + e.message); }
}
async function link(x: Entity) {
  if ((o.value.links || []).includes(x.id)) { toast("Уже связано"); return; }
  try {
    await api(`/entities/${props.id}/links`, { method: "POST", body: JSON.stringify({ targetId: x.id }) });
    // событие + место: город события подставляется из места (если ещё не задан) — для фильтра «Город» в хронографе
    if (o.value.type === "event" && x.type === "place" && !String(o.value.city || "").trim() && String(x.city || "").trim()) { await api(`/entities/${props.id}`, { method: "PATCH", body: JSON.stringify({ payload: { city: x.city } }) }); f.city = String(x.city); }
    await load(); toast(x.type === "media" ? "Файл прикреплён" : "Связь добавлена — у обеих сущностей");
  } catch (e: any) { toast("Ошибка: " + e.message); }
}
async function unlink(tid: string) {
  try { await api(`/entities/${props.id}/links/${tid}`, { method: "DELETE" }); await load(); toast("Связь удалена — у обеих сущностей"); } catch (e: any) { toast("Ошибка: " + e.message); }
}
const newTag = ref("");
async function createTag() {
  const name = newTag.value.trim().replace(/^#/, ""); if (!name) return;
  try {
    let tag = S.raw.find((t) => t.type === "tag" && t.title.toLowerCase() === name.toLowerCase());
    if (!tag) tag = await api("/entities", { method: "POST", body: JSON.stringify({ type: "tag", title: name }) });
    await link(tag!); newTag.value = ""; picker.value = null;
  } catch (e: any) { toast("Ошибка: " + e.message); }
}
const uploadKind = (accept: string) => { if (fileInput.value) { fileInput.value.accept = accept; fileInput.value.click(); } };
async function onFile() {
  const file = fileInput.value?.files?.[0]; if (!file) return;
  uplStatus.value = "Загрузка…";
  try { await uploadFile(file, props.id); await load(); toast("Файл загружен"); } catch (e: any) { toast("Ошибка: " + e.message); }
  uplStatus.value = ""; if (fileInput.value) fileInput.value.value = "";
}
const setCover = (m: Entity) => patch({ payload: { cover: m.id, img: m.thumb || "", imgBig: m.med || m.thumb || "", imgPos: m.focus || "50% 50%" } });
// поля подписи файла сохраняются сразу при уходе из поля
async function patchMedia(mid: string, payload: Record<string, string>) { try { await api("/entities/" + mid, { method: "PATCH", body: JSON.stringify({ payload }) }); await load(); toast("Сохранено"); } catch (e: any) { toast("Ошибка: " + e.message); } }
// многозначные поля (функции, авторы, заказчики): массив строк из справочника
function toggleMulti(k: string, v: string) { const cur: string[] = Array.isArray(f[k]) ? [...f[k]] : []; const i = cur.indexOf(v); if (i < 0) cur.push(v); else cur.splice(i, 1); f[k] = cur as any; }
const subsUpload = (mid: string) => { subsFor.value = mid; subsInput.value?.click(); };
async function onSubs() {
  const file = subsInput.value?.files?.[0]; if (!file) return;
  const lang = (prompt("Язык субтитров (код: ru, en…):", "ru") || "ru").trim();
  try { const fd = new FormData(); fd.append("file", file); fd.append("lang", lang); await api(`/media/${subsFor.value}/subtitles`, { method: "POST", body: fd }); await load(); toast("Субтитры загружены"); }
  catch (e: any) { toast("Ошибка: " + e.message); }
  if (subsInput.value) subsInput.value.value = "";
}
async function subsRm(mid: string, lang: string) {
  if (!confirm("Убрать субтитры?")) return;
  try { await api(`/media/${mid}/subtitles/${lang}`, { method: "DELETE" }); await load(); toast("Убрано"); } catch (e: any) { toast("Ошибка: " + e.message); }
}
const pool = computed(() => {
  const cur = new Set(o.value?.links || []);
  if (picker.value === "media") return S.raw.filter((x) => x.type === "media" && !cur.has(x.id));
  if (picker.value === "tag") return S.raw.filter((x) => x.type === "tag" && !cur.has(x.id));
  return S.raw.filter((x) => x.id !== props.id && !cur.has(x.id) && !["media", "dict", "tag"].includes(x.type));
});
const bg = (m: Entity) => (m.thumb ? { backgroundImage: `url('${m.thumb}')` } : {});
const HOME_HINT: Record<string, string> = { theme: "На главной 5–9 тем.", project: "На главной 2–3 проекта.", collection: "На главной не больше 2 коллекций, в галерее хайлайтов 2–5 материалов.", event: "Отмеченные события попадают в ленту хронографа на главной.", person: "Из отмеченных личностей случайно собирается фигура на главной." };
</script>
<template>
  <div v-if="!o" class="muted">{{ S.loaded ? "Не найдено" : "Загружаем…" }}</div>
  <template v-else>
    <div class="crumbs"><router-link to="/entities">Сущности</router-link> / Карточка сущности</div>
    <div class="kicker" style="margin-top:6px">Карточка сущности / {{ TYPES[o.type]?.l || o.type }}<template v-if="rec"> · {{ SRCKIND.record }}</template></div>
    <h1 style="font-size:26px;margin-top:2px;letter-spacing:2px">{{ o.title }}</h1>
    <div class="two">
      <div>
        <h3 style="margin-top:0">Карточка</h3>
        <div class="field"><label>Сущность</label><input class="inp" :value="TYPES[o.type]?.l || o.type" disabled title="Задаётся при создании"></div>
        <div v-if="o.type === 'source'" class="field"><label>Что это</label>
          <div class="chips"><span v-for="(l, v) in SRCKIND" :key="v" class="fchip" :class="{ on: (o.srcKind || 'text') === v }" @click="patch({ payload: { srcKind: v } })">{{ l }}</span></div>
          <div class="muted" style="font-size:12px;margin-top:4px">Запись — короткая карточка без описания и файлов: только выходные данные.</div></div>
        <div class="field"><label>Название</label><input class="inp" v-model="f.title"></div>
        <div class="field" v-if="o.type === 'theme'"><label>Тип</label><input class="inp" v-model="f[tk]"></div>
        <div class="field" v-else><label>{{ TYPELABEL[o.type] || "Тип" }}</label>
          <select class="sel" v-model="f[tk]" @change="f[sk] = ''"><option value="">— не задано —</option><option v-for="v in typeVals" :key="v" :value="v">{{ v }}</option></select></div>
        <div class="field" v-if="!rec && o.type !== 'theme'"><label>{{ SUBLABEL[o.type] || "Подтип" }} <span class="muted">— из справочника, по выбранному типу</span></label>
          <select class="sel" v-model="f[sk]"><option value="">— не задано —</option><option v-for="v in subVals" :key="v" :value="v">{{ v }}</option></select></div>
        <div class="field"><label>{{ DATELABEL[o.type] || "Дата / период" }}</label><input class="inp" v-model="f[dk]"></div>
        <div class="field" v-for="[k, l, ph] in SPECIFIC[o.type] || []" :key="k"><label>{{ l }}</label>
          <select v-if="ph && ph.startsWith('select:')" class="sel" v-model="f[k]"><option value="">—</option><option v-for="v in ph.slice(7).split('|')" :key="v" :value="v">{{ v }}</option></select>
          <template v-else-if="ph && ph.startsWith('dict:')"><input class="inp" v-model="f[k]" :list="'dl-' + k" placeholder="из справочника или новый"><datalist :id="'dl-' + k"><option v-for="v in dictValues(ph.slice(5))" :key="v" :value="v"></option></datalist></template>
          <select v-else-if="ph && ph.startsWith('dictsel:')" class="sel" v-model="f[k]"><option value="">—</option><option v-for="v in dictValues(ph.slice(8))" :key="v" :value="v">{{ v }}</option></select>
          <template v-else-if="ph && ph.startsWith('multi:')">
            <div class="muted" style="font-size:12px;margin-bottom:4px">Несколько значений — из справочника «{{ ph.slice(6) === 'func' ? 'Функции' : ph.slice(6) === 'author' ? 'Авторы' : 'Заказчики' }}» (клик отмечает)</div>
            <template v-if="dictValues('sub:' + ph.slice(6)).length"><div v-for="g in dictValues(ph.slice(6))" :key="g" style="margin-bottom:6px"><div class="kicker">{{ g }}</div>
              <div class="chips" style="margin-top:4px"><span v-for="v in dictValues('sub:' + ph.slice(6)).filter(x => x.startsWith(g + ' › '))" :key="v" class="fchip" :class="{ on: (f[k] || []).includes(v) }" @click="toggleMulti(k, v)">{{ v.slice(g.length + 3) }}</span></div></div></template>
            <div v-else class="chips"><span v-for="v in dictValues(ph.slice(6))" :key="v" class="fchip" :class="{ on: (f[k] || []).includes(v) }" @click="toggleMulti(k, v)">{{ v }}</span></div>
            <div v-if="!dictValues(ph.slice(6)).length" class="muted" style="font-size:12px">Справочник пуст — заполните его в разделе «Справочники».</div>
          </template>
          <input v-else class="inp" v-model="f[k]" :placeholder="ph || ''"></div>
        <template v-if="o.type === 'place'">
          <div style="display:flex;gap:12px"><div class="field" style="flex:1"><label>Широта</label><input class="inp" v-model="f.lat" placeholder="55.7558"></div><div class="field" style="flex:1"><label>Долгота</label><input class="inp" v-model="f.lon" placeholder="37.6176"></div></div>
          <GeoPick :lat="f.lat" :lon="f.lon" :address="[f.city, f.address].filter(Boolean).join(', ')" @update="(a, b) => { f.lat = a; f.lon = b; }" />
          <div class="muted" style="font-size:12px;margin-top:-6px">Координаты сохраняются кнопкой «Сохранить» вместе с остальными полями. Место без координат на карту не попадает.</div>
        </template>
        <div class="field" v-if="!rec"><label>Описание</label><textarea class="inp" v-model="f.desc" placeholder="Редакторское описание с научным аппаратом…"></textarea></div>

        <template v-if="HOME_TYPES.includes(o.type)">
          <h3>Главная страница</h3>
          <label class="check"><input type="checkbox" v-model="home.on"> Показывать на главной</label>
          <label v-if="o.type === 'project'" class="check"><input type="checkbox" v-model="home.featured"> Фичер — большая карточка (при трёх проектах на главной фичер должен быть ровно один)</label>
          <CollItems v-if="o.type === 'collection'" :coll="o" @change="home.items = $event" />
          <div class="muted" style="font-size:12px">{{ HOME_HINT[o.type] }}<template v-if="o.type === 'collection'"> Сейчас хайлайтов: {{ collHighlights(o).length }}.</template></div>
        </template>

        <h3>Связи <span class="muted" style="font-size:13px;font-weight:400;letter-spacing:0;text-transform:none">— двусторонние: появятся на карточках обеих сущностей</span></h3>
        <div v-for="t in REL_ORDER.filter(t => t !== 'tag' && byType[t]?.length)" :key="t" style="margin-bottom:12px">
          <div class="kicker" style="margin-bottom:6px">{{ REL_HEAD[t] }}</div>
          <div class="chips"><span v-for="x in byType[t]" :key="x.id" class="chip"><router-link :to="'/edit/' + x.id">{{ x.title }}</router-link><span v-if="canEdit" class="x" @click="unlink(x.id)">✕</span></span></div>
        </div>
        <div v-if="!Object.keys(byType).filter(t => t !== 'tag').length" class="muted">Связей пока нет.</div>
        <div v-if="canEdit" style="margin-top:6px"><span class="chip add" @click="picker = 'link'">＋ добавить связь</span></div>

        <div v-if="canEdit" style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap">
          <button class="btn dark" @click="save">Сохранить</button>
          <router-link class="btn" to="/entities">Назад</router-link>
          <button class="btn danger" style="margin-left:auto" @click="del()">Удалить</button>
        </div>
      </div>

      <div>
        <template v-if="!rec">
          <h3 style="margin-top:0">Медиа</h3>
          <div class="media" :style="o.type === 'media' ? bg(o) : (o.imgBig || o.img ? { backgroundImage: `url('${o.imgBig || o.img}')`, backgroundPosition: o.imgPos || 'center' } : {})"></div>
          <input type="file" ref="fileInput" style="display:none" @change="onFile"><input type="file" ref="subsInput" accept=".vtt,.srt,text/vtt" style="display:none" @change="onSubs">
          <span class="muted" style="font-size:12px">{{ uplStatus }}</span>
          <div v-for="[k, l, accept] in MEDIA_FLOORS" :key="k" style="margin-top:14px">
            <div class="kicker" style="display:flex;justify-content:space-between">{{ l }} <span class="muted">{{ files.filter(m => kindOf(m) === k).length || "" }}</span></div>
            <div v-for="m in files.filter(m => kindOf(m) === k)" :key="m.id">
              <div style="display:flex;align-items:center;gap:10px;margin-top:8px;font-size:13px">
                <span class="thumbmini" :style="bg(m)"></span>
                <span style="min-width:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1"><router-link :to="'/edit/' + m.id">{{ m.title }}</router-link><br><span class="muted" style="font-size:11px">{{ k === 'tour' ? (m.uploading ? (JOB.cur && JOB.cur.id === m.id ? jobText(JOB.cur) : 'загрузка не завершена — «＋ Код эмбеда» → «Папка тура» → докачать') : String(m.embed || '').replace(/^https?:\/\//, '').slice(0, 60) + (m.files ? ' · ' + m.files + ' файлов · ' + fmtSize(m.size) : '')) : (m.format || '') + ' · ' + fmtSize(m.size) }}</span></span>
                <template v-if="k === 'image' && canEdit">
                  <span class="lnk" style="font-size:12px;white-space:nowrap" title="Какая область фото попадёт в карточки" @click="crop = m">Кадр</span>
                  <span v-if="isCover(m)" class="statbadge" title="Показывается в карточках и на странице">Обложка</span>
                  <span v-else class="lnk" style="font-size:12px;white-space:nowrap" @click="setCover(m)">Сделать обложкой</span>
                </template>
                <span v-if="canEdit" class="lnk" style="color:#9a2e2e" @click="del(m.id)">✕</span>
              </div>
              <!-- подпись к файлу на сайте: название, автор, год (необязательно; без названия подписывается названием материала) -->
              <div v-if="k !== 'tour' && k !== 'doc'" style="margin:6px 0 0 44px;display:flex;gap:6px;flex-wrap:wrap">
                <input class="inp" style="flex:3 1 200px;font-size:12px;padding:5px 8px" placeholder="Название (подпись на сайте)" :value="m.caption || ''" :disabled="!canEdit" @change="patchMedia(m.id, { caption: ($event.target as HTMLInputElement).value.trim() })">
                <input class="inp" style="flex:2 1 140px;font-size:12px;padding:5px 8px" placeholder="Автор" :value="m.author || ''" :disabled="!canEdit" @change="patchMedia(m.id, { author: ($event.target as HTMLInputElement).value.trim() })">
                <input class="inp" style="flex:0 1 80px;font-size:12px;padding:5px 8px" placeholder="Год" :value="m.year || ''" :disabled="!canEdit" @change="patchMedia(m.id, { year: ($event.target as HTMLInputElement).value.trim() })">
              </div>
              <div v-if="(k === 'video' || k === 'audio')" style="margin:4px 0 0 44px;font-size:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <span class="muted">Субтитры:</span>
                <span v-for="t in (m.subtitles || [])" :key="t.lang" class="chip" style="font-size:12px;padding:4px 8px">{{ t.label || t.lang }}<span v-if="canEdit" class="x" @click="subsRm(m.id, t.lang)">✕</span></span>
                <span v-if="canEdit" class="lnk" @click="subsUpload(m.id)">＋ .vtt / .srt</span>
              </div>
            </div>
            <div v-if="canEdit" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <template v-if="k === 'tour'"><button class="btn sm" @click="tour = true">{{ JOB.cur && JOB.cur.parentId === o.id ? (JOB.cur.running ? 'Идёт загрузка…' : 'Загрузка остановлена') : '＋ Код эмбеда' }}</button><span class="muted" style="font-size:12px">Matterport, Kuula, 3DVista — тур встанет в галерею рядом с фото и видео</span></template>
              <template v-else><button class="btn sm" @click="uploadKind(accept)">＋ Загрузить</button><button v-if="o.type !== 'media'" class="btn sm" @click="picker = 'media'">＋ из медиатеки</button></template>
            </div>
          </div>
        </template>
        <h3 :style="rec ? 'margin-top:0' : ''">Служебная информация</h3>
        <div class="metabox">
          <div class="r"><span class="k">ID</span><span class="v">{{ o.id }}</span></div>
          <div class="r"><span class="k">Статус</span><span class="v"><select class="sel inline" :value="o.status || 'published'" @change="patch({ status: ($event.target as HTMLSelectElement).value })"><option value="published">Опубликовано</option><option value="draft">Черновик</option><option value="moderation">На модерации</option></select></span></div>
          <div class="r"><span class="k">Уровень доступа</span><span class="v"><select class="sel inline" :disabled="!canEdit" :value="o.access || 'open'" @change="patch({ payload: { access: ($event.target as HTMLSelectElement).value } })"><option v-for="(l, v) in ACCESS" :key="v" :value="v">{{ l }}</option></select></span></div>
          <div class="r" style="align-items:flex-start"><span class="k">Теги</span><span class="v"><span class="chips" style="justify-content:flex-end;margin:0">
            <span v-for="x in (byType.tag || [])" :key="x.id" class="chip" style="font-size:12px;padding:4px 8px">#{{ x.title }}<span v-if="canEdit" class="x" @click="unlink(x.id)">✕</span></span>
            <span v-if="canEdit" class="chip add" style="font-size:12px;padding:4px 8px" @click="picker = 'tag'">＋ тег</span></span></span></div>
        </div>
        <div class="muted" style="font-size:11px;margin-top:6px">Теги служебные: помогают поиску, на сайте не выводятся.</div>
        <h3>Статистика карточки</h3>
        <div class="metabox">
          <div class="r"><span class="k">Просмотры</span><span class="v">{{ o.views || 0 }}</span></div>
          <div class="r"><span class="k">Создание</span><span class="v">{{ fmtAt(o.created_at) || "—" }}</span></div>
          <div class="r"><span class="k">Последнее изменение</span><span class="v">{{ sum ? fmtAt(sum.lastAt) + " · " + sum.lastActor : "—" }}</span></div>
          <div class="r"><span class="k">Всего правок</span><span class="v">{{ sum?.edits || 0 }}</span></div>
        </div>
        <template v-if="hist.length"><div class="kicker" style="margin-top:14px">Журнал</div>
          <div class="metabox" style="margin-top:6px"><div v-for="(a, i) in hist" :key="i" class="r"><span class="k">{{ ACTL[a.action] || a.action }} · {{ a.actor }}</span><span class="v" style="font-size:12px">{{ fmtAt(a.at) }}</span></div></div></template>
        <a v-if="o.type !== 'media'" class="btn sm" :href="SITE + '/m/' + o.id" target="_blank" style="margin-top:16px;display:inline-block">Открыть на сайте</a>
      </div>
    </div>

    <Picker v-if="picker === 'link'" title="Добавить связь" :items="pool" typed @pick="link($event); picker = null" @close="picker = null" />
    <Picker v-if="picker === 'media'" title="Файл из медиатеки" :items="pool" :sub="(m) => String(m.format || kindOf(m))" @pick="link($event); picker = null" @close="picker = null" />
    <Modal v-if="picker === 'tag'" title="Добавить тег" @close="picker = null">
      <div class="muted" style="font-size:12px;margin:8px 0 4px">Теги служебные: помогают поиску, на сайте не выводятся.</div>
      <input class="secsearch" placeholder="Найти тег или ввести новый…" v-model="newTag" @keydown.enter="createTag">
      <div class="fmodal-list" style="columns:2 200px">
        <span v-for="t in pool.filter(t => !newTag || t.title.toLowerCase().includes(newTag.toLowerCase()))" :key="t.id" class="fopt" @click="link(t); picker = null">#{{ t.title }}</span>
      </div>
      <div class="right"><button v-if="newTag.trim()" class="btn" @click="createTag">＋ Создать тег «{{ newTag.trim() }}»</button><button class="btn dark" @click="picker = null">Готово</button></div>
    </Modal>
    <CropModal v-if="crop" :media="crop" :parentId="o.id" @close="crop = null" />
    <TourModal v-if="tour" :parentId="o.id" @close="tour = false" />
  </template>
</template>
