<script setup lang="ts">
import { ask, askInput } from "../lib/dialog";
// Медиафайл: не карточка сайта, а файл из медиатеки — показывается внутри карточек, к которым прикреплён.
// Здесь: превью, сведения о файле, подпись для сайта, кадр (для фото), статус адаптивного видео, список карточек-владельцев.
import { ref, reactive, computed, watch, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { S, api, load, toast, canEdit, all } from "../lib/store";
import { TYPES, fmtAt, fmtSize, kindOf, type Entity } from "../lib/model";
import Picker from "../components/Picker.vue";
import CropModal, { type Frames } from "../components/CropModal.vue";
const props = defineProps<{ id: string }>();
const router = useRouter();
const o = computed(() => S.db[props.id]);
const kind = computed(() => (o.value ? kindOf(o.value) : ""));
const KIND_L: Record<string, string> = { image: "Фото", video: "Видео", audio: "Аудио", pdf: "Документ (PDF)", doc: "Документ", tour: "3D-тур", file: "Файл" };
const f = reactive<Record<string, string>>({ title: "", caption: "", author: "", year: "" });
watch(o, (v) => { if (v) { f.title = String(v.title || ""); f.caption = String(v.caption || ""); f.author = String(v.author || ""); f.year = String(v.year || ""); } }, { immediate: true });
const parents = computed(() => ((o.value?.links || []) as string[]).map((id) => S.db[id]).filter((x) => x && x.type !== "media" && x.type !== "tag"));
const picker = ref(false), crop = ref(false);
const pool = computed(() => { const cur = new Set((o.value?.links || []) as string[]); return S.raw.filter((x) => x.id !== props.id && !cur.has(x.id) && !["media", "dict", "tag"].includes(x.type)); });
async function save() { try { await api("/entities/" + props.id, { method: "PATCH", body: JSON.stringify({ title: f.title.trim() || o.value.title, payload: { caption: f.caption.trim(), author: f.author.trim(), year: f.year.trim() } }) }); await load(); toast("Сохранено"); } catch (e: any) { toast("Ошибка: " + e.message); } }
async function attach(x: Entity) { try { await api(`/entities/${props.id}/links`, { method: "POST", body: JSON.stringify({ targetId: x.id }) }); await load(); toast("Прикреплён к «" + x.title + "»"); } catch (e: any) { toast("Ошибка: " + e.message); } }
async function detach(x: Entity) { if (!(await ask("Открепить файл", `Открепить файл от «${x.title}»?`, { ok: "Открепить" }))) return; try { await api(`/entities/${props.id}/links/${x.id}`, { method: "DELETE" }); await load(); } catch (e: any) { toast("Ошибка: " + e.message); } }
async function del() { if (!(await ask("Удалить файл", "Он пропадёт из всех карточек.", { ok: "Удалить", danger: true }))) return; try { await api("/entities/" + props.id, { method: "DELETE" }); await load(); router.push("/media"); } catch (e: any) { toast("Ошибка: " + e.message); } }
// превью видео/аудио/PDF — по подписанной ссылке на оригинал (редактору доступны и закрытые)
const srcUrl = ref("");
// ссылка берётся один раз на файл (а не при каждом обновлении данных — иначе плеер перезагружается каждые 5 секунд)
watch(() => props.id, async (id) => { srcUrl.value = ""; if (!o.value || kind.value === "image" || kind.value === "tour") return; try { srcUrl.value = (await api<{ url: string }>("/media/" + id + "/original?ttl=3600")).url; } catch { srcUrl.value = ""; } }, { immediate: true });
// адаптивное видео
const hlsText = (m: Entity) => m.hlsStatus === "done" ? "готово" : m.hlsStatus === "processing" ? `${m.hlsStage || "кодируем"}, ${m.hlsProgress || 0}%` : m.hlsStatus === "queued" ? "в очереди" : m.hlsStatus === "error" ? "ошибка" : "не выполнялось — играет оригинал в одном качестве";
async function transcode() { try { await api("/media/" + props.id + "/transcode", { method: "POST" }); await load(); toast("Поставлено в очередь"); } catch (e: any) { toast("Ошибка: " + e.message); } }
let timer: ReturnType<typeof setInterval> | null = null;
watch(() => ["queued", "processing"].includes(String(o.value?.hlsStatus || "")), (busy) => { if (busy && !timer) timer = setInterval(() => load(), 5000); if (!busy && timer) { clearInterval(timer); timer = null; } }, { immediate: true });
onUnmounted(() => { if (timer) clearInterval(timer); });
async function saveFrame(frames: Frames) {
  const focus = `${frames.d!.x}% ${frames.d!.y}%`;
  try { await api("/entities/" + props.id, { method: "PATCH", body: JSON.stringify({ payload: { focus, frame: frames } }) });
    for (const p of parents.value) if (p.cover === props.id || (!p.cover && p.img === o.value.thumb)) await api("/entities/" + p.id, { method: "PATCH", body: JSON.stringify({ payload: { imgPos: focus, imgFrame: frames } }) });
    await load(); toast("Кадр сохранён"); crop.value = false; } catch (e: any) { toast("Ошибка: " + e.message); }
}
void all;
</script>
<template>
  <div v-if="!o" class="muted">{{ S.loaded ? "Не найдено" : "Загружаем…" }}</div>
  <template v-else>
    <div class="crumbs"><router-link to="/media">Медиатека</router-link> / Медиафайл</div>
    <div class="kicker" style="margin-top:6px">Медиафайл · {{ KIND_L[kind] || kind }}</div>
    <h1 style="font-size:26px;margin-top:2px;letter-spacing:2px;word-break:break-all">{{ o.title }}</h1>
    <div class="admbar" style="margin-top:10px;max-width:760px">Это файл, а не карточка: своей страницы на сайте у него нет, он показывается в галерее тех карточек, к которым прикреплён. Название, автор и год ниже — подпись под файлом на сайте.</div>
    <div class="two" style="margin-top:16px">
      <div>
        <h3 style="margin-top:0">Файл</h3>
        <div class="media" style="aspect-ratio:3/2;max-height:360px" :style="o.med || o.thumb ? { backgroundImage: `url('${o.med || o.thumb}')`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat' } : {}">
          <video v-if="kind === 'video' && srcUrl" :src="srcUrl" controls style="width:100%;height:100%;background:#000" controlsList="nodownload"></video>
          <audio v-else-if="kind === 'audio' && srcUrl" :src="srcUrl" controls style="width:100%;margin-top:40%"></audio>
          <a v-else-if="kind === 'pdf' && srcUrl" :href="srcUrl" target="_blank" class="btn sm" style="margin:16px">Открыть PDF</a>
        </div>
        <div class="metabox" style="margin-top:12px">
          <div class="r"><span class="k">Тип</span><span class="v">{{ KIND_L[kind] || kind }}</span></div>
          <div class="r"><span class="k">Формат · размер</span><span class="v">{{ o.format || o.mime || "—" }} · {{ fmtSize(o.size) || "—" }}</span></div>
          <div v-if="o.width" class="r"><span class="k">Размеры</span><span class="v">{{ o.width }} × {{ o.height }}</span></div>
          <div class="r"><span class="k">Имя файла</span><span class="v" style="word-break:break-all">{{ o.filename || "—" }}</span></div>
          <div class="r"><span class="k">Загружен</span><span class="v">{{ fmtAt(o.created_at) || "—" }}</span></div>
          <div class="r"><span class="k">ID</span><span class="v">{{ o.id }}</span></div>
        </div>
        <template v-if="kind === 'video'">
          <h3>Адаптивное видео</h3>
          <div class="muted" style="font-size:13px">Видео автоматически кодируется в несколько качеств (1080/720/480/360 — не выше исходника), чтобы плеер подбирал качество под скорость интернета и экран. Пока версии не готовы, сайт играет оригинал.</div>
          <div class="metabox" style="margin-top:8px">
            <div class="r"><span class="k">Статус</span><span class="v">{{ hlsText(o) }}</span></div>
            <div v-if="o.hlsStatus === 'processing'" class="r"><span class="k">Прогресс</span><span class="v" style="flex:1"><div class="upbar" style="margin:0"><div class="upfill" :style="{ width: (o.hlsProgress || 0) + '%' }"></div><span>{{ o.hlsProgress || 0 }}%</span></div></span></div>
            <div v-if="o.hlsLevels" class="r"><span class="k">Качества</span><span class="v">{{ (o.hlsLevels || []).map((h: number) => h + 'p').join(', ') }}</span></div>
            <div v-if="o.hlsError" class="r"><span class="k">Ошибка</span><span class="v" style="color:#9a2e2e">{{ o.hlsError }}</span></div>
          </div>
          <button v-if="canEdit && !['queued','processing'].includes(String(o.hlsStatus || ''))" class="btn sm" style="margin-top:8px" @click="transcode">{{ o.hlsStatus === 'done' ? 'Перекодировать заново' : 'Сделать адаптивным' }}</button>
        </template>
      </div>
      <div>
        <h3 style="margin-top:0">Прикреплён к карточкам</h3>
        <div class="muted" style="font-size:13px">Обычно одна карточка; один файл можно показать и в нескольких.</div>
        <div class="chips" style="margin-top:8px">
          <span v-for="p in parents" :key="p.id" class="chip"><router-link :to="'/edit/' + p.id">{{ p.title }}</router-link> <span class="muted" style="font-size:11px">· {{ TYPES[p.type]?.l || p.type }}</span><span v-if="canEdit" class="x" @click="detach(p)">✕</span></span>
          <span v-if="canEdit" class="chip add" @click="picker = true">＋ прикрепить к карточке</span>
        </div>
        <div v-if="!parents.length" style="font-size:12px;margin-top:6px;color:#b8860b">Файл ни к чему не прикреплён — на сайте его не видно.</div>
        <h3>Подпись на сайте</h3>
        <div class="field"><label>Название файла</label><input class="inp" v-model="f.title" :disabled="!canEdit"></div>
        <div class="field"><label>Подпись <span class="muted">— под фото/видео в галерее; пусто — название карточки</span></label><input class="inp" v-model="f.caption" :disabled="!canEdit"></div>
        <div style="display:flex;gap:12px"><div class="field" style="flex:1"><label>Автор</label><input class="inp" v-model="f.author" :disabled="!canEdit"></div><div class="field" style="flex:0 0 120px"><label>Год</label><input class="inp" v-model="f.year" :disabled="!canEdit"></div></div>
        <div v-if="canEdit" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
          <button class="btn dark" @click="save">Сохранить</button>
          <button v-if="kind === 'image'" class="btn" @click="crop = true">Кадр для карточек</button>
          <button class="btn" @click="router.back()">Назад</button>
          <button class="btn" style="margin-left:auto;color:#9a2e2e;border-color:#9a2e2e" @click="del">Удалить файл</button>
        </div>
      </div>
    </div>
    <Picker v-if="picker" title="Прикрепить файл к карточке" :items="pool" typed @pick="attach($event); picker = false" @close="picker = false" />
    <CropModal v-if="crop" :src="o.med || o.big || o.thumb" :frames="o.frame || null" title="Кадр для карточек" @save="saveFrame($event)" @close="crop = false" />
  </template>
</template>
