<script setup lang="ts">
// Справочники. Сверху — «Фильтры поиска» (ТЗ поиска): всё, что показывается в окнах фильтров на сайте —
// диапазон Периода, типы и подтипы материалов, мест, событий, типы личностей, коллекций, текстов.
// Для каждого списка: добавить, переименовать (значение меняется и во всех карточках), удалить (только если нигде
// не используется), задать порядок стрелками — в этом порядке значения идут в фильтрах сайта.
// Ниже — остальные справочники, теги и уровни доступа.
import { computed, ref } from "vue";
import { S, all, api, load, toast, DICTDEF, dictValues, dictPatch, dictUsage, dictRename, periodVal, savePeriod, canEdit } from "../lib/store";
import { ACCESS } from "../lib/model";
const defs = computed(() => DICTDEF());
const def = (k: string) => defs.value.find((d) => d.key === k)!;
// разделы фильтров поиска: категория сайта → справочник типов (+ подтипов)
const SEARCH: [string, string, boolean][] = [["Материал", "mtype", true], ["Место", "placeType", true], ["Событие", "evType", true], ["Личность — типы личностей", "group", false], ["Коллекция — типы коллекций", "colType", false], ["Текст — типы текстов", "srcType", false]];
const inSearch = new Set(SEARCH.flatMap(([, k, sub]) => (sub ? [k, "sub:" + k] : [k])));
const others = computed(() => defs.value.filter((d) => !inSearch.has(d.key)));
const ask = (msg: string, v = "") => (prompt(msg, v) || "").trim();
const busy = ref(false);

async function add(key: string, type?: string) {
  const v = ask(type ? `Новый подтип для «${type}»:` : "Новое значение:"); if (!v) return;
  const full = type ? type + " › " + v : v;
  if (dictValues(key).includes(full)) return toast("Такое значение уже есть");
  try { await dictPatch(key, (st) => { st.removed = st.removed.filter((x) => x !== full); if (!st.added.includes(full)) st.added.push(full); }); toast(type ? "Подтип добавлен" : "Добавлено"); } catch (e: any) { toast("Ошибка: " + e.message); }
}
async function rm(key: string, v: string) {
  const n = dictUsage(key, v).length + (key.startsWith("sub:") ? 0 : dictValues("sub:" + key).filter((x) => x.startsWith(v + " › ")).length);
  if (n) return alert(`«${v.split(" › ").pop()}» используется (${n}): в карточках или как тип у подтипов. Сначала смените значение в этих карточках или переименуйте его.`);
  if (!confirm(`Удалить «${v.split(" › ").pop()}» из справочника?`)) return;
  try { await dictPatch(key, (st) => { st.added = st.added.filter((x) => x !== v); if (!st.removed.includes(v)) st.removed.push(v); st.order = st.order.filter((x) => x !== v); }); toast("Удалено"); } catch (e: any) { toast("Ошибка: " + e.message); }
}
async function rename(key: string, v: string, type?: string) {
  const cur = type ? v.slice(type.length + 3) : v;
  const n = ask("Переименовать значение (поменяется и во всех карточках):", cur); if (!n || n === cur) return;
  const nv = type ? type + " › " + n : n;
  if (dictValues(key).includes(nv)) return toast("Такое значение уже есть");
  busy.value = true;
  try { const k = await dictRename(key, v, nv); toast(k ? `Переименовано, обновлено карточек: ${k}` : "Переименовано"); } catch (e: any) { toast("Ошибка: " + e.message); }
  busy.value = false;
}
// порядок: меняем местами с соседом внутри видимого списка (для подтипов — внутри своего типа)
async function move(key: string, list: string[], v: string, d: -1 | 1) {
  const i = list.indexOf(v), j = i + d; if (j < 0 || j >= list.length) return;
  const all = dictValues(key);
  const next = [...list]; [next[i], next[j]] = [next[j], next[i]];
  const rest = all.filter((x) => !list.includes(x));
  try { await dictPatch(key, (st) => { st.order = key.startsWith("sub:") ? [...rest, ...next] : next; }); } catch (e: any) { toast("Ошибка: " + e.message); }
}
const subsOf = (key: string, t: string) => dictValues("sub:" + key).filter((v) => v.startsWith(t + " › "));
const used = (key: string, v: string) => dictUsage(key, v).length;

