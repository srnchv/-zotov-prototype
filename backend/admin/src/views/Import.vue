<script setup lang="ts">
// Импорт пачкой: шаг 1 — таблица Excel по шаблону → предпросмотр (ничего не пишется);
// шаг 2 — папка с фото (берутся только файлы из колонки «Файлы»); шаг 3 — загрузка: карточки и связи
// создаёт сервер, затем админка заливает файлы к созданным карточкам (первый файл — обложка). В конце — отчёт.
import { ref, computed } from "vue";
import { API, S, api, load, toast, canEdit, uploadFile, all } from "../lib/store";
import { TYPES, type Entity } from "../lib/model";
import Picker from "../components/Picker.vue";
type FileSpec = { name: string; caption?: string; author?: string; year?: string };
type PlanRow = { sheet: string; row: number; type: string; title: string; action: "create" | "update" | "error"; id?: string; links: number; files: FileSpec[]; notes: string[]; fields: string[] };
const capOf = (f: FileSpec) => [f.caption, [f.author, f.year].filter(Boolean).join(", ")].filter(Boolean).join(" — ");
type Unresolved = { key: string; type: string; name: string; rows: string[]; similar: { id: string; title: string }[] };
type Plan = { rows: PlanRow[]; problems: string[]; creates: number; updates: number; errors: number; links: number; files: string[]; newDict: string[]; unresolved: Unresolved[] };
const xlsx = ref<File | null>(null), plan = ref<Plan | null>(null), busy = ref(""), done = ref<any>(null);
const inpX = ref<HTMLInputElement>(), inpDir = ref<HTMLInputElement>();
const folder = ref<Map<string, File>>(new Map());
const keyOf = (n: string) => n.trim().toLowerCase().normalize("NFC");
// мягкое сопоставление имени из таблицы с файлом в папке: регистр, расширение (в таблице можно без него),
// пробелы/подчёркивания/дефисы не важны: «Rodchenko Gallery Picture (1)» найдёт «rodchenko_gallery_picture (1).jpg»
const loose = (n: string) => keyOf(n).replace(/\.(jpe?g|png|webp|tiff?|gif|mp4|mov|webm|avi|m4v|mp3|wav|m4a|ogg|flac|aac|pdf|docx?|txt)$/i, "").replace(/[\s_\-]+/g, "");
// все файлы по имени из таблицы: точное имя; имя без расширения; код объекта — все файлы, начинающиеся с него
// («m0004» → m0004-h.jpg, m0004-n1.jpg, m0004-n2.jpg; исторические «-h» идут первыми и становятся обложкой)
const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
function findFiles(n: string): File[] {
  const exact = folder.value.get(keyOf(n)); if (exact) return [exact];
  const want = loose(n); if (!want) return [];
  const same = [...folder.value.values()].filter((f) => loose(f.name) === want);
  if (same.length) return same.slice(0, 1);
  const pref = [...folder.value.values()].filter((f) => { const k = loose(f.name); return k.startsWith(want) && !/^\d/.test(k.slice(want.length)) && kindOf(f.name) !== "subs"; });
  return pref.sort((a, b) => natural(a.name, b.name));
}
function findFile(n: string): File | undefined { return findFiles(n)[0]; }
const ACT: Record<string, string> = { create: "создать", update: "обновить", error: "ошибка" };

