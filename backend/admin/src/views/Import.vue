<script setup lang="ts">
// Импорт пачкой: шаг 1 — таблица Excel по шаблону → предпросмотр (ничего не пишется);
// шаг 2 — папка с фото (берутся только файлы из колонки «Файлы»); шаг 3 — загрузка: карточки и связи
// создаёт сервер, затем админка заливает файлы к созданным карточкам (первый файл — обложка). В конце — отчёт.
import { ref, computed } from "vue";
import { API, S, api, load, toast, canEdit, uploadFile } from "../lib/store";
import { TYPES } from "../lib/model";
type PlanRow = { sheet: string; row: number; type: string; title: string; action: "create" | "update" | "error"; id?: string; links: number; files: string[]; notes: string[] };
type Plan = { rows: PlanRow[]; problems: string[]; creates: number; updates: number; errors: number; links: number; files: string[]; newDict: string[] };
const xlsx = ref<File | null>(null), plan = ref<Plan | null>(null), busy = ref(""), done = ref<any>(null);
const inpX = ref<HTMLInputElement>(), inpDir = ref<HTMLInputElement>();
const folder = ref<Map<string, File>>(new Map());
const keyOf = (n: string) => n.trim().toLowerCase().normalize("NFC");
const ACT: Record<string, string> = { create: "создать", update: "обновить", error: "ошибка" };

async function pickXlsx(ev: Event) {
  const f = (ev.target as HTMLInputElement).files?.[0]; if (!f) return;
  xlsx.value = f; plan.value = null; done.value = null; busy.value = "Разбираем таблицу…";
  try { const fd = new FormData(); fd.append("file", f); plan.value = await api<Plan>("/import/preview", { method: "POST", body: fd }); }
  catch (e: any) { toast("Ошибка: " + e.message); }
  busy.value = ""; (ev.target as HTMLInputElement).value = "";
}
function pickDir(ev: Event) {
  const m = new Map<string, File>();
  for (const f of (ev.target as HTMLInputElement).files || []) { if (f.name.startsWith(".")) continue; m.set(keyOf(f.name), f); }
  folder.value = m;
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
  const warn = [plan.value.errors ? `${plan.value.errors} строк с ошибками будут пропущены` : "", files.value.miss.length ? `${files.value.miss.length} файлов из таблицы нет в папке — карточки создадутся без них` : ""].filter(Boolean).join("; ");
  if (!confirm(`Создать ${plan.value.creates}, обновить ${plan.value.updates}${warn ? ". " + warn : ""}. Продолжить?`)) return;
  busy.value = "Создаём карточки и связи…";
  try {
    const fd = new FormData(); fd.append("file", xlsx.value);
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
    plan.value = null; xlsx.value = null; folder.value = new Map();
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
  <h1>Импорт</h1>
  <div class="muted" style="font-size:14px;margin:6px 0 14px;max-width:760px">Загрузка карточек пачкой: таблица Excel по шаблону и папка с фото. Связи между карточками задаются названиями, фото — именами файлов. Перед записью показывается, что именно изменится.</div>

  <div class="card"><b>Шаг 1. Таблица</b>
    <div class="muted" style="font-size:12px;margin:4px 0 10px">Скачайте шаблон (в нём лист «Инструкция» и списки справочников), заполните листы по типам карточек и загрузите файл обратно. Повторная загрузка той же таблицы безопасна: существующие карточки обновятся, а не продублируются.</div>
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
      <span v-if="plan.newDict.length">Новых значений справочников: <b>{{ plan.newDict.length }}</b></span>
    </div>
    <div v-for="p in plan.problems" :key="p" class="admbar warn" style="margin:4px 0">{{ p }}</div>
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
    <div class="muted" style="font-size:12px;margin-top:6px">Все изменения записаны в журнал с пометкой «импорт». {{ TYPES.material.pl }} и остальные типы — в разделе «Сущности».</div>
  </div>
</template>
