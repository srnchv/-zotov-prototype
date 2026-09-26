// Слой данных: единственное место, где фронт знает про API стенда.
// Все страницы рендерятся на сервере (SSR) — карточки индексируются поисковиками.
export const API = process.env.NEXT_PUBLIC_API_URL || "https://srnchv-zotov-prototype-27ea.twc1.net/api";

type Base = { id: string; type: string; title: string; status: string; [k: string]: unknown };
export type Entity = Base & { links?: string[] };
export type EntityFull = Base & { links: Entity[] };

export const TYPES: Record<string, { l: string; pl: string }> = {
  material: { l: "Материал", pl: "Материалы" }, person: { l: "Личность", pl: "Личности" },
  place: { l: "Место", pl: "Места" }, event: { l: "Событие", pl: "События" },
  theme: { l: "Тема", pl: "Темы" }, project: { l: "Выставка / проект", pl: "Проекты Центра" },
  org: { l: "Организация", pl: "Организации" }, collection: { l: "Коллекция / фонд", pl: "Коллекции" },
  source: { l: "Источник", pl: "Источники" }, media: { l: "Медиафайл", pl: "Медиафайлы" }, tag: { l: "Тег", pl: "Теги" },
};

async function get<T>(path: string, revalidate = 60): Promise<T> {
  const r = await fetch(API + path, { next: { revalidate } });
  if (!r.ok) throw new Error(`API ${path}: ${r.status}`);
  return r.json();
}

// Полный снимок архива: сущности + связи. Для главной и связанных блоков.
export async function loadArchive() {
  const { entities, links } = await get<{ entities: Entity[]; links: [string, string][] }>("/export");
  const db: Record<string, Entity> = {};
  for (const e of entities) db[e.id] = { ...e, links: [] };
  for (const [a, b] of links) { if (db[a] && db[b]) { db[a].links!.push(b); db[b].links!.push(a); } }
  return db;
}

export const published = (e?: Entity) => !!e && (e.status ?? "published") === "published" && e.type !== "dict";
export const ofType = (db: Record<string, Entity>, t: string) => Object.values(db).filter((e) => e.type === t && published(e));
export const linked = (db: Record<string, Entity>, e: Entity, t?: string) =>
  (e.links || []).map((id) => db[id]).filter((x) => x && published(x) && (!t || x.type === t));

export async function getEntity(id: string): Promise<EntityFull | null> {
  const r = await fetch(`${API}/entities/${encodeURIComponent(id)}`, { next: { revalidate: 60 } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`API entity ${id}: ${r.status}`);
  return r.json();
}

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
export async function searchApi(q: string): Promise<SearchHit[]> {
  try {
    const r = await fetch(`${API}/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
    if (!r.ok) return [];
    return ((await r.json()).items || []) as SearchHit[];
  } catch { return []; }
}
