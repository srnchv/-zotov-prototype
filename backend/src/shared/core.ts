// Чистая логика архива (без сети и React): типы, опубликованность, связи, картинки и кадры, координаты.
// Этот файл копируется в backend/src/shared (scripts/sync-shared.sh) — серверный поиск использует те же правила.
// Все страницы рендерятся на сервере (SSR) — карточки индексируются поисковиками.
export type Style = Record<string, string | number>; // стиль с CSS-переменными кадра (на фронте кладётся в style={})
type Base = { id: string; type: string; title: string; status: string; [k: string]: unknown };
export type Entity = Base & { links?: string[]; roles?: Record<string, string> }; // roles[linkedId] — роль связанной сущности на странице этой
export type EntityFull = Base & { links: Entity[] };

export const TYPES: Record<string, { l: string; pl: string }> = {
  material: { l: "Материал", pl: "Материалы" }, person: { l: "Личность", pl: "Личности" },
  place: { l: "Место", pl: "Места" }, event: { l: "Событие", pl: "События" },
  theme: { l: "Тема", pl: "Темы" }, project: { l: "Выставка / проект", pl: "Проекты Центра" },
  org: { l: "Организация", pl: "Организации" }, collection: { l: "Коллекция / фонд", pl: "Коллекции" },
  source: { l: "Источник", pl: "Источники" }, media: { l: "Медиафайл", pl: "Медиафайлы" }, tag: { l: "Тег", pl: "Теги" },
};

// Данные кэшируются по тегу «archive»: страницы собираются из кэша, а при любом сохранении в админке API дёргает
// /api/revalidate и кэш сбрасывается. Страховка — пересборка не реже раза в час (revalidate на страницах).

// опубликовано всё, что не черновик и не на модерации (в старых данных у мест в status лежало состояние здания)
export const published = (e?: Entity) => !!e && !["draft", "moderation"].includes(String(e.status || "")) && e.type !== "dict";
export const ofType = (db: Record<string, Entity>, t: string) => Object.values(db).filter((e) => e.type === t && published(e));
export const linked = (db: Record<string, Entity>, e: Entity, t?: string) =>
  (e.links || []).map((id) => db[id]).filter((x) => x && published(x) && (!t || x.type === t));

// списки в payload (функции, авторы, сферы, города личности): массив или строка через «;»
type AnyEnt = { [k: string]: unknown } | undefined;
export const listOf = (e: AnyEnt, k: string): string[] => { const v = e?.[k]; return Array.isArray(v) ? v.map(String).filter(Boolean) : v ? String(v).split(";").map((x) => x.trim()).filter(Boolean) : []; };
// сферы деятельности личности: поле spheres, у старых карточек — роль через запятую
export const spheresOf = (e: { [k: string]: unknown }) => { const sp = listOf(e, "spheres"); return sp.length ? sp : String(e.role || "").split(/[,;]/).map((x) => x.trim().toLowerCase()).filter(Boolean); };
// типология места — функции «Группа › функция»; группа — первая часть
export const funcsOf = (e: { [k: string]: unknown }) => listOf(e, "functions");
export const funcGroupOf = (e: { [k: string]: unknown }) => (funcsOf(e)[0] || String(e.placeType || "").split(" · ")[0]).split(" › ")[0].trim();
export const funcLabel = (e: { [k: string]: unknown }) => funcsOf(e).map((f) => f.split(" › ").pop()!.trim()).join(", ") || String(e.placeType || "").split(" · ").pop()?.trim() || "";
export const yearOf = (s?: unknown) => { const m = String(s ?? "").match(/\d{4}/); return m ? +m[0] : 0; };

// год сущности — по первому датированному полю, каким бы оно ни называлось у типа
export const entityYear = (e: Entity) => yearOf(e.date || e.year || e.dates || e.period || e.life);

// картинка карточки: своё поле или первый привязанный медиафайл-изображение
export const imgOf = (db: Record<string, Entity>, e: Entity, big = false) => {
  const own = big ? (e.imgBig || e.img) : e.img;
  if (own) return String(own);
  const m = (e.links || []).map((id) => db[id]).find((x) => x && x.type === "media" && x.kind === "image");
  return m ? String(big ? (m.big || m.med) : (m.med || m.thumb)) : "";
};

// серверный поиск (PG FTS с морфологией и опечатками); порядок items — релевантность
export type SearchHit = { id: string; direct: boolean; snippet?: string; via?: string };
// вид медиафайла: kind с сервера, иначе по mime/расширению (файлы, загруженные до появления kind)
export const mediaKind = (m: Entity) => {
  const k = String(m.kind || "");
  if (["image", "video", "audio", "pdf", "tour"].includes(k)) return k; // tour — 3D-тур (эмбед)
  const mime = String(m.mime || ""), ext = String(m.format || m.title || "").toLowerCase().split(".").pop() || "";
  if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)) return "audio";
  if (mime.startsWith("video/") || ["mp4", "mov", "webm"].includes(ext)) return "video";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  return "file";
};

