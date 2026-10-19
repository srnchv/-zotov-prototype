// Медиа-хранилище: S3-совместимое (Timeweb / любой хостинг клиента — меняются только env-переменные).
// Оригинал сохраняется как есть (по подписанной ссылке), наружу отдаются сжатые производные.
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import yauzl from "yauzl";
import { createHash } from "node:crypto";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import * as repo from "./repo.js";

const ENDPOINT = process.env.S3_ENDPOINT || "https://s3.twcstorage.ru";
const REGION = process.env.S3_REGION || "ru-1";
const BUCKET = process.env.S3_BUCKET || "";
const PUBLIC_URL = process.env.S3_PUBLIC_URL || `${ENDPOINT}/${BUCKET}`;

export const mediaEnabled = () => !!(BUCKET && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);

const s3 = () =>
  new S3Client({
    endpoint: ENDPOINT,
    region: REGION,
    forcePathStyle: true,
    // S3-совместимые хранилища (не AWS) не понимают новые контрольные суммы SDK
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY! },
  });

// Производные для изображений: превью в карточку, средний для страницы, большой для просмотрщика.
const RENDITIONS: [name: string, width: number, quality: number][] = [
  ["thumb", 400, 75],
  ["med", 1200, 80],
  ["big", 2560, 82],
];

export async function processImage(buf: Buffer) {
  const meta = await sharp(buf).metadata();
  const out: Record<string, Buffer> = {};
  for (const [name, width, quality] of RENDITIONS)
    out[name] = await sharp(buf).rotate().resize({ width, withoutEnlargement: true }).webp({ quality }).toBuffer();
  return { renditions: out, width: meta.width || 0, height: meta.height || 0 };
}

async function put(key: string, body: Buffer, contentType: string) {
  await s3().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
}

export async function uploadMedia(opts: { entityId?: string; filename: string; mime: string; buffer: Buffer }) {
  const { entityId, filename, mime, buffer } = opts;
  const id = randomUUID().slice(0, 8);
  const kind = mime.startsWith("image/") ? "image" : mime === "application/pdf" ? "pdf" : mime.startsWith("video/") ? "video" : mime.startsWith("audio/") ? "audio" : "file";
  const origKey = `orig/${id}/${filename.replace(/[^\wа-яА-ЯёЁ.\-]+/g, "_")}`;

  const payload: Record<string, unknown> = {
    kind, mime, filename,
    size: buffer.length,
    format: (filename.split(".").pop() || "").toUpperCase(),
    origKey,
    parent: entityId || null,
  };

  if (kind === "image") {
    const { renditions, width, height } = await processImage(buffer);
    payload.width = width; payload.height = height;
    for (const [name, body] of Object.entries(renditions)) {
      await put(`media/${id}/${name}.webp`, body, "image/webp");
      payload[name] = `${PUBLIC_URL}/media/${id}/${name}.webp`;
    }
  }
  await put(origKey, buffer, mime);

  const media = await repo.createEntity({
    id: `md-${id}`, type: "media", title: filename,
    payload, links: entityId ? [entityId] : [],
  });
  // родительская сущность получает картинку для карточек и страниц — только если обложки ещё нет
  // (выбранную редактором обложку новая загрузка не перебивает)
  if (kind === "image" && entityId) {
    const parent = await repo.getEntity(entityId);
    if (parent && !parent.cover && !parent.img)
      await repo.updateEntity(entityId, { payload: { img: payload.thumb, imgBig: payload.med } });
  }
  return media;
}

// Подписанная ссылка на оригинал (оригиналы напрямую не публикуются)
export async function originalUrl(mediaId: string, expiresIn = 600) {
  const m = await repo.getEntity(mediaId);
  if (!m || m.type !== "media" || !m.origKey) return null;
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: BUCKET, Key: String(m.origKey) }), { expiresIn });
}

// Самопроверка хранилища: пробуем записать и удалить один байт, возвращаем детали ошибки
export async function selftest() {
  const info = {
    endpoint: ENDPOINT, region: REGION, bucket: BUCKET, publicUrl: PUBLIC_URL,
    accessKeyLen: (process.env.S3_ACCESS_KEY || "").length,
    secretKeyLen: (process.env.S3_SECRET_KEY || "").length,
  };
  try {
    await put("selftest/ping.txt", Buffer.from("ok"), "text/plain");
    await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: "selftest/ping.txt" }));
    return { ...info, ok: true };
  } catch (e: any) {
    return {
      ...info, ok: false,
      errName: e?.name, errMessage: e?.message, errCode: e?.Code || e?.code,
      httpStatus: e?.$metadata?.httpStatusCode,
      raw: String(e).slice(0, 300),
    };
  }
}

