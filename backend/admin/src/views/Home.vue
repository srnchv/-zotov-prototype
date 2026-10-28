<script setup lang="ts">
// Главная страница: что показывать (одни данные с галочками в карточках), фичер, хайлайты коллекций, тексты, фон, коллажи карты
import { ref, reactive, computed } from "vue";
import { S, all, api, load, toast, canEdit, homeList, homeCheck, collHighlights, siteVal, patchSite, uploadFile, onHome, HOME_KEY } from "../lib/store";
import { TYPES, yearOf, type Entity } from "../lib/model";
import Picker from "../components/Picker.vue";
import CollItems from "../components/CollItems.vue";
const hero = ref(siteVal("heroText")), searchPh = ref(siteVal("searchPh")), searchPhM = ref(siteVal("searchPhM")), mapText = ref(siteVal("mapText")), about = reactive({ aboutText: siteVal("aboutText"), aboutCol1: siteVal("aboutCol1"), aboutCol2: siteVal("aboutCol2"), aboutCol3: siteVal("aboutCol3"), aboutCol4: siteVal("aboutCol4"), aboutEmail: siteVal("aboutEmail") });
const chk = computed(() => homeCheck(undefined, hero.value.length));
const pickType = ref<string | null>(null);
const pool = computed(() => (pickType.value ? all(pickType.value).filter((o) => !onHome(o)) : []));
const LIM: Record<string, string> = { theme: "5–9", project: "2–3", collection: "до 2" };
// год события — для списка хронографа и при выборе
const yr = (o: Entity) => yearOf(o.date) || "";
const homeSorted = (t: string) => (t === "event" ? homeList(t).slice().sort((a, b) => (yearOf(a.date) || 0) - (yearOf(b.date) || 0)) : homeList(t));
const pickSub = (o: Entity) => (o.type === "event" ? String(yr(o) || "без года") : o.type === "project" ? String(o.dates || "") : "");
const items = reactive<Record<string, Record<string, any>>>({});
async function toggle(o: Entity, on: boolean) {
  const c = homeCheck({ id: o.id, [HOME_KEY(o.type)]: on });
  if (c.errors.length) { toast(c.errors[0]); return; }
  try { await api("/entities/" + o.id, { method: "PATCH", body: JSON.stringify({ payload: { [HOME_KEY(o.type)]: on } }) }); await load(); toast(c.warnings[0] || "Сохранено"); } catch (e: any) { toast("Ошибка: " + e.message); }
}
async function feature(id: string) {
  try { for (const p of all("project")) if (p.featured && p.id !== id) await api("/entities/" + p.id, { method: "PATCH", body: JSON.stringify({ payload: { featured: false } }) });
    await api("/entities/" + id, { method: "PATCH", body: JSON.stringify({ payload: { featured: true } }) }); await load(); toast("Фичер выбран"); } catch (e: any) { toast("Ошибка: " + e.message); }
}
const inputs: Record<string, HTMLInputElement | undefined> = {};
async function img(key: string, ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]; if (!file) return;
  try { if (!S.db["site"]) await patchSite({}); const m = await uploadFile(file, "site"); await patchSite({ [key]: m.big || m.med || m.thumb || "" }); toast("Сохранено — обновлено на сайте"); } catch (e: any) { toast("Ошибка: " + e.message); }
  (ev.target as HTMLInputElement).value = "";
}
import CropModal from "../components/CropModal.vue";
const cropKey = ref<string | null>(null);
const siteObj = (k: string) => { const v = S.db.site?.[k]; return v && typeof v === "object" ? v : null; };
// превью кадра фона «Об архиве»: блок на высоту экрана — десктоп 16:9, мобайл 360×640
const ABOUT_PREV = { d: [["Экран «Об архиве», десктоп", 300, 169] as [string, number, number], ["Планшет 768×1024", 192, 256] as [string, number, number]], m: [["Мобайл 360×640", 180, 320] as [string, number, number]] };
const IMGS: [string, string, string, string][] = [["aboutBg", "Фон «Об архиве»", "3/1", "Фотография на весь блок, под затемнением; блок — на высоту экрана"]];
const MAPM: [string, string, string, string] = ["mapM", "Планшет и мобайл — одна иллюстрация", "360/462", "вертикальный коллаж без надписи (в 2x)"];
// вырезки зданий для десктопного коллажа (PNG с прозрачностью, 2x); пусто — стандартная вырезка из макета
const mapImgs = reactive<Record<string, string>>({ ...((S.db["site"] && S.db["site"].mapImgs) || {}) });
const bInputs: Record<string, HTMLInputElement | undefined> = {};
async function bImg(k: string, ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]; if (!file) return;
  try { if (!S.db["site"]) await patchSite({}); const m = await uploadFile(file, "site"); mapImgs[k] = m.big || m.med || ""; await patchSite({ mapImgs: { ...mapImgs } }); toast("Сохранено — обновлено на сайте"); } catch (e: any) { toast("Ошибка: " + e.message); }
  (ev.target as HTMLInputElement).value = "";
}
async function bImgClear(k: string) { delete mapImgs[k]; await patchSite({ mapImgs: { ...mapImgs } }); }
const B_SIZE: Record<string, string> = { b1: "468×770", b2: "454×432", b3: "731×280", b4: "423×454" };
// коллаж карты на десктопе: четыре здания зашиты в вёрстку, здесь — какое место открывается по клику и подписывается на ховере
const BUILDINGS: [string, string][] = [["b1", "Здание 1 — слева, башня с надписью «Моссельпром»"], ["b2", "Здание 2 — в центре, «Хлебозавод № 5 · 1931»"], ["b3", "Здание 3 — справа внизу, широкий фасад дворца культуры"], ["b4", "Здание 4 — справа вверху, круглая башня"]];
const places = computed(() => all("place").slice().sort((a, b) => a.title.localeCompare(b.title, "ru")));
const mapB = reactive<Record<string, string>>({ ...((S.db["site"] && S.db["site"].mapBuildings) || {}) });
// одна кнопка на страницу: тексты, привязка зданий карты и хайлайты всех коллекций сохраняются разом
const saving = ref(false);
async function saveAll() {
  if (hero.value.length > 500) { toast("Подзаголовок длиннее 500 знаков — сократите."); return; }
  for (const c of all("collection")) { const it = items[c.id]; if (!it) continue; const r = homeCheck({ id: c.id, items: it }); if (r.errors.length) { toast(r.errors[0]); return; } }
  saving.value = true;
  try {
    await patchSite({ heroText: hero.value.trim(), searchPh: searchPh.value.trim(), searchPhM: searchPhM.value.trim(), mapText: mapText.value.trim(), mapBuildings: { ...mapB }, ...Object.fromEntries(Object.entries(about).map(([k, v]) => [k, String(v).trim()])) });
    for (const c of all("collection")) { const it = items[c.id]; if (it) await api("/entities/" + c.id, { method: "PATCH", body: JSON.stringify({ payload: { items: it } }) }); }
    await load(); toast("Сохранено — обновлено на сайте");
  } catch (e: any) { toast("Ошибка: " + e.message); } finally { saving.value = false; }
}
const placeLabel = (id: string) => { const p = S.db[id]; return p ? p.title + (p.city ? ", " + p.city : "") : ""; };
</script>
<template>
  <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;position:sticky;top:0;z-index:5;background:#fff;padding:10px 0;margin:-10px 0 0"><h1 style="margin:0">Главная страница</h1>
    <button v-if="canEdit" class="btn dark" :disabled="saving" @click="saveAll">{{ saving ? "Сохраняю…" : "Сохранить" }}</button></div>
  <div class="muted" style="font-size:14px;margin:6px 0 14px;max-width:760px">Тексты, привязка зданий карты и хайлайты коллекций сохраняются кнопкой «Сохранить» вверху; галочки «на главной», фичер, загрузка картинок и кадр сохраняются сразу. Что показывать на главной. Те же галочки есть в карточках сущностей — это одни данные: отметили здесь — видно там, и наоборот. Сохранённое сразу появляется на сайте.</div>
  <div v-for="e in chk.errors" :key="e" class="admbar err" style="margin-top:8px">{{ e }}</div>
  <div v-for="w in chk.warnings" :key="w" class="admbar warn" style="margin-top:8px">{{ w }}</div>
  <div style="display:flex;flex-direction:column;gap:16px;margin-top:12px">
    <!-- этаж 1 -->
    <div class="kicker">Этаж 1 · Первый экран</div>
    <div class="card"><b>Первый экран</b>
      <div class="field" style="margin-top:10px"><label>Подзаголовок <span class="muted">— до 500 знаков; каждая строка — отдельная строка макета (1-я и 2-я слева, 3-я справа, 4-я по центру)</span></label>
        <textarea class="inp" v-model="hero" maxlength="500" style="min-height:110px" :disabled="!canEdit"></textarea>
        <div class="muted" style="font-size:12px;text-align:right">{{ hero.length }} / 500</div></div>
      <div class="field"><label>Плейсхолдер поиска <span class="muted">— десктоп и планшет</span></label><input class="inp" v-model="searchPh" :disabled="!canEdit"></div>
      <div class="field"><label>Плейсхолдер поиска на мобайле <span class="muted">— короткий, чтобы поместился</span></label><input class="inp" v-model="searchPhM" :disabled="!canEdit"></div>
    </div>

    <!-- этажи 2–5: списки -->
    <template v-for="(t, i) in ['theme', 'project', 'event', 'person']" :key="t">
      <div class="kicker">Этаж {{ i + 2 }} · {{ { theme: 'Темы', project: 'Проекты Центра', event: 'Хронограф', person: 'Личности' }[t] }}</div>
      <div class="card"><b>{{ { theme: 'Темы', project: 'Проекты центра', event: 'Хронограф', person: 'Личности' }[t] }}</b> <span class="muted" style="font-size:12px">{{ homeList(t).length }}<template v-if="LIM[t]"> · {{ LIM[t] }}</template></span>
        <div class="muted" style="font-size:12px;margin:4px 0 8px">{{ { theme: 'Лента на главной. Количество материалов считается по материалам в теме.', project: 'Два проекта — две большие карточки; три — фичер большой, два маленьких.', event: 'Лента событий на главной, по годам по возрастанию; выводится только год и тип события.', person: 'Фигура из 13 ячеек; при каждой загрузке личности расставляются случайно.' }[t] }}</div>
        <div class="grid" :style="homeSorted(t).length > 8 ? 'grid-template-columns:1fr 1fr;column-gap:24px' : ''">
          <div v-for="o in homeSorted(t)" :key="o.id" style="display:flex;gap:10px;align-items:center;font-size:13px;border-top:1px solid var(--line);padding:6px 0">
            <span v-if="t === 'event'" class="muted" style="flex:0 0 44px;font-variant-numeric:tabular-nums">{{ yr(o) || '—' }}</span>
            <router-link :to="'/edit/' + o.id" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ o.title }}</router-link>
            <label v-if="t === 'project' && canEdit" class="check" style="margin:0;font-size:12px;white-space:nowrap"><input type="radio" name="feat" :checked="!!o.featured" @change="feature(o.id)"> фичер</label>
            <span v-if="canEdit" class="x muted" style="cursor:pointer" title="Убрать с главной" @click="toggle(o, false)">✕</span>
          </div>
        </div>
        <div v-if="!homeList(t).length" class="muted" style="font-size:13px">Пока ничего не выбрано.</div>
        <span v-if="canEdit" class="chip add" style="margin-top:8px" @click="pickType = t">＋ Добавить из списка</span>
      </div>
    </template>

    <!-- этаж 6: карта -->
    <div class="kicker">Этаж 6 · Карта</div>
    <div class="card"><b>Карта</b>
      <div class="field" style="margin-top:10px"><label>Подводка <span class="muted">— три строки: 1-я слева, 2-я справа, 3-я слева</span></label><textarea class="inp" v-model="mapText" style="min-height:80px" :disabled="!canEdit"></textarea></div>
      <div class="kicker" style="margin-top:16px">Десктоп — коллаж из четырёх зданий</div>
      <div class="muted" style="font-size:12px;margin:4px 0 8px">Геометрия коллажа (круги, флажки, линии) зашита в вёрстку; здания — вырезки PNG с прозрачным фоном, их можно заменить. Для каждого здания выбирается место: при наведении подписывается «Название, Город», по клику открывается оно же в разделе «Карта» (нужны координаты в карточке места).</div>
      <div class="grid g2" style="gap:12px">
        <div v-for="[k, l] in BUILDINGS" :key="k" class="metabox" style="padding:10px 12px">
          <div style="font-size:13px;font-weight:600">{{ l }}</div>
          <div style="display:flex;gap:12px;margin-top:8px;align-items:flex-start">
            <div class="media" style="width:120px;height:120px;flex:0 0 120px;background-size:contain;background-repeat:no-repeat;background-color:#f2f2f2" :style="{ backgroundImage: mapImgs[k] ? `url('${mapImgs[k]}')` : '' }"></div>
            <div style="flex:1;min-width:0">
              <div class="muted" style="font-size:12px">{{ mapImgs[k] ? 'Своя вырезка' : 'Вырезка из макета' }} · PNG с прозрачностью, {{ B_SIZE[k] }} px (в 2x — вдвое больше)</div>
              <div v-if="canEdit" style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap"><input type="file" accept="image/png,image/webp" style="display:none" :ref="(el) => (bInputs[k] = el as HTMLInputElement)" @change="bImg(k, $event)"><button class="btn sm" @click="bInputs[k]?.click()">＋ Заменить</button><button v-if="mapImgs[k]" class="btn sm" @click="bImgClear(k)">Вернуть из макета</button></div>
              <div class="field" style="margin:10px 0 0"><label>Ведёт на место</label>
                <select class="sel" v-model="mapB[k]" :disabled="!canEdit"><option value="">— не привязано —</option><option v-for="p in places" :key="p.id" :value="p.id">{{ placeLabel(p.id) }}</option></select>
                <div v-if="mapB[k] && S.db[mapB[k]] && !S.db[mapB[k]].lat" class="muted" style="font-size:12px;margin-top:4px;color:#9a2e2e">У места нет координат — <router-link :to="'/edit/' + mapB[k]">поставьте точку</router-link>, иначе откроется общая карта.</div></div>
            </div>
          </div>
        </div>
      </div>
      <div class="kicker" style="margin-top:18px">{{ MAPM[1] }}</div>
      <div class="muted" style="font-size:12px;margin:4px 0 8px">{{ MAPM[3] }}</div>
      <div class="media" :style="{ aspectRatio: MAPM[2], maxHeight: '220px', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundImage: siteVal(MAPM[0]) ? `url('${siteVal(MAPM[0])}')` : '' }"></div>
      <div v-if="canEdit" style="display:flex;gap:8px;margin-top:8px"><input type="file" accept="image/*" style="display:none" :ref="(el) => (inputs[MAPM[0]] = el as HTMLInputElement)" @change="img(MAPM[0], $event)"><button class="btn sm" @click="inputs[MAPM[0]]?.click()">＋ Загрузить</button><button v-if="siteVal(MAPM[0])" class="btn sm" @click="patchSite({ [MAPM[0]]: '' })">Убрать</button></div>
    </div>

    <!-- этаж 7: коллекции -->
    <div class="kicker">Этаж 7 · Коллекции</div>
    <div class="card"><b>Коллекции</b> <span class="muted" style="font-size:12px">{{ homeList('collection').length }} · до 2</span>
      <div class="muted" style="font-size:12px;margin:4px 0 8px">Галерея хайлайтов: 2–5 материалов коллекции. Подпись под фото берётся из полей файла (название, автор, год) — они заполняются в карточке материала; здесь можно переопределить подпись только для этой коллекции.</div>
      <div v-for="o in homeList('collection')" :key="o.id" style="display:flex;gap:10px;align-items:center;font-size:13px;border-top:1px solid var(--line);padding:6px 0">
        <router-link :to="'/edit/' + o.id" style="flex:1">{{ o.title }}</router-link><span v-if="canEdit" class="x muted" style="cursor:pointer" @click="toggle(o, false)">✕</span></div>
      <span v-if="canEdit" class="chip add" style="margin-top:8px" @click="pickType = 'collection'">＋ Добавить из списка</span>
      <div v-for="c in homeList('collection')" :key="'h' + c.id" style="margin-top:18px">
        <div class="kicker">{{ c.title }} — хайлайты <span class="muted" style="letter-spacing:0;text-transform:none">{{ collHighlights(c).length }} из 2–5</span></div>
        <CollItems :coll="c" @change="items[c.id] = $event" />
      </div>
    </div>

    <!-- этаж 8: об архиве -->
    <div class="kicker">Этаж 8 · Об архиве</div>
    <div class="card"><b>Об архиве</b>
      <div class="field" style="margin-top:10px"><label>Подзаголовок <span class="muted">— строки: 1-я слева, 2-я справа, 3-я по центру</span></label><textarea class="inp" v-model="about.aboutText" style="min-height:80px" :disabled="!canEdit"></textarea></div>
      <div v-for="i in 4" :key="i" class="field"><label>Колонка {{ i }}<span v-if="i === 4" class="muted"> — под ней «По вопросам сотрудничества» и e-mail</span></label><textarea class="inp" v-model="(about as any)['aboutCol' + i]" style="min-height:80px" :disabled="!canEdit"></textarea></div>
      <div class="field"><label>E-mail для сотрудничества</label><input class="inp" v-model="about.aboutEmail" :disabled="!canEdit"></div>
      <div v-for="[k, l, ar, hint] in IMGS" :key="k" class="field" style="margin-top:16px"><label>{{ l }} <span class="muted">— {{ hint }}</span></label>
        <div class="media" :style="{ aspectRatio: ar, maxHeight: '220px', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundImage: siteVal(k) ? `url('${siteVal(k)}')` : '' }"></div>
        <div v-if="canEdit" style="display:flex;gap:8px;margin-top:8px"><input type="file" accept="image/*" style="display:none" :ref="(el) => (inputs[k] = el as HTMLInputElement)" @change="img(k, $event)"><button class="btn sm" @click="inputs[k]?.click()">＋ Загрузить</button><button v-if="siteVal(k)" class="btn sm" @click="cropKey = k">Кадр</button><button v-if="siteVal(k)" class="btn sm" @click="patchSite({ [k]: '', [k + 'Frame']: null })">Убрать</button></div></div>
    </div>
  </div>
  <CropModal v-if="cropKey" :src="siteVal(cropKey)" :frames="siteObj(cropKey + 'Frame')" title="Кадр фона «Об архиве»" :previews="ABOUT_PREV" @save="patchSite({ [cropKey + 'Frame']: $event }); cropKey = null" @close="cropKey = null" />
  <Picker v-if="pickType" :title="TYPES[pickType].pl + ': добавить на главную'" :items="pool" :sub="pickSub" @pick="toggle($event, true); pickType = null" @close="pickType = null" />
</template>