// Период: общий диапазон годов; десятилетия на сайте строятся автоматически
const per = ref(periodVal());
async function savePer() {
  const f = Number(per.value.from), t = Number(per.value.to);
  if (!f || !t || f > t || f < 1000 || t > 2100) return toast("Укажите годы «с» и «по», например 1910 и 1940");
  try { await savePeriod(f, t); toast("Сохранено — фильтр «Период» на сайте обновлён"); } catch (e: any) { toast("Ошибка: " + e.message); }
}

async function tagCreate() { const n = ask("Новый тег:").replace(/^#/, ""); if (!n) return; if (all("tag").some((t) => t.title.toLowerCase() === n.toLowerCase())) return toast("Такой тег уже есть"); try { await api("/entities", { method: "POST", body: JSON.stringify({ type: "tag", title: n }) }); await load(); toast("Тег создан"); } catch (e: any) { toast("Ошибка: " + e.message); } }
async function tagEdit(id: string) { const t = S.db[id]; const n = ask("Переименовать тег:", t.title).replace(/^#/, ""); if (!n || n === t.title) return; try { await api("/entities/" + id, { method: "PATCH", body: JSON.stringify({ title: n }) }); await load(); toast("Переименовано"); } catch (e: any) { toast("Ошибка: " + e.message); } }
async function tagRm(id: string) { if (!confirm("Удалить тег? Он снимется со всех карточек.")) return; try { await api("/entities/" + id, { method: "DELETE" }); await load(); toast("Удалено"); } catch (e: any) { toast("Ошибка: " + e.message); } }
</script>
<template>
  <h1>Справочники</h1>
  <div class="muted" style="font-size:14px;margin:6px 0">Управляемые списки значений для карточек и фильтров сайта. Порядок значений здесь — порядок в фильтрах поиска.</div>

  <h2 style="margin:22px 0 4px">Фильтры поиска</h2>
  <div class="muted" style="font-size:13px;margin-bottom:12px">Что показывается в окнах фильтров на странице поиска. Темы и личности берутся из карточек, здесь — их типы.</div>
  <div class="grid g2" style="align-items:start">
    <div class="card"><b>Период — диапазон годов</b>
      <div class="muted" style="font-size:12px;margin:4px 0 10px">В фильтре показываются все годы диапазона, даже если по какому-то году ничего нет. Десятилетия строятся автоматически.</div>
      <div style="display:flex;gap:8px;align-items:center"><span>с</span><input class="inp" v-model="per.from" inputmode="numeric" style="width:100px" placeholder="1910" :disabled="!canEdit"><span>по</span><input class="inp" v-model="per.to" inputmode="numeric" style="width:100px" placeholder="1940" :disabled="!canEdit"><button v-if="canEdit" class="btn sm" @click="savePer">Сохранить</button></div>
      <div v-if="!periodVal().from" class="muted" style="font-size:12px;margin-top:8px">Пока не задан — на сайте диапазон считается по датам в карточках.</div>
    </div>
    <div v-for="[title, key, withSub] in SEARCH" :key="key" class="card"><b>{{ title }}</b> <span class="muted" style="font-size:12px">{{ dictValues(key).length }}</span>
      <div class="dlist">
        <template v-for="(v, i) in dictValues(key)" :key="v">
          <div class="drow">
            <span class="dname" :class="{ ed: canEdit }" @click="canEdit && !busy && rename(key, v)">{{ v }}</span><span class="muted dn">{{ used(key, v) }}</span>
            <template v-if="canEdit"><button class="dbtn" :disabled="i === 0" title="Выше" @click="move(key, dictValues(key), v, -1)">↑</button><button class="dbtn" :disabled="i === dictValues(key).length - 1" title="Ниже" @click="move(key, dictValues(key), v, 1)">↓</button><button class="dbtn x" title="Удалить" @click="rm(key, v)">✕</button></template>
          </div>
          <div v-if="withSub" class="dsub">
            <div v-for="(sv, j) in subsOf(key, v)" :key="sv" class="drow">
              <span class="dname" :class="{ ed: canEdit }" @click="canEdit && !busy && rename('sub:' + key, sv, v)">{{ sv.slice(v.length + 3) }}</span><span class="muted dn">{{ used('sub:' + key, sv) }}</span>
              <template v-if="canEdit"><button class="dbtn" :disabled="j === 0" @click="move('sub:' + key, subsOf(key, v), sv, -1)">↑</button><button class="dbtn" :disabled="j === subsOf(key, v).length - 1" @click="move('sub:' + key, subsOf(key, v), sv, 1)">↓</button><button class="dbtn x" @click="rm('sub:' + key, sv)">✕</button></template>
            </div>
            <span v-if="canEdit" class="chip add" style="font-size:12px;padding:3px 10px" @click="add('sub:' + key, v)">＋ подтип</span>
          </div>
        </template>
      </div>
      <span v-if="canEdit" class="chip add" style="margin-top:8px" @click="add(key)">＋ {{ withSub ? "тип" : "значение" }}</span>
      <div class="muted" style="font-size:11px;margin-top:8px">Цифра — сколько карточек с этим значением. Клик по названию — переименовать везде; ✕ — удалить (только неиспользуемое).</div>
    </div>
  </div>

  <h2 style="margin:28px 0 12px">Другие справочники</h2>
  <div class="grid g2">
    <div v-for="d in others" :key="d.key" class="card"><b>{{ d.label }}</b> <span class="muted" style="font-size:12px">{{ dictValues(d.key).length }}</span>
      <template v-if="d.key.startsWith('sub:')">
        <div v-for="t in dictValues(d.key.slice(4))" :key="t" style="margin-top:10px"><div class="kicker">{{ t }}</div>
          <div class="chips" style="margin-top:4px">
            <span v-for="v in dictValues(d.key).filter(v => v.startsWith(t + ' › '))" :key="v" class="chip" style="font-size:13px"><span @click="canEdit && rename(d.key, v, t)" title="Переименовать">{{ v.slice(t.length + 3) }}</span><span v-if="canEdit" class="x" @click="rm(d.key, v)">✕</span></span>
            <span v-if="canEdit" class="chip add" @click="add(d.key, t)">＋</span>
          </div></div>
        <div v-if="!dictValues(d.key.slice(4)).length" class="muted" style="font-size:13px;margin-top:8px">Сначала добавьте типы в соответствующий справочник.</div>
      </template>
      <template v-else>
        <div class="chips" style="margin-top:10px">
          <span v-for="v in dictValues(d.key)" :key="v" class="chip" style="font-size:13px"><span @click="canEdit && rename(d.key, v)" title="Переименовать">{{ v }}</span><span v-if="canEdit" class="x" @click="rm(d.key, v)">✕</span></span>
          <span v-if="canEdit" class="chip add" @click="add(d.key)">＋</span>
        </div>
      </template>
    </div>
    <div class="card"><b>Теги</b> <span class="muted" style="font-size:12px">{{ all('tag').length }}</span>
      <div class="chips" style="margin-top:10px"><span v-for="t in all('tag')" :key="t.id" class="chip" style="font-size:13px"><span @click="canEdit && tagEdit(t.id)">#{{ t.title }}</span><span v-if="canEdit" class="x" @click="tagRm(t.id)">✕</span></span><span v-if="canEdit" class="chip add" @click="tagCreate">＋</span></div>
      <div class="muted" style="font-size:11px;margin-top:8px">Служебные: помогают поиску, на публичном сайте не выводятся. Удаление снимает тег со всех карточек.</div>
    </div>
    <div class="card"><b>Уровни доступа</b> <span class="muted" style="font-size:12px">{{ Object.keys(ACCESS).length }}</span>
      <div class="chips" style="margin-top:10px"><span v-for="(l, v) in ACCESS" :key="v" class="chip" style="font-size:13px;cursor:default">{{ l }}</span></div>
      <div class="muted" style="font-size:12px;margin-top:8px">Системный — уровни задаются логикой доступа.</div>
    </div>
  </div>
</template>
<style scoped>
.dlist{margin-top:10px;display:flex;flex-direction:column}
.drow{display:flex;align-items:center;gap:6px;border-top:1px solid var(--line);padding:6px 0;font-size:14px}
.dname{flex:1 1 auto;min-width:0}
.dname.ed{cursor:pointer}
.dname.ed:hover{color:var(--red)}
.dn{font-size:12px;min-width:22px;text-align:right}
.dbtn{border:1px solid var(--line);background:#fff;width:26px;height:24px;cursor:pointer;font:inherit;font-size:12px;padding:0}
.dbtn:hover:not(:disabled){border-color:var(--ink)}
.dbtn:disabled{opacity:.3;cursor:default}
.dbtn.x:hover{color:var(--red);border-color:var(--red)}
.dsub{padding:0 0 8px 22px}
.dsub .drow{font-size:13px}
</style>
