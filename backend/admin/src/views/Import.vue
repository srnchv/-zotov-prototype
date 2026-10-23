<script setup lang="ts">
// Импорт пачкой: шаг 1 — таблица Excel по шаблону → предпросмотр (ничего не пишется);
// шаг 2 — папка с фото (берутся только файлы из колонки «Файлы»); шаг 3 — загрузка: карточки и связи
// создаёт сервер, затем админка заливает файлы к созданным карточкам (первый файл — обложка). В конце — отчёт.
import { ref, computed } from "vue";
import { API, S, api, load, toast, canEdit, uploadFile, all } from "../lib/store";
import { TYPES, type Entity } from "../lib/model";
import Picker from "../components/Picker.vue";
type PlanRow = { sheet: string; row: number; type: string; title: string; action: "create" | "update" | "error"; id?: string; links: number; files: string[]; notes: string[] };
type Unresolved = { key: string; type: string; name: string; rows: string[]; similar: { id: string; title: string }[] };
type Plan = { rows: PlanRow[]; problems: string[]; creates: number; updates: number; errors: number; links: number; files: string[]; newDict: string[]; unresolved: Unresolved[] };
const xlsx = ref<File | null>(null), plan = ref<Plan | null>(null), busy = ref(""), done = ref<any>(null);
const inpX = ref<HTMLInputElement>(), inpDir = ref<HTMLInputElement>();
const folder = ref<Map<string, File>>(new Map());
const keyOf = (n: string) => n.trim().toLowerCase().normalize("NFC");
const ACT: Record<string, string> = { create: "создать", update: "обновить", error: "ошибка" };

