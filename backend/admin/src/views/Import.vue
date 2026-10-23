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
const canRun = computed(() => !!plan.value && plan.value.rows.some((r) => r.action !== "error") && !busy.value);

async function run() {
  if (!xlsx.value || !plan.value) return;
  const warn = [plan.value.errors ? `${plan.value.errors} строк с ошибками будут пропущены` : "", plan.value.unresolved.length ? `${plan.value.unresolved.length} ненайденных связей будут пропущены` : "", files.value.miss.length ? `${files.value.miss.length} файлов из таблицы нет в папке — карточки создадутся без них` : ""].filter(Boolean).join("; ");
  if (!confirm(`Создать ${plan.value.creates}, обновить ${plan.value.updates}${warn ? ". " + warn : ""}. Продолжить?`)) return;
  busy.value = "Создаём карточки и связи…";
  try {
    const fd = new FormData(); fd.append("file", xlsx.value); fd.append("resolve", JSON.stringify(resolve.value));
    const r = await api<any>("/import/run", { method: "POST", body: fd });
    // файлы — по строкам результата, первый файл карточки становится обложкой
    let up = 0, failed: string[] = []; const total = r.rows.reduce((a: number, x: any) => a + x.files.filter((n: string) => folder.value.has(keyOf(n))).length, 0);
    for (const row of r.rows) {
      let first = true;
      for (const n of row.files) {
        const f = folder.value.get(keyOf(n)); if (!f) continue;
        busy.value = `Загружаем файлы: ${up + 1} из ${total}`;
        try {
          const m = await uploadFile(f, row.id);
          if (first && m?.thumb) { await api("/entities/" + row.id, { method: "PATCH", body: JSON.stringify({ payload: { cover: m.id, img: m.thumb, imgBig: m.med || m.thumb } }) }); }
          first = false; up++;
        } catch (e: any) { failed.push(`${n} → ${row.title}: ${e.message}`); }
      }
    }
    await load();
    done.value = { ...r, uploaded: up, failed };
    plan.value = null; xlsx.value = null; folder.value = new Map(); resolve.value = {};
    toast("Импорт завершён");
  } catch (e: any) { toast("Ошибка импорта: " + e.message); }
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
  </div>

  <div v-if="plan" style="margin-top:16px;display:flex;gap:12px;align-items:center">
    <button class="btn dark" :disabled="!canRun" @click="run">Загрузить в архив</button>
    <span v-if="busy" class="muted" style="font-size:13px">{{ busy }}</span>
  </div>
  <div v-else-if="busy" class="muted" style="margin-top:12px;font-size:13px">{{ busy }}</div>

  <div v-if="done" class="card" style="margin-top:16px"><b>Готово</b>
    <div style="font-size:14px;margin-top:8px">Создано: <b>{{ done.created }}</b> · обновлено: <b>{{ done.updated }}</b> · связей: <b>{{ done.linked }}</b> · файлов загружено: <b>{{ done.uploaded }}</b><template v-if="done.skipped"> · пропущено строк с ошибками: <b>{{ done.skipped }}</b></template></div>
    <div v-for="f in done.failed" :key="f" class="admbar err" style="margin:6px 0 0">{{ f }}</div>
    <div class="muted" style="font-size:12px;margin-top:8px">Карточки: <template v-for="(r, i) in done.rows" :key="r.id"><router-link :to="'/edit/' + r.id">{{ r.title }}</router-link><span v-if="i < done.rows.length - 1">, </span></template></div>
    <div class="muted" style="font-size:12px;margin-top:6px">Все изменения записаны в журнал с пометкой «импорт». Карточки — в разделе «Сущности».</div>
  </div>
  <div v-if="dragOver" class="dropHint">Отпустите: таблица .xlsx или папка с фото</div>
  </div>
  <Picker v-if="picking" :title="`${TYPES[picking.type]?.l}: «${picking.name}»`" :items="pickItems" @pick="(o) => setResolve(picking!, o.id)" @close="picking = null" />
</template>
<style scoped>
.dropzone{position:relative;min-height:60vh}
.dropzone.over::after{content:"";position:absolute;inset:-8px;border:2px dashed var(--ink);background:rgba(255,255,255,.6);pointer-events:none}
.dropHint{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:var(--ink);color:#fff;padding:14px 22px;font-size:15px;z-index:50;pointer-events:none}
</style>