// При удалении media-сущности подчищаем файлы в хранилище
// ---- 3D-тур пакетом (ZIP от студии: index.html + ресурсы): распаковываем в S3 под tours/<id>/, тур живёт у нас ----
const MIME: Record<string, string> = { html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8", js: "application/javascript", mjs: "application/javascript", css: "text/css", json: "application/json", xml: "application/xml", txt: "text/plain",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", ico: "image/x-icon", avif: "image/avif",
  mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", m4a: "audio/mp4",
  woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", eot: "application/vnd.ms-fontobject",
  glb: "model/gltf-binary", gltf: "model/gltf+json", bin: "application/octet-stream", wasm: "application/wasm", pdf: "application/pdf", vtt: "text/vtt", ktx2: "image/ktx2", basis: "application/octet-stream" };
const mimeOf = (name: string) => MIME[(name.split(".").pop() || "").toLowerCase()] || "application/octet-stream";

export async function uploadTourZip(opts: { zipPath: string; entityId?: string; title: string }) {
  const { zipPath, entityId, title } = opts;
  const id = "md-" + createHash("sha1").update(zipPath + Date.now()).digest("hex").slice(0, 8);
  const prefix = `tours/${id.slice(3)}/`;
  // читаем список записей, находим index.html с наименьшей вложенностью — его папка становится корнем тура
  const entries: yauzl.Entry[] = [];
  const zip = await new Promise<yauzl.ZipFile>((res, rej) => yauzl.open(zipPath, { lazyEntries: true }, (e, z) => (e ? rej(e) : res(z!))));
  await new Promise<void>((res, rej) => { zip.on("entry", (en: yauzl.Entry) => { entries.push(en); zip.readEntry(); }); zip.on("end", () => res()); zip.on("error", rej); zip.readEntry(); });
  zip.close();
  const files = entries.filter((e) => !/\/$/.test(e.fileName) && !e.fileName.startsWith("__MACOSX/") && !/(^|\/)\./.test(e.fileName));
  const idx = files.map((e) => e.fileName).filter((n) => /(^|\/)index\.html?$/i.test(n)).sort((a, b) => a.split("/").length - b.split("/").length)[0];
  if (!idx) throw new Error("в архиве нет index.html");
  const root = idx.slice(0, idx.lastIndexOf("/") + 1);
  const toUpload = files.filter((e) => e.fileName.startsWith(root));
  if (!toUpload.length) throw new Error("пустой архив");
  // второй проход: распаковываем и льём в S3 файл за файлом (без распаковки на диск)
  const zip2 = await new Promise<yauzl.ZipFile>((res, rej) => yauzl.open(zipPath, { lazyEntries: true }, (e, z) => (e ? rej(e) : res(z!))));
  let total = 0, count = 0;
  await new Promise<void>((res, rej) => {
    zip2.on("entry", (en: yauzl.Entry) => {
      if (!toUpload.some((f) => f.fileName === en.fileName)) return zip2.readEntry();
      zip2.openReadStream(en, (e, rs) => {
        if (e || !rs) return rej(e || new Error("read"));
        const chunks: Buffer[] = [];
        rs.on("data", (c: Buffer) => chunks.push(c));
        rs.on("end", async () => {
          try { const body = Buffer.concat(chunks); total += body.length; count++;
            await put(prefix + en.fileName.slice(root.length), body, mimeOf(en.fileName)); zip2.readEntry(); }
          catch (err) { rej(err); }
        });
        rs.on("error", rej);
      });
    });
    zip2.on("end", () => res()); zip2.on("error", rej); zip2.readEntry();
  });
  zip2.close();
  const embed = `${PUBLIC_URL}/${prefix}${idx.slice(root.length)}`;
  const payload = { kind: "tour", embed, tourPrefix: prefix, files: count, size: total, parent: entityId || null, format: "ZIP" };
  const media = await repo.createEntity({ id, type: "media", title, payload, links: entityId ? [entityId] : [] });
  return media;
}