// Кадр фото: точка (x, y в %) и масштаб — отдельно для десктопа (d) и мобайла (m, ≤599px).
// Задаётся в админке («Кадр»): у медиафайла — frame, у сущности-владельца обложки — imgFrame; старый формат focus/imgPos «x% y%» читается как кадр без масштаба.
export type Frame = { x: number; y: number; s: number };
export type Frames = { d?: Frame; m?: Frame };
const parsePos = (v: unknown): Frame | undefined => { const m = String(v || "").match(/([\d.]+)%\s+([\d.]+)%/); return m ? { x: +m[1], y: +m[2], s: 1 } : undefined; };
export const framesOf = (frames: unknown, pos?: unknown): Frames | undefined => {
  const f = (frames && typeof frames === "object" ? (frames as Frames) : undefined) || {};
  const d = f.d || parsePos(pos);
  if (!d && !f.m) return undefined;
  return { d, m: f.m };
};
// стиль для <img>: CSS-переменные, которые globals.css превращает в object-position + scale (на мобайле — свои)
export const frameStyle = (fr?: Frames): Style | undefined => {
  if (!fr || (!fr.d && !fr.m)) return undefined;
  const d = fr.d || { x: 50, y: 50, s: 1 };
  const st: Record<string, string> = { "--fx": `${d.x}%`, "--fy": `${d.y}%`, "--fs": String(d.s || 1) };
  if (fr.m) { st["--mfx"] = `${fr.m.x}%`; st["--mfy"] = `${fr.m.y}%`; st["--mfs"] = String(fr.m.s || 1); }
  return st as Style;
};
// кадр карточки сущности: свой (обложка) или у привязанного медиафайла-изображения
export const imgPos = (db: Record<string, Entity>, e: Entity): Style | undefined => {
  const own = framesOf(e.imgFrame, e.imgPos);
  if (own) return frameStyle(own);
  const m = (e.links || []).map((id) => db[id]).find((x) => x && x.type === "media" && x.kind === "image" && (x.focus || x.frame));
  return m ? frameStyle(framesOf(m.frame, m.focus)) : undefined;
};
export const mediaPos = (m?: Entity) => (m ? frameStyle(framesOf(m.frame, m.focus)) : undefined);

// публичная конфигурация стенда (ключ Яндекс Карт JavaScript API — доменный, не секрет)
// координаты сущности (места): числа или null
export const coordsOf = (e: Entity): [number, number] | null => {
  const lat = parseFloat(String(e.lat ?? "").replace(",", ".")), lon = parseFloat(String(e.lon ?? "").replace(",", "."));
  return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
};

// статус проекта Центра по датам (ТЗ «Единый шаблон»): Скоро / Идёт / Завершён; без дат — пусто
export const projectStatus = (o: Record<string, unknown>, now = new Date()) => {
  const d = (v: unknown) => { const s = String(v || "").trim(); return s ? new Date(s + (s.length === 10 ? "T00:00:00" : "")) : null; };
  const from = d(o.dateFrom), to = d(o.dateTo);
  if (!from && !to) return "";
  if (from && now < from) return "Скоро";
  if (to && now > new Date(to.getTime() + 86400000)) return "Завершён";
  return "Идёт";
};
// «26.09.25 — 20.10.25» из дат начала/окончания (макет Проекта центра)
export const projectDates = (o: Record<string, unknown>) => {
  const f = (v: unknown) => { const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}.${m[2]}.${m[1].slice(2)}` : ""; };
  const a = f(o.dateFrom), b = f(o.dateTo);
  return a && b ? `${a} — ${b}` : a || b || String(o.dates || "");
};
// имена через «;» → личности архива по точному названию или по фамилии (первое слово имени совпадает с фамилией в карточке)
export const namesOf = (v: unknown) => String(v ?? "").split(/[;\n]/).map((x) => x.trim().replace(/^[^›]+›\s*/, "")).filter(Boolean);
export function findByName(db: Record<string, Entity>, type: string, name: string): Entity | undefined {
  const n = name.toLowerCase().replace(/ё/g, "е").trim(); if (!n) return undefined;
  const all = Object.values(db).filter((e) => e.type === type && published(e));
  const exact = all.find((e) => e.title.toLowerCase().replace(/ё/g, "е") === n); if (exact) return exact;
  const parts = n.split(/\s+/), sur = parts.length > 1 ? parts[parts.length - 1] : parts[0]; // «Александр Родченко» / «Родченко А. М.»
  const cand = all.filter((e) => e.title.toLowerCase().replace(/ё/g, "е").split(/\s+/).includes(sur));
  return cand.length === 1 ? cand[0] : undefined;
}
