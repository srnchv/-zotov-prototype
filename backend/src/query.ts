// Серверный поиск, хронограф и карта: та же логика, что на сайте (src/shared — копия frontend/lib), но считается здесь,
// на снимке публичного архива в памяти. Снимок строится из базы один раз и сбрасывается при любой записи (см. app.ts),
// фронт получает только страницу результатов и список фильтров, а не весь архив.
import * as repo from "./repo.js";
import { publicView } from "./publicview.js";
import { imgOf, imgPos, coordsOf, funcGroupOf, type Entity } from "./shared/core.js";
import { buildCats, runSearch, toCard, KINDS, SORTS, CAT_KEYS, PAGE_CATS, authorOrYear, type CatKey } from "./shared/search.js";
import { CKEYS, allEvents, buildChronoCats, decodeSel, makeChronoMatch, eventDate, chronoRange, sortInYear, type Sel } from "./shared/chrono.js";
import { MKEYS, allPlaces, buildMapCats, runMap, placeStatus, placeType } from "./shared/map.js";

type Db = Record<string, Entity>;
let snap: { db: Db; at: number } | null = null;
let building: Promise<Db> | null = null;
export function invalidate() { snap = null; }
export async function db(): Promise<Db> {
  if (snap) return snap.db;
  if (building) return building;
  building = (async () => {
    const { entities, links } = await repo.exportAll();
    const pub = publicView(entities as any[]);
    const d: Db = {};
    for (const e of pub) d[e.id] = { ...e, links: [] };
    for (const [a, b] of links as [string, string][]) { if (d[a] && d[b]) { d[a].links!.push(b); d[b].links!.push(a); } }
    snap = { db: d, at: Date.now() };
    building = null;
    return d;
  })();
  return building;
}
export const snapshotInfo = () => ({ cached: !!snap, at: snap?.at || 0, entities: snap ? Object.keys(snap.db).length : 0 });

type Q = Record<string, string | string[] | undefined>;
const arr = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).flatMap((x) => String(x).split("|")).filter(Boolean);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";
const s = (e: Entity, k: string) => String(e[k] ?? "");

// ---- поиск и разделы (личности, тексты) ----
export async function search(q: Q, section?: "person" | "text") {
  const d = await db();
  const keys: CatKey[] = section ? PAGE_CATS[section] : CAT_KEYS;
  const cats = buildCats(d).filter((c) => keys.includes(c.key)).sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key));
  const sel = Object.fromEntries(keys.map((k) => [k, arr(q[k])])) as Record<CatKey, string[]>;
  sel.per?.sort();
  const text = one(q.q).trim();
  const type = section || (KINDS.some(([k]) => k === one(q.type)) ? one(q.type) : "");
  const sortIn = SORTS.some(([k]) => k === one(q.sort)) ? one(q.sort) : "";
  const r = runSearch(d, { q: text, sel, type, sort: sortIn, page: Number(one(q.page)) || 1, titleOnly: !!section, perPage: section ? 36 : undefined }, cats);
  const cards = r.items.map((e) => { const c = toCard(d, e, (x) => imgOf(d, x), (x) => imgPos(d, x)); return section === "text" ? { ...c, date: authorOrYear(e) } : c; });
  return { cats, sel, q: text, type, sortIn, total: r.total, counts: r.counts, page: r.page, pages: r.pages, sort: r.sort, cards };
}

// ---- хронограф ----
export async function chrono(q: Q) {
  const d = await db();
  const events = allEvents(d);
  const cats = buildChronoCats(d, events);
  const tokens = Object.fromEntries(CKEYS.map((k) => [k, arr(q[k])])) as Record<string, string[]>;
  const sel = Object.fromEntries(cats.map((c) => [c.key, decodeSel(c, tokens[c.key] || [])])) as Record<string, Sel>;
  const match = makeChronoMatch(d, cats, sel);
  const found = events.filter((e) => eventDate(e).y && match(e)).sort((a, b) => eventDate(a).y - eventDate(b).y || sortInYear(a, b));
  const [from, to] = chronoRange(d, events);
  const hasAny = [...new Set(events.map((e) => eventDate(e).y))], hasFound = [...new Set(found.map((e) => eventDate(e).y))];
  const items = found.map((e) => ({ id: e.id, title: e.title, year: eventDate(e).y, sub: (() => { const t = s(e, "subtype") || s(e, "evType"); return t && t !== "Событие" ? t : ""; })(), img: imgOf(d, e), pos: imgPos(d, e) }));
  return { cats, tokens, sel: Object.fromEntries(cats.map((c) => [c.key, { ids: sel[c.key].ids, tokens: sel[c.key].tokens }])), from, to, hasAny, hasFound, total: found.length, items };
}

// ---- карта ----
export async function map(q: Q) {
  const d = await db();
  const places = allPlaces(d).filter((p) => coordsOf(p));
  const cats = buildMapCats(d, places);
  const tokens = Object.fromEntries(MKEYS.map((k) => [k, arr(q[k])])) as Record<string, string[]>;
  const text = one(q.q).trim();
  const sortIn = ["rel", "az", "za"].includes(one(q.sort)) ? one(q.sort) : "";
  const { found, sel, sort } = runMap(d, places, cats, tokens, text, sortIn);
  const items = found.map((p) => { const c = coordsOf(p)!; return { id: p.id, title: p.title, city: s(p, "city"), address: s(p, "address"), type: placeType(p), status: placeStatus(p), lat: c[0], lon: c[1], img: imgOf(d, p, true), pos: imgPos(d, p) }; });
  return { cats, tokens, q: text, sortIn, sort, sel: Object.fromEntries(cats.map((c) => [c.key, { ids: sel[c.key].ids, tokens: sel[c.key].tokens }])), total: found.length, items };
}
