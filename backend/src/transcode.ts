// Адаптивное видео (HLS): после загрузки видео перекодируется ffmpeg в несколько качеств (1080/720/480/360 — не выше исходника),
// сегменты и плейлисты складываются в хранилище под media/<id>/hls/, плеер (hls.js) сам подбирает качество под сеть и экран.
// Очередь — в процессе, по одному заданию (кодирование грузит все ядра); при рестарте незавершённые задания ставятся заново.
import { spawn } from "node:child_process";
import { promises as fs, createReadStream } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import * as repo from "./repo.js";
import * as media from "./media.js";

export const VARIANTS = [
  { h: 1080, vb: 4500, ab: 160 }, { h: 720, vb: 2500, ab: 128 }, { h: 480, vb: 1200, ab: 96 }, { h: 360, vb: 700, ab: 96 },
]; // высота, видеобитрейт кбит/с (maxrate), аудио кбит/с

const queue: string[] = [];
let running = false;
// текущий этап — для диагностики (/api/transcode/status) и статуса в админке
export const current = { id: "", stage: "", since: 0, lastLog: "" };
const stage = (id: string, st: string, extra = "") => { current.id = id; current.stage = st; current.since = Date.now(); current.lastLog = extra; console.log(`[transcode] ${id}: ${st} ${extra}`); };
export const hasFfmpeg = () => new Promise<boolean>((res) => { const p = spawn("ffmpeg", ["-version"]); p.on("error", () => res(false)); p.on("exit", (c) => res(c === 0)); });

function run(cmd: string, args: string[], onLine?: (l: string) => void): Promise<string> {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => { out += d; if (onLine) for (const l of String(d).split("\n")) if (l) onLine(l); });
    p.stderr.on("data", (d) => { err += d; if (err.length > 20000) err = err.slice(-20000); });
    p.on("error", rej);
    p.on("exit", (c) => (c === 0 ? res(out) : rej(new Error(`${cmd} exit ${c}: ${err.slice(-600)}`))));
  });
}

async function probe(file: string) {
  const out = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", file]);
  const j = JSON.parse(out); const st = j.streams?.[0] || {};
  return { w: Number(st.width || 0), h: Number(st.height || 0), dur: Number(j.format?.duration || 0) };
}

const setStatus = (id: string, payload: Record<string, unknown>) => repo.updateEntity(id, { payload }).catch(() => {});

