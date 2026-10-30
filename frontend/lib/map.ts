// Логика страницы «Карта» по ТЗ DEV: места архива с координатами, поиск по названию и адресу,
// шесть категорий фильтров (Город, Функция, Период, Автор, Заказчик, Статус ОКН), сортировка списка.
// Внутри категории — «ИЛИ», между категориями — «И» (решение 27.10, как в поиске и хронографе).
import { published, type Entity, funcGroupOf } from "./api";
import type { Group, Leaf } from "./search";
import { decodeSel, type FCat, type Sel } from "./chrono";

export const MKEYS = ["city", "func", "per", "author", "customer", "okn"] as const;
export const UNKNOWN_ARCH = "Неизвестный архитектор"; // служебное значение — всегда последним в группе «Архитекторы»
const AUTHOR_GROUPS = ["Архитекторы", "Инженеры", "Проектные организации"];
export const CUSTOMER_DEF = ["правительство", "ведомство", "управление", "муниципалитет", "кооператив", "профсоюз", "общественная организация", "неустановленный застройщик"];
export const OKN_DEF = ["федерального значения", "регионального значения", "местного значения", "выявленный", "не является ОКН"];
const SEP = " › ";
const s = (e: Entity | undefined, k: string) => String(e?.[k] ?? "").trim();
const arr = (e: Entity, k: string): string[] => (Array.isArray(e[k]) ? (e[k] as unknown[]).map(String) : s(e, k) ? [s(e, k)] : []);
const uniq = (a: string[]) => [...new Set(a.filter(Boolean))];
const norm = (v: string) => v.toLowerCase().replace(/ё/g, "е").replace(/[«»"“”„'()[\],.:;!?—–-]+/g, " ").replace(/\s+/g, " ").trim();

function dict(db: Record<string, Entity>, key: string, base: string[], alpha = false) {
  const d = db["dict-" + key] || ({} as Entity);
  const rem = new Set<string>((d.removed as string[]) || []);
  const vals = uniq([...base, ...((d.added as string[]) || [])]).filter((v) => !rem.has(v));
  const order = (d.order as string[]) || [];
  const at = (v: string) => { const i = order.indexOf(v); return i < 0 ? 1e6 : i; };
  return alpha ? vals.sort((a, b) => a.localeCompare(b, "ru")) : vals.sort((a, b) => at(a) - at(b) || a.localeCompare(b, "ru"));
}
export const coordsOf = (e: Entity): [number, number] | null => {
  const lat = parseFloat(s(e, "lat").replace(",", ".")), lon = parseFloat(s(e, "lon").replace(",", "."));
  return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
};
export const allPlaces = (db: Record<string, Entity>) => Object.values(db).filter((e) => e.type === "place" && published(e));
const firstYear = (e: Entity) => Number((s(e, "date").match(/\d{4}/) || [0])[0]);
export const placeStatus = (e: Entity) => (/утрач/i.test(s(e, "placeStatus")) ? "lost" : "exists") as "lost" | "exists";
export const placeType = (e: Entity) => funcGroupOf(e); // тип места = группа функции

// ---- категории ----
export function buildMapCats(db: Record<string, Entity>, places: Entity[]): FCat[] {
  const cities = dict(db, "city", uniq([...places.map((p) => s(p, "city")), ...Object.values(db).filter((e) => e.type === "event").map((e) => s(e, "city"))]));
  // функция: группа › функция (справочник sub:func)
  const fGroups = dict(db, "func", uniq(places.flatMap((p) => arr(p, "functions").map((v) => v.split(SEP)[0]))));
  const fSubs = dict(db, "sub:func", uniq(places.flatMap((p) => arr(p, "functions").filter((v) => v.includes(SEP)))));
  const funcGroups: Group[] = fGroups.map((g) => ({ id: g, title: g, items: fSubs.filter((v) => v.startsWith(g + SEP)).map((v) => ({ id: v, title: v.slice(g.length + SEP.length) })) })).filter((g) => g.items.length);
  // автор: три группы; архитекторы и инженеры — по алфавиту, «Неизвестный архитектор» последним; проектные организации — порядок из админки
  const aSubs = dict(db, "sub:author", uniq(places.flatMap((p) => arr(p, "authors").filter((v) => v.includes(SEP)))));
  const authorGroups: Group[] = AUTHOR_GROUPS.map((g) => {
    let items: Leaf[] = aSubs.filter((v) => v.startsWith(g + SEP)).map((v) => ({ id: v, title: v.slice(g.length + SEP.length) }));
    if (g !== "Проектные организации") items = items.sort((a, b) => a.title.localeCompare(b.title, "ru"));
    if (g === "Архитекторы") { const u = items.find((i) => i.title === UNKNOWN_ARCH); items = items.filter((i) => i !== u); if (u) items.push(u); else items.push({ id: g + SEP + UNKNOWN_ARCH, title: UNKNOWN_ARCH }); }
    return { id: g, title: g, items };
  }).filter((g) => g.items.length);
  // период: общий диапазон из админки (dict-period), десятилетия → годы
  const d = db["dict-period"]; let from = Number(d?.from), to = Number(d?.to);
  if (!from || !to || to < from) { const ys = places.map(firstYear).filter(Boolean); from = ys.length ? Math.floor(Math.min(...ys) / 10) * 10 : 1900; to = ys.length ? Math.floor(Math.max(...ys) / 10) * 10 + 9 : 1939; }
  const decades: Group[] = [];
  for (let dd = Math.floor(from / 10) * 10; dd <= to; dd += 10) { const items: Leaf[] = []; for (let y = Math.max(dd, from); y <= Math.min(dd + 9, to); y++) items.push({ id: String(y), title: String(y) }); if (items.length) decades.push({ id: "d" + dd, title: `${dd}-е`, items }); }
  const flat = (vals: string[]): Group[] => [{ id: "", title: "", items: vals.map((v) => ({ id: v, title: v })) }];
  return [
    { key: "city", label: "Город", chip: "Город", ph: "Город", groups: flat(cities) },
    { key: "func", label: "Функция", chip: "Функция", ph: "Функция", groups: funcGroups },
    { key: "per", label: "Период", chip: "Период", ph: "Год", groups: decades },
    { key: "author", label: "Автор", chip: "Автор", ph: "Имя, фамилия", groups: authorGroups },
    { key: "customer", label: "Заказчик", chip: "Заказчик", ph: "Заказчик", groups: flat(dict(db, "customer", uniq([...CUSTOMER_DEF, ...places.flatMap((p) => arr(p, "customers"))]))) },
    { key: "okn", label: "Статус ОКН", chip: "Статус ОКН", ph: "Статус ОКН", groups: flat(dict(db, "okn", uniq([...OKN_DEF, ...places.map((p) => s(p, "okn"))]))) },
  ];
}

// ---- отбор мест: запрос (название, адрес) + фильтры ----
export function runMap(db: Record<string, Entity>, places: Entity[], cats: FCat[], tokens: Record<string, string[]>, q: string, sort: string) {
  const sel = Object.fromEntries(cats.map((c) => [c.key, decodeSel(c, tokens[c.key] || [])])) as Record<string, Sel>;
  const tests: ((e: Entity) => boolean)[] = [];
  for (const c of cats) {
    const ids = sel[c.key].ids; if (!ids.length) continue;
    const chosen = new Set(ids);
    if (c.key === "city") tests.push((e) => chosen.has(s(e, "city")));
    if (c.key === "func") tests.push((e) => arr(e, "functions").some((v) => chosen.has(v)));
    if (c.key === "per") { const ys = new Set(ids.map(Number)); tests.push((e) => ys.has(firstYear(e))); }
    if (c.key === "author") tests.push((e) => arr(e, "authors").some((v) => chosen.has(v)));
    if (c.key === "customer") tests.push((e) => arr(e, "customers").some((v) => chosen.has(v)));
    if (c.key === "okn") tests.push((e) => chosen.has(s(e, "okn")));
  }
  const nq = norm(q), toks = nq ? nq.split(" ") : [];
  const score = (e: Entity) => {
    if (!toks.length) return 1;
    const t = norm(e.title), a = norm(s(e, "address") + " " + s(e, "city"));
    if (!toks.every((w) => t.includes(w) || a.includes(w))) return 0;
    return t === nq ? 1000 : t.includes(nq) ? 800 : toks.every((w) => t.includes(w)) ? 600 : 300;
  };
  const key = (e: Entity) => e.title.replace(/^[\s«»"„“”'(\[]+/, "");
  const az = (a: Entity, b: Entity) => key(a).localeCompare(key(b), "ru");
  const srt = sort || (toks.length ? "rel" : "az");
  const found = places.map((e) => ({ e, r: tests.every((t) => t(e)) ? score(e) : 0 })).filter((x) => x.r > 0)
    .sort((a, b) => (srt === "za" ? az(b.e, a.e) : srt === "rel" ? b.r - a.r || az(a.e, b.e) : az(a.e, b.e))).map((x) => x.e);
  return { found, sel, sort: srt };
}