// решения по ненайденным связям: key → id карточки | "new" | "" (пропустить); после каждого решения предпросмотр пересчитывается
const resolve = ref<Record<string, string>>({});
const resolvedTitle = (u: Unresolved) => { const v = resolve.value[u.key]; if (v === undefined) return ""; if (v === "new") return "создать новую карточку"; if (v === "") return "пропустить связь"; return "→ " + (S.db[v]?.title || v); };
const picking = ref<Unresolved | null>(null);
const pickItems = computed(() => (picking.value ? all(picking.value.type) : []) as Entity[]);
async function preview(f: File) {
  xlsx.value = f; done.value = null; busy.value = "Разбираем таблицу…";
  try { const fd = new FormData(); fd.append("file", f); fd.append("resolve", JSON.stringify(resolve.value)); plan.value = await api<Plan>("/import/preview", { method: "POST", body: fd }); }
  catch (e: any) { toast("Ошибка: " + e.message); plan.value = null; }
  busy.value = "";
}
async function setResolve(u: Unresolved, v: string) { resolve.value = { ...resolve.value, [u.key]: v }; picking.value = null; if (xlsx.value) await preview(xlsx.value); }
async function unsetResolve(key: string) { const r = { ...resolve.value }; delete r[key]; resolve.value = r; if (xlsx.value) await preview(xlsx.value); }
const decided = computed(() => Object.entries(resolve.value).filter(([k]) => !plan.value?.unresolved.some((u) => u.key === k)));
async function pickXlsx(ev: Event) {
  const f = (ev.target as HTMLInputElement).files?.[0]; (ev.target as HTMLInputElement).value = ""; if (!f) return;
  resolve.value = {}; await preview(f);
}
function addFiles(list: Iterable<File>) {
  const m = new Map(folder.value);
  for (const f of list) { if (f.name.startsWith(".")) continue; m.set(keyOf(f.name), f); }
  folder.value = m;
}
function pickDir(ev: Event) { folder.value = new Map(); addFiles((ev.target as HTMLInputElement).files || []); }
// перетаскивание: таблица .xlsx → шаг 1; папка или файлы изображений → шаг 2 (папка читается через webkitGetAsEntry)
const dragOver = ref(false);
async function readEntry(entry: any): Promise<File[]> {
  if (entry.isFile) return [await new Promise<File>((res, rej) => entry.file(res, rej))];
  if (entry.isDirectory) { const reader = entry.createReader(); const out: File[] = []; let batch: any[]; do { batch = await new Promise<any[]>((res, rej) => reader.readEntries(res, rej)); for (const e of batch) out.push(...(await readEntry(e))); } while (batch.length); return out; }
  return [];
}
async function onDrop(ev: DragEvent) {
  ev.preventDefault(); dragOver.value = false;
  const items = [...(ev.dataTransfer?.items || [])];
  const entries = items.map((i) => (i as any).webkitGetAsEntry?.()).filter(Boolean);
  const files: File[] = entries.length ? (await Promise.all(entries.map(readEntry))).flat() : [...(ev.dataTransfer?.files || [])];
  const table = files.find((f) => /\.xlsx$/i.test(f.name));
  const imgs = files.filter((f) => /\.(jpe?g|png|webp|tiff?|gif)$/i.test(f.name));
  if (table) { resolve.value = {}; await preview(table); }
  if (imgs.length) { addFiles(imgs); if (!plan.value) toast(`Папка принята: ${imgs.length} файлов. Теперь добавьте таблицу.`); }
  if (!table && !imgs.length) toast("Перетащите таблицу .xlsx или папку с фото");
}
// сверка файлов таблицы с папкой
const files = computed(() => {
  const need = plan.value?.files || [];
  const have = need.filter((n) => folder.value.has(keyOf(n))), miss = need.filter((n) => !folder.value.has(keyOf(n)));
  const extra = [...folder.value.keys()].filter((k) => !need.some((n) => keyOf(n) === k)).length;
  return { need, have, miss, extra };
});
const thumbs = new Map<string, string>();
const thumbOf = (n: string) => { const k = keyOf(n); if (!thumbs.has(k)) { const f = folder.value.get(k); if (f) thumbs.set(k, URL.createObjectURL(f)); } return thumbs.get(k) || ""; };
const cardOf = (n: string) => plan.value?.rows.filter((r) => r.files.some((x) => keyOf(x) === keyOf(n))).map((r) => r.title).join(", ") || "";
const canRun = computed(() => !!plan.value && plan.value.rows.some((r) => r.action !== "error") && !busy.value);
// очередь загрузки фото: превью из папки, статус по каждому файлу
type Up = { name: string; card: string; cardId: string; url: string; status: "wait" | "up" | "ok" | "fail" | "miss"; err?: string; cover: boolean };
const ups = ref<Up[]>([]);
const upStat = computed(() => ({ ok: ups.value.filter((u) => u.status === "ok").length, fail: ups.value.filter((u) => u.status === "fail").length, miss: ups.value.filter((u) => u.status === "miss").length, total: ups.value.length }));
const stage = ref<"" | "cards" | "files" | "done">("");