async function transcodeOne(mediaId: string) {
  stage(mediaId, "start");
  const m = await repo.getEntity(mediaId);
  if (!m || m.type !== "media" || String(m.kind) !== "video") { stage(mediaId, "skip", `kind=${m?.kind}`); await setStatus(mediaId, { hlsStatus: "error", hlsError: "файл не видео или не найден" }); return; }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hls-"));
  try {
    stage(mediaId, "download");
    await setStatus(mediaId, { hlsStatus: "processing", hlsProgress: 0, hlsError: "", hlsStage: "скачиваем оригинал" });
    // исходник из хранилища во временный файл
    const src = path.join(dir, "source" + path.extname(String(m.filename || ".mp4")));
    const s = await media.streamOriginal(mediaId);
    if (!s) throw new Error("оригинал не найден в хранилище");
    await pipeline(s.body as NodeJS.ReadableStream, createWriteStream(src));
    stage(mediaId, "probe");
    const info = await probe(src);
    if (!info.h) throw new Error("ffprobe: не удалось прочитать видео");
    stage(mediaId, "encode", `${info.w}x${info.h} ${Math.round(info.dur)}s`);
    const variants = VARIANTS.filter((v) => v.h <= info.h);
    if (!variants.length) variants.push(VARIANTS[VARIANTS.length - 1]);
    const total = variants.length * (info.dur || 1); let doneSec = 0;
    const out = path.join(dir, "out"); await fs.mkdir(out);
    for (const v of variants) {
      const vd = path.join(out, String(v.h)); await fs.mkdir(vd);
      await setStatus(mediaId, { hlsStage: `кодируем ${v.h}p` });
      let last = 0;
      await run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-nostdin", "-i", src,
        "-vf", `scale=-2:${v.h}`, "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "main", "-crf", "23", "-maxrate", `${v.vb}k`, "-bufsize", `${v.vb * 2}k`,
        "-g", "48", "-keyint_min", "48", "-sc_threshold", "0", "-c:a", "aac", "-b:a", `${v.ab}k`, "-ac", "2",
        "-f", "hls", "-hls_time", "6", "-hls_playlist_type", "vod", "-hls_flags", "independent_segments", "-hls_segment_filename", path.join(vd, "s%04d.ts"),
        "-progress", "pipe:1", path.join(vd, "index.m3u8")], (l) => {
          const mm = l.match(/^out_time_ms=(\d+)/); if (!mm) return;
          const sec = Number(mm[1]) / 1e6; const pct = Math.min(99, Math.round(((doneSec + sec) / total) * 100));
          if (pct - last >= 3) { last = pct; void setStatus(mediaId, { hlsProgress: pct }); }
        });
      doneSec += info.dur || 1;
    }
    // мастер-плейлист: BANDWIDTH — видео + аудио с запасом 10 %
    const master = ["#EXTM3U", "#EXT-X-VERSION:3", ...variants.flatMap((v) => { const w = Math.round((info.w / info.h) * v.h / 2) * 2; return [`#EXT-X-STREAM-INF:BANDWIDTH=${Math.round((v.vb + v.ab) * 1100)},RESOLUTION=${w}x${v.h},NAME="${v.h}p"`, `${v.h}/index.m3u8`]; })].join("\n") + "\n";
    await fs.writeFile(path.join(out, "master.m3u8"), master);
    // в хранилище: сегменты — кэшируются год, плейлисты — минуту
    stage(mediaId, "upload");
    await setStatus(mediaId, { hlsStage: "выгружаем в хранилище" });
    const prefix = `media/${mediaId.replace(/^md-/, "")}/hls/`;
    await media.deletePrefix(prefix); // старая версия, если перекодируем заново
    const files = (await fs.readdir(out, { recursive: true })) as string[];
    for (const f of files) { const full = path.join(out, f); if ((await fs.stat(full)).isDirectory()) continue; await media.putFile(prefix + f.replace(/\\/g, "/"), full, f.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t"); }
    await setStatus(mediaId, { hls: prefix + "master.m3u8", hlsStatus: "done", hlsProgress: 100, hlsLevels: variants.map((v) => v.h), hlsError: "", hlsStage: "" });
    stage(mediaId, "done");
  } catch (e: any) {
    console.error("transcode failed", mediaId, e?.message);
    stage(mediaId, "error", String(e?.message || e).slice(0, 200));
    await setStatus(mediaId, { hlsStatus: "error", hlsError: String(e?.message || e).slice(0, 500), hlsStage: "" });
  } finally { await fs.rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

const STALL_MS = 90 * 60 * 1000;
async function pump() {
  if (running) {
    if (current.since && Date.now() - current.since > STALL_MS) { console.error(`[transcode] ${current.id} завис на этапе ${current.stage} — освобождаю очередь`); await setStatus(current.id, { hlsStatus: "error", hlsError: `зависло на этапе «${current.stage}», запустите заново`, hlsStage: "" }); running = false; }
    else return;
  }
  running = true;
  try { while (queue.length) { const id = queue.shift()!; try { await transcodeOne(id); } catch (e: any) { console.error("[transcode] unexpected", id, e?.message); await setStatus(id, { hlsStatus: "error", hlsError: String(e?.message || e).slice(0, 500), hlsStage: "" }); } } } finally { running = false; current.id = ""; current.stage = ""; current.since = 0; }
}
export async function enqueue(mediaId: string) {
  if (!(await hasFfmpeg())) { await setStatus(mediaId, { hlsStatus: "error", hlsError: "ffmpeg не установлен на сервере" }); return; }
  if (!queue.includes(mediaId)) { queue.push(mediaId); await setStatus(mediaId, { hlsStatus: "queued", hlsProgress: 0, hlsError: "" }); }
  void pump();
}
export const queueState = () => ({ running, queued: [...queue], current: { ...current, sinceSec: current.since ? Math.round((Date.now() - current.since) / 1000) : 0 } });
// при старте: всё, что осталось в очереди или оборвалось на кодировании — заново
export async function resume() {
  if (!media.mediaEnabled()) return;
  const { entities } = await repo.exportAll();
  for (const e of entities) if (e.type === "media" && String((e as any).kind) === "video" && ["queued", "processing"].includes(String((e as any).hlsStatus || ""))) await enqueue(e.id);
}
