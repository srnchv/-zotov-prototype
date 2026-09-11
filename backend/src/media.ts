// Медиа-хранилище: S3-совместимое (Timeweb / любой хостинг клиента — меняются только env-переменные).
// Оригинал сохраняется как есть (по подписанной ссылке), наружу отдаются сжатые производные.
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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
  const kind = mime.startsWith("image/") ? "image" : mime === "application/pdf" ? "pdf" : mime.startsWith("video/") ? "video" : "file";
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

  const media = repo.createEntity({
    id: `md-${id}`, type: "media", title: filename,
    payload, links: entityId ? [entityId] : [],
  });
  // родительская сущность получает картинку для карточек и страниц
  if (kind === "image" && entityId)
    repo.updateEntity(entityId, { payload: { img: payload.thumb, imgBig: payload.med } });
  return media;
}

// Подписанная ссылка на оригинал (оригиналы напрямую не публикуются)
export async function originalUrl(mediaId: string) {
  const m = repo.getEntity(mediaId);
  if (!m || m.type !== "media" || !m.origKey) return null;
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: BUCKET, Key: String(m.origKey) }), { expiresIn: 600 });
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
export async function deleteMediaFiles(mediaId: string) {
  const m = repo.getEntity(mediaId);
  if (!m || m.type !== "media") return;
  const keys = [m.origKey, ...["thumb", "med", "big"].filter((r) => m[r]).map((r) => `media/${mediaId.replace(/^md-/, "")}/${r}.webp`)].filter(Boolean) as string[];
  for (const Key of keys) await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key })).catch(() => {});
}