async function run() {
  if (!xlsx.value || !plan.value) return;
  stage.value = "cards"; busy.value = "Создаём карточки и связи…"; ups.value = [];
  try {
    const fd = new FormData(); fd.append("file", xlsx.value); fd.append("resolve", JSON.stringify(resolve.value));
    const r = await api<any>("/import/run", { method: "POST", body: fd });
    // очередь файлов по строкам результата: первый файл карточки — обложка; превью — из папки
    for (const row of r.rows) row.files.forEach((n: string, i: number) => { const f = folder.value.get(keyOf(n)); ups.value.push({ name: n, card: row.title, cardId: row.id, url: f ? URL.createObjectURL(f) : "", status: f ? "wait" : "miss", cover: i === 0 }); });
    stage.value = "files";
    for (const u of ups.value) {
      if (u.status !== "wait") continue;
      u.status = "up"; busy.value = `Загружаем фото: ${upStat.value.ok + upStat.value.fail + 1} из ${ups.value.filter((x) => x.status !== "miss").length}`;
      try {
        const m = await uploadFile(folder.value.get(keyOf(u.name))!, u.cardId);
        if (u.cover && m?.thumb) await api("/entities/" + u.cardId, { method: "PATCH", body: JSON.stringify({ payload: { cover: m.id, img: m.thumb, imgBig: m.med || m.thumb } }) });
        u.status = "ok";
      } catch (e: any) { u.status = "fail"; u.err = e.message; }
    }
    await load();
    done.value = r; stage.value = "done";
    plan.value = null; xlsx.value = null; folder.value = new Map(); resolve.value = {};
  } catch (e: any) { toast("Ошибка импорта: " + e.message); stage.value = ""; }
  busy.value = "";
}
const tplUrl = () => `${API}/import/template`;
async function downloadTpl() {
  try { const r = await fetch(tplUrl(), { headers: { authorization: "Bearer " + S.token } }); if (!r.ok) throw new Error("HTTP " + r.status); const b = await r.blob(); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "zotov-import.xlsx"; a.click(); }
  catch (e: any) { toast("Не удалось скачать шаблон: " + e.message); }
}
</script>
<template>
  <div @dragover.prevent="dragOver = true" @dragleave="dragOver = false" @drop="onDrop" :class="{ dropzone: true, over: dragOver }">
  <h1>Импорт</h1>
  <div class="muted" style="font-size:14px;margin:6px 0 14px;max-width:760px">Загрузка карточек пачкой: таблица Excel по шаблону и папка с фото. Связи между карточками задаются названиями, фото — именами файлов. Перед записью показывается, что именно изменится.</div>

  <div class="card"><b>Шаг 1. Таблица</b>
    <div class="muted" style="font-size:12px;margin:4px 0 10px">Скачайте шаблон (в нём лист «Инструкция» и списки справочников), заполните листы по типам карточек и загрузите файл обратно — кнопкой или перетащив на эту страницу (так же можно перетащить папку с фото). Повторная загрузка той же таблицы безопасна: существующие карточки обновятся, а не продублируются. Третья строка шаблона — пример, она пропускается; свои данные — с четвёртой.</div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <button class="btn sm" @click="downloadTpl">Скачать шаблон .xlsx</button>
      <input type="file" ref="inpX" accept=".xlsx" style="display:none" @change="pickXlsx">
      <button v-if="canEdit" class="btn dark" :disabled="!!busy" @click="inpX?.click()">Выбрать таблицу</button>
      <span v-if="xlsx" style="font-size:13px">{{ xlsx.name }}</span>
    </div>
  </div>

  <div v-if="plan" class="card" style="margin-top:16px"><b>Предпросмотр</b>
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin:8px 0;font-size:14px">
      <span>Создать: <b>{{ plan.creates }}</b></span><span>Обновить: <b>{{ plan.updates }}</b></span><span>Связей: <b>{{ plan.links }}</b></span>
      <span :style="plan.errors ? 'color:#9a2e2e' : ''">С ошибками (пропустим): <b>{{ plan.errors }}</b></span>
      <span v-if="plan.unresolved.length" style="color:#9a2e2e">Ненайденных связей: <b>{{ plan.unresolved.length }}</b></span>
      <span v-if="plan.newDict.length">Новых значений справочников: <b>{{ plan.newDict.length }}</b></span>
    </div>
    <div v-for="p in plan.problems" :key="p" class="admbar warn" style="margin:4px 0">{{ p }}</div>
    <div v-if="plan.unresolved.length || decided.length" class="metabox" style="margin:10px 0;padding:10px 12px">
      <b style="font-size:14px">Связи, которых нет в архиве и в файле</b>
      <div class="muted" style="font-size:12px;margin:2px 0 8px">Для каждого названия выберите карточку из архива, создайте новую или пропустите связь. Без решения связь не создастся, сама карточка загрузится.</div>
      <div v-for="u in plan.unresolved" :key="u.key" class="r" style="padding:8px 0;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div style="flex:1 1 260px;min-width:0"><b>{{ u.name }}</b> <span class="muted" style="font-size:12px">{{ TYPES[u.type]?.l }} · {{ u.rows.join(", ") }}</span>
          <div v-if="u.similar.length" style="font-size:12px;margin-top:4px">Похоже на: <template v-for="(sm, i) in u.similar" :key="sm.id"><a style="cursor:pointer;text-decoration:underline" @click="setResolve(u, sm.id)">{{ sm.title }}</a><span v-if="i < u.similar.length - 1">, </span></template></div></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" @click="picking = u">Выбрать карточку</button><button class="btn sm" @click="setResolve(u, 'new')">Создать новую</button><button class="btn sm" @click="setResolve(u, '')">Пропустить</button></div>
      </div>
      <div v-for="[k, v] in decided" :key="k" class="r" style="padding:6px 0;font-size:13px"><span>{{ k.slice(k.indexOf('|') + 1) }} — {{ v === 'new' ? 'создать новую карточку' : v === '' ? 'пропустить связь' : '→ ' + (S.db[v]?.title || v) }}</span><span class="x muted" style="cursor:pointer" title="Отменить решение" @click="unsetResolve(k)">✕</span></div>
    </div>
    <table class="atable" style="margin-top:8px;font-size:13px">
      <thead><tr><th>Лист</th><th>Стр.</th><th>Название</th><th>Действие</th><th>Связи</th><th>Файлы</th><th>Примечания</th></tr></thead>
      <tbody><tr v-for="r in plan.rows" :key="r.sheet + r.row" :style="r.action === 'error' ? 'color:#9a2e2e' : ''">
        <td>{{ r.sheet }}</td><td>{{ r.row }}</td><td>{{ r.title }}</td>
        <td>{{ ACT[r.action] }}<router-link v-if="r.id" :to="'/edit/' + r.id" class="muted" style="margin-left:6px;font-size:12px">открыть</router-link></td>
        <td>{{ r.links || "" }}</td><td>{{ r.files.join(", ") }}</td><td>{{ r.notes.join("; ") }}</td>
      </tr></tbody>
    </table>
  </div>

  <div v-if="plan" class="card" style="margin-top:16px"><b>Шаг 2. Папка с фото</b> <span class="muted" style="font-size:12px">— необязательно</span>
    <div class="muted" style="font-size:12px;margin:4px 0 10px">Одна папка без вложенных; имена латиницей, без пробелов, как в колонке «Файлы». Из папки берутся только файлы, упомянутые в таблице; первый файл строки станет обложкой.</div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <input type="file" ref="inpDir" webkitdirectory directory multiple style="display:none" @change="pickDir">
      <button class="btn sm" :disabled="!!busy" @click="inpDir?.click()">Выбрать папку</button>
      <span v-if="files.need.length" style="font-size:13px">В таблице файлов: {{ files.need.length }} · найдено в папке: {{ files.have.length }}<template v-if="files.extra"> · в папке лишних (не загрузятся): {{ files.extra }}</template></span>
      <span v-else class="muted" style="font-size:13px">В таблице нет колонки «Файлы» с именами — папка не нужна.</span>
    </div>
    <div v-if="files.miss.length" class="admbar warn" style="margin:8px 0 0">Нет в папке: {{ files.miss.join(", ") }}</div>
    <div v-if="files.have.length" class="upgrid" style="margin-top:12px">
      <div v-for="n in files.have" :key="n" class="upitem"><div class="upthumb"><img :src="thumbOf(n)" alt=""></div><div class="upname" :title="n">{{ n }}</div><div class="upcard">{{ cardOf(n) }}</div></div>
    </div>
  </div>

  <div v-if="plan" class="card" style="margin-top:16px"><b>Шаг 3. Загрузка</b>
    <div style="font-size:14px;margin:8px 0">Будет создано <b>{{ plan.creates }}</b>, обновлено <b>{{ plan.updates }}</b>, связей <b>{{ plan.links }}</b><template v-if="plan.errors">, строк с ошибками пропущено <b>{{ plan.errors }}</b></template><template v-if="plan.unresolved.length">, ненайденных связей без решения <b>{{ plan.unresolved.length }}</b> (не создадутся)</template>.
      Фото: <b>{{ files.have.length }}</b> из {{ files.need.length }}<template v-if="files.miss.length">, <span style="color:#9a2e2e">{{ files.miss.length }} нет в папке</span></template>.</div>
    <div style="display:flex;gap:12px;align-items:center"><button class="btn dark" :disabled="!canRun" @click="run">{{ busy ? busy : "Загрузить в архив" }}</button></div>
  </div>
  <div v-if="stage === 'cards'" class="card" style="margin-top:16px"><b>Создаём карточки и связи…</b><div class="muted" style="font-size:12px;margin-top:4px">Обычно несколько секунд.</div></div>

  <div v-if="ups.length" class="card" style="margin-top:16px"><b>{{ stage === 'files' ? 'Загружаем фото' : 'Фото' }}</b> <span class="muted" style="font-size:12px">загружено {{ upStat.ok }} из {{ upStat.total - upStat.miss }}<template v-if="upStat.fail"> · <span style="color:#9a2e2e">ошибок {{ upStat.fail }}</span></template><template v-if="upStat.miss"> · нет в папке {{ upStat.miss }}</template></span>
    <div style="background:var(--fill);height:6px;margin:8px 0 12px"><div style="background:var(--ink);height:6px;transition:width .3s" :style="{ width: Math.round(((upStat.ok + upStat.fail) / Math.max(1, upStat.total - upStat.miss)) * 100) + '%' }"></div></div>
    <div class="upgrid">
      <div v-for="u in ups" :key="u.cardId + u.name" class="upitem" :class="u.status">
        <div class="upthumb"><img v-if="u.url" :src="u.url" alt=""><span v-else class="muted">нет файла</span><i v-if="u.cover" title="Обложка">★</i></div>
        <div class="upname" :title="u.name">{{ u.name }}</div>
        <div class="muted upcard" :title="u.card">{{ u.card }}</div>
        <div class="upst">{{ u.status === 'ok' ? 'загружено' : u.status === 'up' ? 'загружается…' : u.status === 'wait' ? 'в очереди' : u.status === 'miss' ? 'нет в папке' : 'ошибка: ' + u.err }}</div>
      </div>
    </div>
  </div>
  <div v-if="done" class="card" style="margin-top:16px"><b>Готово</b>
    <div style="font-size:14px;margin-top:8px">Создано: <b>{{ done.created }}</b> · обновлено: <b>{{ done.updated }}</b> · связей: <b>{{ done.linked }}</b> · фото загружено: <b>{{ upStat.ok }}</b><template v-if="upStat.fail"> · <span style="color:#9a2e2e">не загрузилось: {{ upStat.fail }}</span></template><template v-if="done.skipped"> · пропущено строк с ошибками: <b>{{ done.skipped }}</b></template></div>
    <div class="muted" style="font-size:12px;margin-top:8px">Карточки: <template v-for="(r, i) in done.rows" :key="r.id"><router-link :to="'/edit/' + r.id">{{ r.title }}</router-link><span v-if="i < done.rows.length - 1">, </span></template></div>
    <div class="muted" style="font-size:12px;margin-top:6px">Все изменения записаны в журнал с пометкой «импорт». Карточки — в разделе «Сущности».</div>
  </div>
  <div v-if="dragOver" class="dropHint">Отпустите: таблица .xlsx или папка с фото</div>
  </div>
  <Picker v-if="picking" :title="`${TYPES[picking.type]?.l}: «${picking.name}»`" :items="pickItems" @pick="(o) => setResolve(picking!, o.id)" @close="picking = null" />
</template>
<style scoped>
.upgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.upitem{font-size:12px;line-height:16px}
.upthumb{position:relative;aspect-ratio:1;background:var(--fill);display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:4px;border:2px solid transparent}
.upthumb img{width:100%;height:100%;object-fit:cover;display:block}
.upthumb i{position:absolute;right:4px;top:2px;color:#fff;text-shadow:0 0 3px #000;font-style:normal}
.upitem.ok .upthumb{border-color:#2a8c4a}
.upitem.fail .upthumb{border-color:#9a2e2e}
.upitem.up .upthumb{border-color:var(--ink)}
.upitem.up .upthumb img{opacity:.5}
.upname,.upcard{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.upst{color:var(--muted)}
.upitem.ok .upst{color:#2a8c4a}
.upitem.fail .upst{color:#9a2e2e;white-space:normal}
.dropzone{position:relative;min-height:60vh}
.dropzone.over::after{content:"";position:absolute;inset:-8px;border:2px dashed var(--ink);background:rgba(255,255,255,.6);pointer-events:none}
.dropHint{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:var(--ink);color:#fff;padding:14px 22px;font-size:15px;z-index:50;pointer-events:none}
</style>
