// Слой данных: единственное место, где фронт знает про API стенда. Чистая логика — в ./core (общая с сервером).
export * from "./core";
import { type Entity, type EntityFull, type SearchHit, type Style } from "./core";
import type { Cat } from "./search";
// loadArchive — снимок архива с бэкенда (сущности + связи), строим индекс по id
// Полный снимок архива: сущности + связи. Для главной и связанных блоков.
export async function loadArchive() {
  const { entities, links } = await get<{ entities: Entity[]; links: [string, string][] }>("/export");
  const db: Record<string, Entity> = {};
  for (const e of entities) db[e.id] = { ...e, links: [] };
  for (const [a, b] of links) { if (db[a] && db[b]) { db[a].links!.push(b); db[b].links!.push(a); } }
  return db;
}

// Слой данных: единственное место, где фронт знает про API стенда.
export const API = process.env.NEXT_PUBLIC_API_URL || "https://srnchv-zotov-prototype-27ea.twc1.net/api";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(API + path, { next: { tags: ["archive"], revalidate: 3600 } });
  if (!r.ok) throw new Error(`API ${path}: ${r.status}`);
  return r.json();
}

export async function getEntity(id: string): Promise<EntityFull | null> {
  const r = await fetch(`${API}/entities/${encodeURIComponent(id)}`, { next: { tags: ["archive"], revalidate: 3600 } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`API entity ${id}: ${r.status}`);
  return r.json();
}

export async function searchApi(q: string): Promise<SearchHit[]> {
  try {
    const r = await fetch(`${API}/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
    if (!r.ok) return [];
    return ((await r.json()).items || []) as SearchHit[];
  } catch { return []; }
}

// Серверный поиск / хронограф / карта: в API уходят только параметры адреса, обратно — фильтры и страница результатов.
// Ответы кэшируются как и остальные данные (тег archive) — сбрасываются из админки при сохранении.
export type SP = Record<string, string | string[] | undefined>;
function qs(raw: SP, keys: readonly string[]) {
  const p = new URLSearchParams();
  for (const k of keys) for (const v of (Array.isArray(raw[k]) ? raw[k] as string[] : raw[k] ? [raw[k] as string] : [])) if (v) p.append(k, v);
  const q = p.toString();
  return q ? "?" + q : "";
}
export type QCard = { id: string; title: string; date: string; type: string; sub: string; img: string; pos?: Style };
export type QSearch = { cats: Cat[]; sel: Record<string, string[]>; q: string; type: string; sortIn: string; total: number; counts: Record<string, number>; page: number; pages: number; sort: string; cards: QCard[] };
export const qSearch = (raw: SP, keys: readonly string[], extra: Record<string, string> = {}) => get<QSearch>("/q/search" + qs({ ...raw, ...extra }, [...keys, "q", "type", "sort", "page", "section"]));
export type QSel = Record<string, { ids: string[]; tokens: string[] }>;
export type QChrono = { cats: Cat[]; tokens: Record<string, string[]>; sel: QSel; from: number; to: number; hasAny: number[]; hasFound: number[]; total: number; items: { id: string; title: string; year: number; sub: string; img: string; pos?: Style }[] };
export const qChrono = (raw: SP, keys: readonly string[]) => get<QChrono>("/q/chrono" + qs(raw, keys));
export type QMap = { cats: Cat[]; tokens: Record<string, string[]>; q: string; sortIn: string; sort: string; sel: QSel; total: number; items: { id: string; title: string; city: string; address: string; type: string; status: "exists" | "lost"; lat: number; lon: number; img: string; pos?: Style }[] };
export const qMap = (raw: SP, keys: readonly string[]) => get<QMap>("/q/map" + qs(raw, [...keys, "q", "sort"]));

export async function getConfig(): Promise<{ ymapsKey: string; ymapsV3?: boolean; mediaUrl?: string; hlsDirect?: boolean }> {
  try { const r = await fetch(`${API}/config`, { next: { revalidate: 300 } }); if (r.ok) return r.json(); } catch {}
  return { ymapsKey: "" };
}