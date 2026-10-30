<script setup lang="ts">
// Справочники: значения для карточек и фильтров сайта. Слева — навигация по разделам, справа — разделы по порядку.
// У каждого справочника типы идут строками, подтипы — внутри своего типа (раскрываются). Для каждого значения:
// переименовать (меняется и во всех карточках), удалить (только если нигде не используется), порядок стрелками —
// в этом порядке значения идут в фильтрах сайта. Длинные списки свёрнуты.
import { computed, ref, reactive } from "vue";
import { S, all, api, load, toast, dictValues, dictPatch, dictUsage, dictRename, periodVal, savePeriod, canEdit } from "../lib/store";
import { ACCESS } from "../lib/model";
// справочник → подпись раздела, какие карточки используют, где на сайте; sub — есть ли подтипы
type Sec = { key: string; title: string; where: string; sub: boolean; addLabel: string };
const SECS: Sec[] = [
  { key: "mtype", title: "Материалы — типы и подтипы", where: "карточка материала; фильтр «Материал» и типология в поиске", sub: true, addLabel: "тип" },
  { key: "evType", title: "События — типы и подтипы", where: "карточка события; фильтр «Событие»; хронограф", sub: true, addLabel: "тип" },
  { key: "sphere", title: "Личности — сферы деятельности", where: "карточка личности; фильтр «Сфера деятельности» в разделе «Личности»", sub: false, addLabel: "сферу" },
  { key: "group", title: "Личности — типы (группы)", where: "карточка личности; фильтр «Личность» группирует людей по типу", sub: false, addLabel: "тип" },
  { key: "colType", title: "Коллекции — типы", where: "карточка коллекции; фильтр «Коллекция»", sub: true, addLabel: "тип" },
  { key: "srcType", title: "Тексты — типы", where: "карточка текста (источника); фильтр «Текст»", sub: true, addLabel: "тип" },
  { key: "prType", title: "Проекты Центра — типы", where: "карточка проекта", sub: true, addLabel: "тип" },
  { key: "orgType", title: "Организации — типы", where: "карточка организации", sub: true, addLabel: "тип" },
  { key: "city", title: "Города", where: "карточки места, события и личности; фильтр «Город» в поиске, хронографе, на карте и в «Личностях»", sub: false, addLabel: "город" },
  { key: "func", title: "Места — типы (группы функций) и функции", where: "карточка места; фильтры «Место» в поиске и «Функция» на карте", sub: true, addLabel: "группу" },
  { key: "author", title: "Авторы — группы и авторы", where: "карточка места; фильтр «Автор» на карте. Архитекторы и инженеры на сайте — по алфавиту, «Неизвестный архитектор» всегда последним; проектные организации — в заданном порядке", sub: true, addLabel: "группу" },
  { key: "customer", title: "Заказчики", where: "карточка места; фильтр «Заказчик» на карте", sub: false, addLabel: "тип" },
  { key: "okn", title: "Статус ОКН", where: "карточка места; фильтр «Статус ОКН» на карте", sub: false, addLabel: "статус" },
  { key: "a11y", title: "Доступность", where: "карточка материала: субтитры, РЖЯ, расшифровка…", sub: false, addLabel: "значение" },
];
const NAV = computed(() => [["period", "Период"], ...SECS.map((s) => [s.key, s.title.split(" — ")[0]]), ["tags", "Теги"], ["access", "Уровни доступа"]]);
const ask = (msg: string, v = "") => (prompt(msg, v) || "").trim();
const busy = ref(false);
// свёрнутость: длинные списки типов свёрнуты до 6 строк; подтипы внутри типа раскрываются по клику
const openSec = reactive<Record<string, boolean>>({});
const openType = reactive<Record<string, boolean>>({});
const LIMIT = 6;
const visible = (key: string) => { const v = dictValues(key); return openSec[key] || v.length <= LIMIT ? v : v.slice(0, LIMIT); };
const subsOf = (key: string, t: string) => dictValues("sub:" + key).filter((v) => v.startsWith(t + " › "));
const used = (key: string, v: string) => dictUsage(key, v).length;
const subLabel = (key: string) => (key === "group" ? "роль" : key === "func" ? "функцию" : key === "author" ? "автора" : "подтип");

