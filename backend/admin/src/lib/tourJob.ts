// Загрузка папки 3D-тура: живёт вне модалки (закрыли окно — загрузка идёт), прогресс виден в карточке.
// Файлы уходят по одному, 4 потока, 3 попытки; упавшие можно догрузить кнопкой, без повторной заливки всего.
import { reactive } from "vue";
import { api, load, toast } from "./store";
import { fmtSize } from "./model";

export type TourJob = { id: string; parentId: string; title: string; total: number; size: number; done: number; bytes: number; skipped: number; failed: string[]; running: boolean; phase: string; error: string };
export const JOB = reactive<{ cur: TourJob | null; files: Map<string, File>; root: string; index: string }>({ cur: null, files: new Map(), root: "", index: "" });
const API = import.meta.env.VITE_API_URL || "/api";
const auth = (): Record<string, string> => { const t = localStorage.getItem("zadm_token"); return t ? { authorization: "Bearer " + t } : {}; };
export const rel = (f: File) => (f as any).webkitRelativePath || f.name;

export function jobText(j: TourJob | null) {
  if (!j) return "";
  if (j.phase) return j.phase;
  const base = `Загружено ${j.skipped + j.done} из ${j.total} файлов · ${fmtSize(j.bytes)} из ${fmtSize(j.size)}`;
  return j.running ? base + "…" : j.failed.length ? `${base} · не загрузились: ${j.failed.length}` : base;
}

// старт или докачка (tourId задан) — список файлов папки уже отобран по корню с index.html
export async function startJob(opts: { parentId: string; title: string; files: File[]; root: string; index: string; tourId?: string }) {
  if (JOB.cur?.running) throw new Error("Уже идёт загрузка — дождитесь её окончания");
  const size = opts.files.reduce((a, f) => a + f.size, 0);
  JOB.files = new Map(opts.files.map((f) => [rel(f).slice(opts.root.length), f])); JOB.root = opts.root; JOB.index = opts.index;
  const id = opts.tourId || (await api<{ id: string }>("/tours/start", { method: "POST", body: JSON.stringify({ entityId: opts.parentId, title: opts.title }) })).id;
  JOB.cur = { id, parentId: opts.parentId, title: opts.title, total: opts.files.length, size, done: 0, bytes: 0, skipped: 0, failed: [], running: true, phase: "", error: "" };
  run([...JOB.files.keys()], !!opts.tourId);
}
// повторить только упавшие
export function retryJob() { const j = JOB.cur; if (!j || j.running || !j.failed.length) return; const list = [...j.failed]; j.failed = []; j.running = true; j.error = ""; run(list, false, true); }

async function run(paths: string[], checkRemote: boolean, isRetry = false) {
  const j = JOB.cur!;
  try {
    if (checkRemote) {
      j.phase = "Сверяем с хранилищем — на большом туре это может занять минуту…";
      const have = new Map<string, number>();
      for (const f of await api<{ key: string; size: number }[]>(`/tours/${j.id}/files`)) have.set(f.key, f.size);
      paths = paths.filter((p) => have.get(p) !== JOB.files.get(p)!.size);
      j.skipped = j.total - paths.length; j.bytes = [...JOB.files.entries()].filter(([p]) => !paths.includes(p)).reduce((a, [, f]) => a + f.size, 0);
      j.phase = "";
    }
    if (isRetry) { j.done = j.total - j.skipped - paths.length; }
    const queue = [...paths];
    const worker = async () => {
      while (queue.length) {
        const p = queue.shift()!, f = JOB.files.get(p)!;
        let ok = false;
        for (let attempt = 0; attempt < 3 && !ok; attempt++) {
          try {
            const fd = new FormData(); fd.append("path", p); fd.append("file", f, f.name);
            const r = await fetch(`${API}/tours/${j.id}/file`, { method: "POST", headers: auth(), body: fd });
            if (!r.ok) throw new Error("HTTP " + r.status);
            ok = true;
          } catch { if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); }
        }
        if (ok) { j.done++; j.bytes += f.size; } else j.failed.push(p);
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    if (j.failed.length) { j.running = false; j.error = `Не загрузились ${j.failed.length} файлов (например, ${j.failed[0]}). Нажмите «Догрузить» — повторим только их.`; return; }
    j.phase = "Завершаем…";
    await api(`/tours/${j.id}/finish`, { method: "POST", body: JSON.stringify({ index: JOB.index, files: j.total, size: j.size }) });
    j.phase = ""; j.running = false;
    await load(); toast("3D-тур загружен и добавлен в галерею");
    JOB.cur = null; JOB.files = new Map();
  } catch (e: any) { j.running = false; j.phase = ""; j.error = "Ошибка: " + (e?.message || e); }
}
