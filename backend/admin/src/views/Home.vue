<script setup lang="ts">
// Главная страница: что показывать (одни данные с галочками в карточках), фичер, хайлайты коллекций, тексты, фон, коллажи карты
import { ref, reactive, computed } from "vue";
import { S, all, api, load, toast, canEdit, homeList, homeCheck, collHighlights, siteVal, patchSite, uploadFile, onHome, HOME_KEY } from "../lib/store";
import { TYPES, type Entity } from "../lib/model";
import Picker from "../components/Picker.vue";
import CollItems from "../components/CollItems.vue";
const hero = ref(siteVal("heroText")), about = reactive({ aboutText: siteVal("aboutText"), aboutCol1: siteVal("aboutCol1"), aboutCol2: siteVal("aboutCol2"), aboutCol3: siteVal("aboutCol3"), aboutCol4: siteVal("aboutCol4"), aboutEmail: siteVal("aboutEmail") });
const chk = computed(() => homeCheck(undefined, hero.value.length));
const pickType = ref<string | null>(null);
const pool = computed(() => (pickType.value ? all(pickType.value).filter((o) => !onHome(o)) : []));
const LIM: Record<string, string> = { theme: "5–9", project: "2–3", collection: "до 2" };
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
async function saveColl(c: Entity) {
  const it = items[c.id]; if (!it) return;
  const r = homeCheck({ id: c.id, items: it }); if (r.errors.length) { toast(r.errors[0]); return; }
  try { await api("/entities/" + c.id, { method: "PATCH", body: JSON.stringify({ payload: { items: it } }) }); await load(); toast(r.warnings.find((w) => w.startsWith("«" + c.title)) || "Хайлайты сохранены"); } catch (e: any) { toast("Ошибка: " + e.message); }
}
async function saveTexts() {
  if (hero.value.length > 500) { toast("Подзаголовок длиннее 500 знаков — сократите."); return; }
  try { await patchSite({ heroText: hero.value.trim(), ...Object.fromEntries(Object.entries(about).map(([k, v]) => [k, String(v).trim()])) }); toast("Сохранено — обновлено на сайте"); } catch (e: any) { toast("Ошибка: " + e.message); }
}
const inputs: Record<string, HTMLInputElement | undefined> = {};
async function img(key: string, ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]; if (!file) return;
  try { if (!S.db["site"]) await patchSite({}); const m = await uploadFile(file, "site"); await patchSite({ [key]: m.big || m.med || m.thumb || "" }); toast("Сохранено — обновлено на сайте"); } catch (e: any) { toast("Ошибка: " + e.message); }
  (ev.target as HTMLInputElement).value = "";
}
const IMGS: [string, string, string, string][] = [["aboutBg", "Фон «Об архиве»", "3/1", "Фотография на весь блок, под затемнением"], ["mapD", "Карта — десктоп", "1740/800", "Коллаж 1740×800 с надписью «КАРТА» внутри"], ["mapM", "Карта — мобайл и планшет", "360/462", "Вертикальный коллаж без надписи (в 2x)"]];
</script>
<template>
  <h1>Главная страница</h1>
  <div class="muted" style="font-size:14px;margin:6px 0 14px;max-width:760px">Что показывать на главной. Те же галочки есть в карточках сущностей — это одни данные: отметили здесь — видно там, и наоборот. Сохранённое сразу появляется на сайте.</div>
  <div v-for="e in chk.errors" :key="e" class="admbar err" style="margin-top:8px">{{ e }}</div>
  <div v-for="w in chk.warnings" :key="w" class="admbar warn" style="margin-top:8px">{{ w }}</div>
  <div class="grid g2" style="gap:16px;align-items:start;margin-top:12px">
    <div class="card"><b>Первый экран</b>
      <div class="field" style="margin-top:10px"><label>Подзаголовок <span class="muted">— до 500 знаков; каждая строка — отдельная строка макета (1-я и 2-я слева, 3-я справа, 4-я по центру)</span></label>
        <textarea class="inp" v-model="hero" maxlength="500" style="min-height:110px" :disabled="!canEdit"></textarea>
        <div class="muted" style="font-size:12px;text-align:right">{{ hero.length }} / 500</div></div>
      <button v-if="canEdit" class="btn dark" @click="saveTexts">Сохранить тексты</button>
    </div>
    <div class="card"><b>Об архиве</b>
      <div class="field" style="margin-top:10px"><label>Подзаголовок <span class="muted">— строки: 1-я слева, 2-я справа, 3-я по центру</span></label><textarea class="inp" v-model="about.aboutText" style="min-height:80px" :disabled="!canEdit"></textarea></div>
      <div v-for="i in 4" :key="i" class="field"><label>Колонка {{ i }}<span v-if="i === 4" class="muted"> — под ней «По вопросам сотрудничества» и e-mail</span></label><textarea class="inp" v-model="(about as any)['aboutCol' + i]" style="min-height:80px" :disabled="!canEdit"></textarea></div>
      <div class="field"><label>E-mail для сотрудничества</label><input class="inp" v-model="about.aboutEmail" :disabled="!canEdit"></div>
      <button v-if="canEdit" class="btn dark" @click="saveTexts">Сохранить тексты</button>
    </div>
    <div class="card"><b>Изображения</b>
      <div v-for="[k, l, ar, hint] in IMGS" :key="k" class="field"><label>{{ l }} <span class="muted">— {{ hint }}</span></label>
        <div class="media" :style="{ aspectRatio: ar, maxHeight: '220px', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundImage: siteVal(k) ? `url('${siteVal(k)}')` : '' }"></div>
        <div v-if="canEdit" style="display:flex;gap:8px;margin-top:8px"><input type="file" accept="image/*" style="display:none" :ref="(el) => (inputs[k] = el as HTMLInputElement)" @change="img(k, $event)"><button class="btn sm" @click="inputs[k]?.click()">＋ Загрузить</button><button v-if="siteVal(k)" class="btn sm" @click="patchSite({ [k]: '' })">Убрать</button></div></div>
    </div>
    <template v-for="t in ['theme', 'project', 'event', 'person']" :key="t">
      <div class="card"><b>{{ { theme: 'Темы', project: 'Проекты центра', event: 'Хронограф', person: 'Личности' }[t] }}</b> <span class="muted" style="font-size:12px">{{ homeList(t).length }}<template v-if="LIM[t]"> · {{ LIM[t] }}</template></span>
        <div class="muted" style="font-size:12px;margin:4px 0 8px">{{ { theme: 'Лента на главной. Количество материалов считается по материалам в теме.', project: 'Два проекта — две большие карточки; три — фичер большой, два маленьких.', event: 'Лента событий на главной, по годам по возрастанию; выводится только год.', person: 'Фигура из 13 ячеек; при каждой загрузке личности расставляются случайно.' }[t] }}</div>
        <div v-for="o in homeList(t)" :key="o.id" style="display:flex;gap:10px;align-items:center;font-size:13px;border-top:1px solid var(--line);padding:6px 0">
          <router-link :to="'/edit/' + o.id" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ o.title }}</router-link>
          <label v-if="t === 'project' && canEdit" class="check" style="margin:0;font-size:12px;white-space:nowrap"><input type="radio" name="feat" :checked="!!o.featured" @change="feature(o.id)"> фичер</label>
          <span v-if="canEdit" class="x muted" style="cursor:pointer" title="Убрать с главной" @click="toggle(o, false)">✕</span>
        </div>
        <div v-if="!homeList(t).length" class="muted" style="font-size:13px">Пока ничего не выбрано.</div>
        <span v-if="canEdit" class="chip add" style="margin-top:8px" @click="pickType = t">＋ Добавить из списка</span>
      </div>
    </template>
    <div class="card" style="grid-column:1/-1"><b>Коллекции</b> <span class="muted" style="font-size:12px">{{ homeList('collection').length }} · до 2</span>
      <div class="muted" style="font-size:12px;margin:4px 0 8px">Галерея хайлайтов: 2–5 материалов коллекции с фото и подписью, выбранными для этой коллекции.</div>
      <div v-for="o in homeList('collection')" :key="o.id" style="display:flex;gap:10px;align-items:center;font-size:13px;border-top:1px solid var(--line);padding:6px 0">
        <router-link :to="'/edit/' + o.id" style="flex:1">{{ o.title }}</router-link><span v-if="canEdit" class="x muted" style="cursor:pointer" @click="toggle(o, false)">✕</span></div>
      <span v-if="canEdit" class="chip add" style="margin-top:8px" @click="pickType = 'collection'">＋ Добавить из списка</span>
      <div v-for="c in homeList('collection')" :key="'h' + c.id" style="margin-top:18px">
        <div class="kicker">{{ c.title }} — хайлайты <span class="muted" style="letter-spacing:0;text-transform:none">{{ collHighlights(c).length }} из 2–5</span></div>
        <CollItems :coll="c" @change="items[c.id] = $event" />
        <button v-if="canEdit" class="btn sm dark" style="margin-top:8px" @click="saveColl(c)">Сохранить хайлайты «{{ c.title }}»</button>
      </div>
    </div>
  </div>
  <Picker v-if="pickType" :title="TYPES[pickType].pl + ': добавить на главную'" :items="pool" @pick="toggle($event, true); pickType = null" @close="pickType = null" />
</template>