// решения по ненайденным связям: key → id карточки | "new" | "" (пропустить); после каждого решения предпросмотр пересчитывается
const resolve = ref<Record<string, string>>({});
const resolvedTitle = (u: Unresolved) => { const v = resolve.value[u.key]; if (v === undefined) return ""; if (v === "new") return "создать новую карточку"; if (v === "") return "пропустить связь"; return "→ " + (S.db[v]?.title || v); };
const picking = ref<Unresolved | null>(null);
const pickItems = computed(() => (picking.value ? all(picking.value.type) : []) as Entity[]);
// --- сопоставление колонок: таблица не по шаблону → сервер показывает листы и заголовки с догадкой, редактор правит, выбор запоминается
type Target = { key: string; label: string };
type InspSheet = { name: string; headers: string[]; sample: string[][]; rows: number; template: boolean; guess: { type: string; cols: Record<string, string> } };
type Inspect = { sheets: InspSheet[]; targets: Record<string, Target[]> };
const insp = ref<Inspect | null>(null);
const mapping = ref<Record<string, { on: boolean; type: string; cols: Record<string, string>; template: boolean; dirty: boolean }>>({});
const MAP_TYPES = ["material", "person", "place", "event", "theme", "project", "collection", "org", "source"];
const memKey = (sh: InspSheet) => "zotov-import-map:" + sh.headers.map((h) => h.trim().toLowerCase()).join("|");
function setupMapping(i: Inspect) {
  const m: typeof mapping.value = {};
  let firstFree = true;
  for (const sh of i.sheets) {
    if (sh.template) { // лист по шаблону: колонки сопоставлены по названиям, показываем свёрнуто для проверки
      const byLabel = new Map((i.targets[sh.guess.type] || []).map((t) => [t.label.trim().toLowerCase(), t.key]));
      m[sh.name] = { on: true, type: sh.guess.type, cols: Object.fromEntries(sh.headers.map((h) => [h, byLabel.get(h.trim().toLowerCase()) || ""])), template: true, dirty: false };
      continue;
    }
    let saved: { type: string; cols: Record<string, string> } | null = null;
    try { saved = JSON.parse(localStorage.getItem(memKey(sh)) || "null"); } catch {}
    m[sh.name] = { on: firstFree, type: saved?.type || sh.guess.type, cols: { ...(saved?.cols || sh.guess.cols) }, template: false, dirty: false }; firstFree = false; // по умолчанию — только первый лист
  }
  mapping.value = m;
}
const markDirty = (name: string) => { const m = mapping.value[name]; if (m) m.dirty = true; };
function setType(sh: InspSheet, type: string) { mapping.value[sh.name] = { on: true, type, cols: {}, template: false, dirty: true }; reguess(sh, type); }
async function reguess(sh: InspSheet, type: string) {
  // догадка для другого типа: те же синонимы, но доступные поля другие — просим сервер (повторный inspect дёшев)
  const cur = mapping.value[sh.name]; if (!cur) return;
  const allowed = new Set((insp.value?.targets[type] || []).map((t) => t.key));
  cur.cols = Object.fromEntries(sh.headers.map((h) => [h, allowed.has(sh.guess.cols[h] || "") ? sh.guess.cols[h] : ""]));
}
const mappingJson = () => { const out: Record<string, { type: string; cols: Record<string, string> }> = {}; for (const [n, m] of Object.entries(mapping.value)) if (m.on && (!m.template || m.dirty)) out[n] = { type: m.type, cols: m.cols }; return out; };
// сопоставление нужно, если есть листы не по шаблону или шаблонный лист правили; выключенные шаблонные листы тоже требуют mapping (иначе загрузятся)
// когда mapping отправляется, сервер берёт только перечисленные листы — значит, шаблонные тоже надо перечислить
const allMappingJson = () => { const out: Record<string, { type: string; cols: Record<string, string> }> = {}; for (const [n, m] of Object.entries(mapping.value)) if (m.on) out[n] = { type: m.type, cols: m.cols }; return out; };
const needMapping = computed(() => !!insp.value && (insp.value.sheets.some((sh) => !sh.template) || Object.values(mapping.value).some((m) => m.template && (m.dirty || !m.on))));
const mappingOk = computed(() => Object.values(mapping.value).some((m) => m.on && Object.values(m.cols).includes("title")));
void mappingJson;
const mapStage = ref(false); // показываем экран сопоставления (до предпросмотра или по кнопке «изменить»)
// колонка с именами файлов — одна на лист (выбирается отдельно, чтобы не искать «Файлы» в длинном списке полей)
const filesCol = (sh: InspSheet) => sh.headers.find((h) => mapping.value[sh.name]?.cols[h] === "files") || "";
function setFilesCol(sh: InspSheet, h: string) { const m = mapping.value[sh.name]; if (!m) return; for (const x of sh.headers) if (m.cols[x] === "files") m.cols[x] = ""; if (h) m.cols[h] = "files"; }
function sampleOf(sh: InspSheet, h: string) { const i = sh.headers.indexOf(h); return sh.sample.map((r) => r[i]).filter(Boolean).slice(0, 2).join(" · "); }
async function start(f: File) {
  xlsx.value = f; done.value = null; plan.value = null; insp.value = null; busy.value = "Читаем таблицу…";
  try { const fd = new FormData(); fd.append("file", f); insp.value = await api<Inspect>("/import/inspect", { method: "POST", body: fd }); }
  catch (e: any) { toast("Ошибка: " + e.message); busy.value = ""; return; }
  busy.value = "";
  if (!insp.value.sheets.length) { toast("В таблице нет заполненных листов"); return; }
  setupMapping(insp.value);
  if (insp.value.sheets.some((sh) => !sh.template)) { mapStage.value = true; } else { mapStage.value = false; await preview(f); }
}
async function applyMappingAndPreview() {
  if (!xlsx.value || !insp.value) return;
  for (const sh of insp.value.sheets) { const m = mapping.value[sh.name]; if (m?.on) try { localStorage.setItem(memKey(sh), JSON.stringify({ type: m.type, cols: m.cols })); } catch {} }
  mapStage.value = false; await preview(xlsx.value);
}
async function preview(f: File) {
  xlsx.value = f; done.value = null; busy.value = "Разбираем таблицу…";
  try { const fd = new FormData(); fd.append("file", f); fd.append("resolve", JSON.stringify(resolve.value)); if (needMapping.value) fd.append("mapping", JSON.stringify(allMappingJson())); plan.value = await api<Plan>("/import/preview", { method: "POST", body: fd }); }
  catch (e: any) { toast("Ошибка: " + e.message); plan.value = null; }
  busy.value = "";
}
async function setResolve(u: Unresolved, v: string) { resolve.value = { ...resolve.value, [u.key]: v }; picking.value = null; if (xlsx.value) await preview(xlsx.value); }
async function unsetResolve(key: string) { const r = { ...resolve.value }; delete r[key]; resolve.value = r; if (xlsx.value) await preview(xlsx.value); }
const decided = computed(() => Object.entries(resolve.value).filter(([k]) => !plan.value?.unresolved.some((u) => u.key === k)));
async function pickXlsx(ev: Event) {
  const f = (ev.target as HTMLInputElement).files?.[0]; (ev.target as HTMLInputElement).value = ""; if (!f) return;
  resolve.value = {}; await start(f);
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
  const imgs = files.filter((f) => kindOf(f.name) !== "other");
  if (table) { resolve.value = {}; await start(table); }
  if (imgs.length) { addFiles(imgs); if (!plan.value) toast(`Папка принята: ${imgs.length} файлов. Теперь добавьте таблицу.`); }
  if (!table && !imgs.length) toast("Перетащите таблицу .xlsx или папку с файлами");
}
// сверка файлов таблицы с папкой
const files = computed(() => {
  const need = plan.value?.files || [];
  const have = need.filter((n) => findFiles(n).length), miss = need.filter((n) => !findFiles(n).length);
  const used = new Set(have.flatMap((n) => findFiles(n)));
  const extra = [...folder.value.values()].filter((f) => !used.has(f) && kindOf(f.name) !== "subs").length;
  return { need, have, miss, extra };
});
const thumbs = new Map<string, string>();
const fileUrls = new Map<File, string>();
const urlOf = (f: File) => { if (!fileUrls.has(f)) fileUrls.set(f, URL.createObjectURL(f)); return fileUrls.get(f)!; };
const thumbOf = (n: string) => { const k = keyOf(n); if (!thumbs.has(k)) { const f = findFile(n); if (f) thumbs.set(k, URL.createObjectURL(f)); } return thumbs.get(k) || ""; };
const cardOf = (n: string) => plan.value?.rows.filter((r) => r.files.some((x) => keyOf(x.name) === keyOf(n))).map((r) => r.title).join(", ") || "";
const specOf = (n: string) => plan.value?.rows.flatMap((r) => r.files).find((x) => keyOf(x.name) === keyOf(n));
const canRun = computed(() => !!plan.value && plan.value.rows.some((r) => r.action !== "error") && !busy.value);
// очередь загрузки фото: превью из папки, статус по каждому файлу
type Up = { name: string; card: string; cardId: string; url: string; status: "wait" | "up" | "ok" | "fail" | "miss"; err?: string; cover: boolean; kind: string; subs: { file: File; lang: string }[]; spec: FileSpec; file?: File };
// вид файла по расширению: фото, видео, аудио, документ
const extOf = (n: string) => (n.split(".").pop() || "").toLowerCase();
const kindOf = (n: string) => { const e = extOf(n); return ["jpg", "jpeg", "png", "webp", "tif", "tiff", "gif"].includes(e) ? "image" : ["mp4", "mov", "webm", "avi", "m4v"].includes(e) ? "video" : ["mp3", "wav", "m4a", "ogg", "flac", "aac"].includes(e) ? "audio" : ["pdf", "doc", "docx", "txt"].includes(e) ? "doc" : ["srt", "vtt"].includes(e) ? "subs" : "other"; };
const KIND_L: Record<string, string> = { image: "фото", video: "видео", audio: "аудио", doc: "документ", subs: "субтитры", other: "файл" };
// субтитры к видео/аудио берутся из папки по имени: <файл>.ru.srt, <файл>.en.vtt или <файл>.srt (русский)
function subsFor(name: string): { file: File; lang: string }[] {
  const f = findFile(name); const base = loose(f ? f.name : name); const out: { file: File; lang: string }[] = [];
  for (const [k, sf] of folder.value) { const m = k.match(/^(.+?)(?:\.([a-z]{2}))?\.(srt|vtt)$/); if (m && loose(m[1]) === base) out.push({ file: sf, lang: m[2] || "ru" }); }
  return out;
}
const ups = ref<Up[]>([]);
const upStat = computed(() => ({ ok: ups.value.filter((u) => u.status === "ok").length, fail: ups.value.filter((u) => u.status === "fail").length, miss: ups.value.filter((u) => u.status === "miss").length, total: ups.value.length }));
const stage = ref<"" | "cards" | "files" | "done">("");