async function add(key: string, type?: string) {
  const v = ask(type ? `Новый ${subLabel(key)} для «${type}»:` : "Новое значение:"); if (!v) return;
  const full = type ? type + " › " + v : v;
  const k = type ? "sub:" + key : key;
  if (dictValues(k).includes(full)) return toast("Такое значение уже есть");
  try { await dictPatch(k, (st) => { st.removed = st.removed.filter((x) => x !== full); if (!st.added.includes(full)) st.added.push(full); }); if (type) openType[key + "|" + type] = true; toast("Добавлено"); } catch (e: any) { toast("Ошибка: " + e.message); }
}
async function rm(key: string, v: string) {
  const subs = key.startsWith("sub:") ? 0 : dictValues("sub:" + key).filter((x) => x.startsWith(v + " › ")).length;
  const n = dictUsage(key, v).length;
  if (n || subs) return alert(`«${v.split(" › ").pop()}» нельзя удалить: ${n ? `используется в карточках (${n})` : ""}${n && subs ? ", " : ""}${subs ? `есть ${subs} подтип(а)` : ""}. Сначала смените значение в карточках или переименуйте его.`);
  if (!confirm(`Удалить «${v.split(" › ").pop()}»?`)) return;
  try { await dictPatch(key, (st) => { st.added = st.added.filter((x) => x !== v); if (!st.removed.includes(v)) st.removed.push(v); st.order = st.order.filter((x) => x !== v); }); toast("Удалено"); } catch (e: any) { toast("Ошибка: " + e.message); }
}
async function rename(key: string, v: string, type?: string) {
  const cur = type ? v.slice(type.length + 3) : v;
  const n = ask("Переименовать (поменяется и во всех карточках):", cur); if (!n || n === cur) return;
  const nv = type ? type + " › " + n : n;
  if (dictValues(key).includes(nv)) return toast("Такое значение уже есть");
  busy.value = true;
  try { const k = await dictRename(key, v, nv); toast(k ? `Переименовано, обновлено карточек: ${k}` : "Переименовано"); } catch (e: any) { toast("Ошибка: " + e.message); }
  busy.value = false;
}
async function move(key: string, list: string[], v: string, d: -1 | 1) {
  const i = list.indexOf(v), j = i + d; if (j < 0 || j >= list.length) return;
  const allV = dictValues(key); const next = [...list]; [next[i], next[j]] = [next[j], next[i]];
  const rest = allV.filter((x) => !list.includes(x));
  try { await dictPatch(key, (st) => { st.order = key.startsWith("sub:") ? [...rest, ...next] : next; }); } catch (e: any) { toast("Ошибка: " + e.message); }
}
// период поиска
const per = ref(periodVal());
const dataRange = computed(() => { const ys = S.raw.flatMap((o) => String(o.date || o.life || o.dates || o.year || "").match(/\d{4}/g) || []).map(Number).filter((y) => y > 1700 && y < 2100); return ys.length ? [Math.min(...ys), Math.max(...ys)] : null; });
async function savePer() {
  const f = Number(per.value.from), t = Number(per.value.to);
  if (!f || !t || f > t || f < 1000 || t > 2100) return toast("Укажите годы «с» и «по», например 1910 и 1940");
  try { await savePeriod(f, t); toast("Сохранено — фильтр «Период» на сайте обновлён"); } catch (e: any) { toast("Ошибка: " + e.message); }
}
async function tagCreate() { const n = ask("Новый тег:").replace(/^#/, ""); if (!n) return; if (all("tag").some((t) => t.title.toLowerCase() === n.toLowerCase())) return toast("Такой тег уже есть"); try { await api("/entities", { method: "POST", body: JSON.stringify({ type: "tag", title: n }) }); await load(); toast("Тег создан"); } catch (e: any) { toast("Ошибка: " + e.message); } }
async function tagEdit(id: string) { const t = S.db[id]; const n = ask("Переименовать тег:", t.title).replace(/^#/, ""); if (!n || n === t.title) return; try { await api("/entities/" + id, { method: "PATCH", body: JSON.stringify({ title: n }) }); await load(); toast("Переименовано"); } catch (e: any) { toast("Ошибка: " + e.message); } }
async function tagRm(id: string) { if (!confirm("Удалить тег? Он снимется со всех карточек.")) return; try { await api("/entities/" + id, { method: "DELETE" }); await load(); toast("Удалено"); } catch (e: any) { toast("Ошибка: " + e.message); } }
const go = (id: string) => document.getElementById("d-" + id)?.scrollIntoView({ behavior: "smooth", block: "start" });
</script>
<template>
  <h1>Справочники</h1>
  <div class="muted" style="font-size:14px;margin:6px 0 14px;max-width:760px">Списки значений для карточек и фильтров сайта. Порядок значений здесь — порядок в фильтрах поиска. Клик по названию — переименовать (поменяется во всех карточках), ✕ — удалить (только неиспользуемое), стрелки — порядок, цифра — сколько карточек со значением.</div>
  <div class="dwrap">
    <nav class="dnav">
      <a v-for="[id, l] in NAV" :key="id" @click="go(id)">{{ l }}</a>
    </nav>
    <div class="dmain">
      <div class="card" id="d-period"><b>Период поиска</b>
        <div class="muted" style="font-size:12px;margin:4px 0 10px;max-width:640px">Какие годы предлагаются в фильтре «Период» на странице поиска. Задаётся один общий диапазон «с — по»; на сайте он делится на десятилетия, внутри — годы. Показываются все годы диапазона, даже если по какому-то ничего нет.<template v-if="dataRange"> В карточках архива сейчас встречаются даты с {{ dataRange[0] }} по {{ dataRange[1] }}.</template></div>
        <div style="display:flex;gap:8px;align-items:center"><span>с</span><input class="inp" v-model="per.from" inputmode="numeric" style="width:100px" placeholder="1910" :disabled="!canEdit"><span>по</span><input class="inp" v-model="per.to" inputmode="numeric" style="width:100px" placeholder="1940" :disabled="!canEdit"><button v-if="canEdit" class="btn sm" @click="savePer">Сохранить</button></div>
        <div v-if="!periodVal().from" class="muted" style="font-size:12px;margin-top:8px">Пока не задан — на сайте диапазон считается по датам в карточках.</div>
      </div>

      <div v-for="sec in SECS" :key="sec.key" class="card" :id="'d-' + sec.key"><b>{{ sec.title }}</b> <span class="muted" style="font-size:12px">{{ dictValues(sec.key).length }}</span>
        <div class="muted" style="font-size:12px;margin:2px 0 6px">Где используется: {{ sec.where }}.</div>
        <div class="dlist">
          <template v-for="(v, i) in visible(sec.key)" :key="v">
            <div class="drow">
              <button v-if="sec.sub" class="dtog" :class="{ on: openType[sec.key + '|' + v] }" :title="subsOf(sec.key, v).length ? 'Показать подтипы' : 'Подтипов нет'" @click="openType[sec.key + '|' + v] = !openType[sec.key + '|' + v]">{{ openType[sec.key + '|' + v] ? '−' : '+' }}</button>
              <span class="dname" :class="{ ed: canEdit }" @click="canEdit && !busy && rename(sec.key, v)">{{ v }}</span>
              <span v-if="sec.sub && subsOf(sec.key, v).length" class="muted dsub-n" @click="openType[sec.key + '|' + v] = !openType[sec.key + '|' + v]">{{ subsOf(sec.key, v).length }} {{ subLabel(sec.key) }}{{ subsOf(sec.key, v).length === 1 ? '' : subsOf(sec.key, v).length < 5 ? 'а' : 'ов' }}</span>
              <span class="muted dn" title="Карточек с этим значением">{{ used(sec.key, v) }}</span>
              <template v-if="canEdit"><button class="dbtn" :disabled="i === 0" title="Выше" @click="move(sec.key, dictValues(sec.key), v, -1)">↑</button><button class="dbtn" :disabled="i === dictValues(sec.key).length - 1" title="Ниже" @click="move(sec.key, dictValues(sec.key), v, 1)">↓</button><button class="dbtn x" title="Удалить" @click="rm(sec.key, v)">✕</button></template>
            </div>
            <div v-if="sec.sub && openType[sec.key + '|' + v]" class="dsub">
              <div v-for="(sv, j) in subsOf(sec.key, v)" :key="sv" class="drow">
                <span class="dname" :class="{ ed: canEdit }" @click="canEdit && !busy && rename('sub:' + sec.key, sv, v)">{{ sv.slice(v.length + 3) }}</span><span class="muted dn">{{ used('sub:' + sec.key, sv) }}</span>
                <template v-if="canEdit"><button class="dbtn" :disabled="j === 0" @click="move('sub:' + sec.key, subsOf(sec.key, v), sv, -1)">↑</button><button class="dbtn" :disabled="j === subsOf(sec.key, v).length - 1" @click="move('sub:' + sec.key, subsOf(sec.key, v), sv, 1)">↓</button><button class="dbtn x" @click="rm('sub:' + sec.key, sv)">✕</button></template>
              </div>
              <div v-if="!subsOf(sec.key, v).length" class="muted" style="font-size:12px;padding:6px 0">{{ subLabel(sec.key) === 'роль' ? 'Ролей пока нет' : 'Подтипов пока нет' }}</div>
              <span v-if="canEdit" class="chip add" style="font-size:12px;padding:3px 10px;margin-top:4px" @click="add(sec.key, v)">＋ {{ subLabel(sec.key) }}</span>
            </div>
          </template>
        </div>
        <div style="display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap">
          <span v-if="canEdit" class="chip add" @click="add(sec.key)">＋ {{ sec.addLabel }}</span>
          <a v-if="dictValues(sec.key).length > LIMIT" class="lnk" style="font-size:13px" @click="openSec[sec.key] = !openSec[sec.key]">{{ openSec[sec.key] ? 'Свернуть' : `Показать все ${dictValues(sec.key).length}` }}</a>
        </div>
      </div>

      <div class="card" id="d-tags"><b>Теги</b> <span class="muted" style="font-size:12px">{{ all('tag').length }}</span>
        <div class="muted" style="font-size:12px;margin:2px 0 6px">Служебные: помогают поиску, на сайте не выводятся. Удаление снимает тег со всех карточек.</div>
        <div class="chips"><span v-for="t in all('tag')" :key="t.id" class="chip" style="font-size:13px"><span @click="canEdit && tagEdit(t.id)">#{{ t.title }}</span><span v-if="canEdit" class="x" @click="tagRm(t.id)">✕</span></span><span v-if="canEdit" class="chip add" @click="tagCreate">＋</span></div>
      </div>
      <div class="card" id="d-access"><b>Уровни доступа</b>
        <div class="muted" style="font-size:12px;margin:2px 0 6px">Системный список — меняется только в коде.</div>
        <div class="chips"><span v-for="(l, v) in ACCESS" :key="v" class="chip" style="font-size:13px;cursor:default">{{ l }}</span></div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.dwrap{display:grid;grid-template-columns:180px 1fr;gap:20px;align-items:start}
.dnav{position:sticky;top:16px;display:flex;flex-direction:column;gap:2px;font-size:13px}
.dnav a{padding:6px 8px;cursor:pointer;border-left:2px solid transparent}
.dnav a:hover{border-left-color:var(--ink);background:#fafafa}
.dmain{display:flex;flex-direction:column;gap:16px;min-width:0}
.dmain .card{scroll-margin-top:12px}
.dlist{margin-top:6px;display:flex;flex-direction:column}
.drow{display:flex;align-items:center;gap:6px;border-top:1px solid var(--line);padding:6px 0;font-size:14px}
.dtog{width:22px;height:22px;border:1px solid var(--line);background:#fff;cursor:pointer;font:inherit;font-size:14px;line-height:1;padding:0;flex:0 0 22px}
.dtog.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.dname{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dname.ed{cursor:pointer}
.dname.ed:hover{color:var(--red)}
.dsub-n{font-size:12px;cursor:pointer;white-space:nowrap}
.dn{font-size:12px;min-width:22px;text-align:right}
.dbtn{border:1px solid var(--line);background:#fff;width:26px;height:24px;cursor:pointer;font:inherit;font-size:12px;padding:0}
.dbtn:hover:not(:disabled){border-color:var(--ink)}
.dbtn:disabled{opacity:.3;cursor:default}
.dbtn.x:hover{color:var(--red);border-color:var(--red)}
.dsub{padding:0 0 8px 28px;border-top:1px solid var(--line);background:#fafafa}
.dsub .drow{font-size:13px;border-top-color:#eee}
@media (max-width:900px){.dwrap{grid-template-columns:1fr}.dnav{position:static;flex-direction:row;flex-wrap:wrap}}
</style>