// Большие туры (гигабайты): папка заливается из браузера файл за файлом через API, без временного диска
export async function tourStart(opts: { entityId?: string; title: string }) {
  const id = "md-" + createHash("sha1").update(opts.title + Date.now() + Math.random()).digest("hex").slice(0, 8);
  const prefix = `tours/${id.slice(3)}/`;
  return repo.createEntity({ id, type: "media", title: opts.title, status: "draft", payload: { kind: "tour", tourPrefix: prefix, uploading: true, parent: opts.entityId || null, format: "ZIP", files: 0, size: 0 }, links: opts.entityId ? [opts.entityId] : [] });
}
export async function tourPutFile(mediaId: string, relPath: string, body: Buffer) {
  const m = await repo.getEntity(mediaId);
  if (!m || !m.tourPrefix) throw new Error("tour not found");
  const clean = relPath.replace(/^\/+/, "").replace(/\.\.(\/|$)/g, "");
  await put(String(m.tourPrefix) + clean, body, mimeOf(clean));
  return { key: clean, size: body.length };
}
export async function tourFinish(mediaId: string, indexPath: string, files: number, size: number) {
  const m = await repo.getEntity(mediaId);
  if (!m || !m.tourPrefix) throw new Error("tour not found");
  const embed = `${PUBLIC_URL}/${m.tourPrefix}${indexPath.replace(/^\/+/, "")}`;
  return repo.updateEntity(mediaId, { status: "published", payload: { embed, uploading: false, files, size } });
}

export async function deleteMediaFiles(mediaId: string) {
  const m = await repo.getEntity(mediaId);
  if (!m || m.type !== "media") return;
  if (m.tourPrefix) { // распакованный тур: удаляем всё под префиксом
    let token: string | undefined;
    do {
      const r = await s3().send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: String(m.tourPrefix), ContinuationToken: token })).catch(() => null);
      if (!r) break;
      const keys = (r.Contents || []).map((o) => ({ Key: o.Key! }));
      if (keys.length) await s3().send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: keys } })).catch(() => {});
      token = r.IsTruncated ? r.NextContinuationToken : undefined;
    } while (token);
    return;
  }
  const keys = [m.origKey, ...["thumb", "med", "big"].filter((r) => m[r]).map((r) => `media/${mediaId.replace(/^md-/, "")}/${r}.webp`)].filter(Boolean) as string[];
  for (const Key of keys) await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key })).catch(() => {});
}

// ---- Субтитры к видео/аудио: WebVTT (SRT конвертируем), лежат публично рядом с производными ----
export function srtToVtt(src: string) {
  const body = src.replace(/^\uFEFF/, "").replace(/\r/g, "")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2"); // запятая в таймкодах → точка
  return "WEBVTT\n\n" + body.trim() + "\n";
}
export async function addSubtitles(mediaId: string, opts: { filename: string; buffer: Buffer; lang?: string; label?: string }) {
  const m = await repo.getEntity(mediaId);
  if (!m || m.type !== "media") return null;
  const text = opts.buffer.toString("utf8");
  const vtt = /^\s*WEBVTT/.test(text) ? text : srtToVtt(text);
  const lang = (opts.lang || "ru").toLowerCase().slice(0, 5);
  const key = `media/${mediaId.replace(/^md-/, "")}/subs-${lang}.vtt`;
  await put(key, Buffer.from(vtt, "utf8"), "text/vtt; charset=utf-8");
  const url = `${PUBLIC_URL}/${key}`;
  const tracks = ((m.subtitles as { lang: string; label: string; url: string }[]) || []).filter((t) => t.lang !== lang);
  tracks.push({ lang, label: opts.label || ({ ru: "Русский", en: "English" } as Record<string, string>)[lang] || lang.toUpperCase(), url });
  return repo.updateEntity(mediaId, { payload: { subtitles: tracks } });
}
export async function removeSubtitles(mediaId: string, lang: string) {
  const m = await repo.getEntity(mediaId);
  if (!m || m.type !== "media") return null;
  const tracks = ((m.subtitles as { lang: string }[]) || []).filter((t) => t.lang !== lang);
  await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: `media/${mediaId.replace(/^md-/, "")}/subs-${lang}.vtt` })).catch(() => {});
  return repo.updateEntity(mediaId, { payload: { subtitles: tracks } });
}

// ---- Прокси оригинала для встроенных просмотрщиков (PDF.js читает файл XHR-ом — напрямую из S3 мешает CORS).
// Поддерживает Range — плееры могут перематывать.
export async function streamOriginal(mediaId: string, range?: string) {
  const m = await repo.getEntity(mediaId);
  if (!m || m.type !== "media" || !m.origKey) return null;
  const r = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: String(m.origKey), Range: range }));
  return {
    status: range ? 206 : 200,
    headers: {
      "content-type": r.ContentType || String(m.mime || "application/octet-stream"),
      ...(r.ContentLength != null ? { "content-length": String(r.ContentLength) } : {}),
      ...(r.ContentRange ? { "content-range": r.ContentRange } : {}),
      "accept-ranges": "bytes",
      "cache-control": "private, max-age=600",
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(String(m.filename || m.title || "file"))}`,
    },
    body: r.Body as NodeJS.ReadableStream,
  };
}