async function run() {
  if (!xlsx.value || !plan.value) return;
  stage.value = "cards"; busy.value = "Создаём карточки и связи…"; ups.value = [];
  try {
    const fd = new FormData(); fd.append("file", xlsx.value); fd.append("resolve", JSON.stringify(resolve.value)); if (needMapping.value) fd.append("mapping", JSON.stringify(allMappingJson()));
    const r = await api<any>("/import/run", { method: "POST", body: fd });
    // очередь файлов по строкам результата: первый файл карточки — обложка; превью — из папки
    for (const row of r.rows) { let coverSet = false; for (const sp of row.files as FileSpec[]) {
      const found = findFiles(sp.name);
      if (!found.length) { ups.value.push({ name: sp.name, card: row.title, cardId: row.id, url: "", status: "miss", cover: false, kind: kindOf(sp.name), subs: [], spec: sp, file: undefined }); continue; }
      for (const f of found) { const k = kindOf(f.name); const cover = !coverSet && k === "image"; if (cover) coverSet = true; ups.value.push({ name: f.name, card: row.title, cardId: row.id, url: k === "image" ? URL.createObjectURL(f) : "", status: "wait", cover, kind: k, subs: k === "video" || k === "audio" ? subsFor(f.name) : [], spec: sp, file: f }); }
    } }
    stage.value = "files";
    for (const u of ups.value) {
      if (u.status !== "wait") continue;
      u.status = "up"; busy.value = `Загружаем фото: ${upStat.value.ok + upStat.value.fail + 1} из ${ups.value.filter((x) => x.status !== "miss").length}`;
      try {
        const m = await uploadFile(u.file!, u.cardId);
        // подпись файла из таблицы: название, автор, год
        const meta: Record<string, string> = {}; if (u.spec.caption) meta.caption = u.spec.caption; if (u.spec.author) meta.author = u.spec.author; if (u.spec.year) meta.year = u.spec.year;
        if (Object.keys(meta).length) await api("/entities/" + m.id, { method: "PATCH", body: JSON.stringify({ payload: meta }) });
        if (u.cover && m?.thumb) await api("/entities/" + u.cardId, { method: "PATCH", body: JSON.stringify({ payload: { cover: m.id, img: m.thumb, imgBig: m.med || m.thumb } }) });
        for (const sb of u.subs) { const fd = new FormData(); fd.append("file", sb.file); fd.append("lang", sb.lang); await api(`/media/${m.id}/subtitles`, { method: "POST", body: fd }); }
        u.status = "ok";
      } catch (e: any) { u.status = "fail"; u.err = e.message; }
    }
    await load();
    done.value = r; stage.value = "done";
    plan.value = null; xlsx.value = null; folder.value = new Map(); resolve.value = {}; insp.value = null; mapStage.value = false;
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
  <div class="muted" style="font-size:14px;margin:6px 0 14px;max-width:760px">Загрузка карточек пачкой: таблица Excel по шаблону и папка с фото. Связи между карточками задаются названиями, файлы (фото, видео, аудио, PDF, субтитры) — именами файлов. Перед записью показывается, что именно изменится.</div>

  <div class="card"><b>Шаг 1. Таблица</b>
    <div class="muted" style="font-size:12px;margin:4px 0 10px">Скачайте шаблон (в нём лист «Инструкция» и списки справочников), заполните листы по типам карточек и загрузите файл обратно — кнопкой или перетащив на эту страницу (так же можно перетащить папку с фото). Повторная загрузка той же таблицы безопасна: существующие карточки обновятся, а не продублируются. Третья строка шаблона — пример, она пропускается; свои данные — с четвёртой.</div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <button class="btn sm" @click="downloadTpl">Скачать шаблон .xlsx</button>
      <input type="file" ref="inpX" accept=".xlsx" style="display:none" @change="pickXlsx">
      <button v-if="canEdit" class="btn dark" :disabled="!!busy" @click="inpX?.click()">Выбрать таблицу</button>
      <span v-if="xlsx" style="font-size:13px">{{ xlsx.name }}</span>
    </div>
  </div>

  <div v-if="insp && mapStage" class="card" style="margin-top:16px"><b>Сопоставление колонок</b>
    <div class="muted" style="font-size:12px;margin:4px 0 12px;max-width:760px">Укажите, какой тип карточек на каждом листе и куда идёт каждая колонка. Что удалось угадать — уже проставлено. Две колонки в одно поле допустимы: годы «с» и «по» склеятся в «1926–1927», остальное — через «;». Выбор запомнится для таблиц с такой же шапкой.</div>
    <div v-if="insp.sheets.filter(x => !x.template).length > 1" style="margin-bottom:14px;font-size:14px"><b>Какие листы загружать:</b>
      <label v-for="sh in insp.sheets.filter(x => !x.template)" :key="sh.name" style="display:inline-flex;gap:6px;align-items:center;margin-left:16px"><input type="checkbox" v-model="mapping[sh.name].on"> {{ sh.name }} <span class="muted">({{ sh.rows }})</span></label></div>
    <div v-for="sh in insp.sheets.filter(x => !x.template && mapping[x.name].on)" :key="sh.name" style="margin-bottom:18px">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <span style="font-size:14px"><b>{{ sh.name }}</b> <span class="muted">· {{ sh.rows }} строк · тип карточек:</span></span>
        <select class="sel inline" :disabled="!mapping[sh.name].on" :value="mapping[sh.name].type" @change="setType(sh, ($event.target as HTMLSelectElement).value)"><option v-for="t in MAP_TYPES" :key="t" :value="t">{{ TYPES[t].pl }}</option></select>
      </div>
      <div v-if="mapping[sh.name].on" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px;font-size:13px">
        <span>Имена файлов (фото, видео, PDF) брать из колонки:</span>
        <select class="sel inline" :value="filesCol(sh)" @change="setFilesCol(sh, ($event.target as HTMLSelectElement).value)"><option value="">— файлов нет —</option><option v-for="h in sh.headers.filter(Boolean)" :key="h" :value="h">{{ h }}</option></select>
        <span class="muted" style="font-size:12px">имя файла или его начало: «m0004» подхватит m0004-h.jpg, m0004-n1.jpg…</span>
      </div>
      <table v-if="mapping[sh.name].on" class="atable" style="margin-top:8px;font-size:13px">
        <thead><tr><th style="width:26%">Колонка в файле</th><th>Примеры значений</th><th style="width:30%">Поле архива</th></tr></thead>
        <tbody><tr v-for="h in sh.headers.filter(Boolean)" :key="h">
          <td><b>{{ h }}</b></td><td class="muted" style="font-size:12px">{{ sampleOf(sh, h) }}</td>
          <td><select class="sel inline" style="width:100%" v-model="mapping[sh.name].cols[h]"><option value="">— не загружать —</option><option v-for="t in insp.targets[mapping[sh.name].type].filter(t => t.key !== 'files')" :key="t.key" :value="t.key">{{ t.label }}</option><option v-if="mapping[sh.name].cols[h] === 'files'" value="files">Файлы</option></select></td>
        </tr></tbody>
      </table>
      <div v-if="mapping[sh.name].on && !Object.values(mapping[sh.name].cols).includes('title')" class="admbar err" style="margin-top:6px">Нужно указать, какая колонка — «Название»</div>
    </div>
    <details v-for="sh in insp.sheets.filter(x => x.template)" :key="sh.name" style="margin-bottom:10px">
      <summary style="cursor:pointer;font-size:13px"><b>{{ sh.name }}</b> <span class="muted">· {{ sh.rows }} строк · по шаблону, колонки сопоставлены по названиям — развернуть для проверки</span></summary>
      <label style="display:flex;gap:6px;align-items:center;font-size:13px;margin:8px 0"><input type="checkbox" v-model="mapping[sh.name].on" @change="markDirty(sh.name)"> загружать этот лист</label>
      <table class="atable" style="font-size:13px"><thead><tr><th style="width:26%">Колонка в файле</th><th>Примеры значений</th><th style="width:30%">Поле архива</th></tr></thead>
        <tbody><tr v-for="h in sh.headers.filter(Boolean)" :key="h"><td><b>{{ h }}</b></td><td class="muted" style="font-size:12px">{{ sampleOf(sh, h) }}</td>
          <td><select class="sel inline" style="width:100%" v-model="mapping[sh.name].cols[h]" @change="markDirty(sh.name)"><option value="">— не загружать —</option><option v-for="t in insp.targets[sh.guess.type]" :key="t.key" :value="t.key">{{ t.label }}</option></select></td></tr></tbody></table>
    </details>
    <button class="btn dark" :disabled="!mappingOk || !!busy" @click="applyMappingAndPreview">Продолжить к предпросмотру</button>
  </div>

  <div v-if="plan" class="card" style="margin-top:16px"><b>Предпросмотр</b>
    <div v-if="insp" style="margin:6px 0"><span class="lnk" style="font-size:13px" @click="mapStage = true; plan = null">{{ needMapping ? "← изменить сопоставление колонок" : "← проверить сопоставление колонок (всё по шаблону)" }}</span></div>
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
      <thead><tr><th>Лист</th><th>Стр.</th><th>Название</th><th>Действие</th><th>Поля</th><th>Связи</th><th>Файлы</th><th>Примечания</th></tr></thead>
      <tbody><tr v-for="r in plan.rows" :key="r.sheet + r.row" :style="r.action === 'error' ? 'color:#9a2e2e' : ''">
        <td>{{ r.sheet }}</td><td>{{ r.row }}</td><td>{{ r.title }}</td>
        <td>{{ ACT[r.action] }}<router-link v-if="r.id" :to="'/edit/' + r.id" class="muted" style="margin-left:6px;font-size:12px">открыть</router-link></td>
        <td class="muted" style="font-size:12px">{{ (r.fields || []).join(", ") }}</td><td>{{ r.links || "" }}</td><td>{{ r.files.map(f => f.name).join(", ") }}</td><td>{{ r.notes.join("; ") }}</td>
      </tr></tbody>
    </table>
  </div>

  <div v-if="plan" class="card" style="margin-top:16px"><b>Шаг 2. Папка с файлами</b> <span class="muted" style="font-size:12px">— необязательно</span>
    <div class="muted" style="font-size:12px;margin:4px 0 10px">Фото, видео, аудио, PDF — одной папкой; имена латиницей, без пробелов, как в колонке «Файлы». Берутся только файлы из таблицы; первое фото строки станет обложкой. Подпись файла на сайте (название, автор, год) задаётся в таблице через «|» после имени. Субтитры к видео и аудио кладите рядом с тем же именем: <code>film.mp4</code> → <code>film.ru.srt</code>, <code>film.en.vtt</code> (в таблицу их писать не нужно).</div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <input type="file" ref="inpDir" webkitdirectory directory multiple style="display:none" @change="pickDir">
      <button class="btn sm" :disabled="!!busy" @click="inpDir?.click()">Выбрать папку</button>
      <span v-if="files.need.length" style="font-size:13px">В таблице файлов: {{ files.need.length }} · найдено в папке: {{ files.have.length }}<template v-if="files.have.flatMap(findFiles).length > files.have.length"> ({{ files.have.flatMap(findFiles).length }} файлов — по кодам)</template><template v-if="files.extra"> · в папке лишних (не загрузятся): {{ files.extra }}</template></span>
      <span v-else class="muted" style="font-size:13px">В колонке «Файлы» нет имён — папка не нужна.</span>
    </div>
    <div v-if="folder.size && files.miss.length" class="admbar warn" style="margin:8px 0 0">Нет в папке: {{ files.miss.join(", ") }}</div>
    <div v-if="files.have.length" class="upgrid" style="margin-top:12px">
      <template v-for="n in files.have" :key="n"><div v-for="f in findFiles(n)" :key="f.name" class="upitem"><div class="upthumb"><img v-if="kindOf(f.name) === 'image'" :src="urlOf(f)" alt=""><span v-else class="muted">{{ KIND_L[kindOf(f.name)] }}<template v-if="subsFor(f.name).length"><br>+ субтитры ({{ subsFor(f.name).map(x => x.lang).join(', ') }})</template></span></div><div class="upname" :title="f.name">{{ f.name }}</div><div class="upcard">{{ cardOf(n) }}</div><div v-if="specOf(n) && capOf(specOf(n)!)" class="upcap">{{ capOf(specOf(n)!) }}</div></div></template>
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
        <div class="upthumb"><img v-if="u.url" :src="u.url" alt=""><span v-else class="muted">{{ u.status === 'miss' ? 'нет файла' : KIND_L[u.kind] }}<template v-if="u.subs.length"><br>+ субтитры ({{ u.subs.map(x => x.lang).join(', ') }})</template></span><i v-if="u.cover" title="Обложка">★</i></div>
        <div class="upname" :title="u.name">{{ u.name }}</div>
        <div class="muted upcard" :title="u.card">{{ u.card }}</div>
        <div v-if="capOf(u.spec)" class="upcap">{{ capOf(u.spec) }}</div>
        <div class="upst">{{ u.status === 'ok' ? 'загружено' : u.status === 'up' ? 'загружается…' : u.status === 'wait' ? 'в очереди' : u.status === 'miss' ? 'нет в папке' : 'ошибка: ' + u.err }}</div>
      </div>
    </div>
  </div>
  <div v-if="done" class="card" style="margin-top:16px"><b>Готово</b>
    <div style="font-size:14px;margin-top:8px">Создано: <b>{{ done.created }}</b> · обновлено: <b>{{ done.updated }}</b> · связей: <b>{{ done.linked }}</b><template v-if="done.geocoded"> · координаты по адресу: <b>{{ done.geocoded }}</b></template> · фото загружено: <b>{{ upStat.ok }}</b><template v-if="upStat.fail"> · <span style="color:#9a2e2e">не загрузилось: {{ upStat.fail }}</span></template><template v-if="done.skipped"> · пропущено строк с ошибками: <b>{{ done.skipped }}</b></template></div>
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
.upname,.upcard,.upcap{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.upcap{color:var(--ink);font-style:italic}
.upst{color:var(--muted)}
.upitem.ok .upst{color:#2a8c4a}
.upitem.fail .upst{color:#9a2e2e;white-space:normal}
.dropzone{position:relative;min-height:60vh}
.dropzone.over::after{content:"";position:absolute;inset:-8px;border:2px dashed var(--ink);background:rgba(255,255,255,.6);pointer-events:none}
.dropHint{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:var(--ink);color:#fff;padding:14px 22px;font-size:15px;z-index:50;pointer-events:none}
</style>
