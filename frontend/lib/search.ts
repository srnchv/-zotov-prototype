// Логика поиска по ТЗ DEV «Поиск»: строка запроса, 8 категорий фильтров, типология, сортировка, пагинация.
// Работает над снимком архива (loadArchive). Значения фильтров — из справочников админки (dict-*), не хардкод.
import { published, linked, type Entity } from "./api";

export type Leaf = { id: string; title: string };
// группа фильтра: title "" — плоский список; leaf — тип без подтипов (одна строка с чекбоксом на уровне групп)
export type Group = { id: string; title: string; items: Leaf[]; leaf?: boolean };
export type CatKey = "mat" | "theme" | "place" | "person" | "event" | "coll" | "text" | "per";
export type Cat = { key: CatKey; label: string; chip: string; ph: string; groups: Group[] };
export type Params = { q: string; sel: Record<CatKey, string[]>; type: string; sort: string; page: number };
export const CAT_KEYS: CatKey[] = ["mat", "theme", "place", "person", "event", "coll", "text", "per"];
export const PER_PAGE = 48;

// типология: ключ в URL → подпись в списке (порядок как в макете)
export const KINDS: [string, string][] = [["material", "материал"], ["theme", "тема"], ["place", "место"], ["person", "личность"], ["event", "событие"], ["collection", "коллекция"], ["text", "текст"], ["project", "проект Центра"]];
export const SORTS: [string, string][] = [["rel", "по релевантности"], ["az", "по алфавиту (А–Я)"], ["za", "по алфавиту (Я–А)"]];
const CARD_TYPE: Record<string, string> = { material: "Материал", theme: "Тема", place: "Место", person: "Личность", event: "Событие", collection: "Коллекция", text: "Текст", project: "Проект Центра" };

const s = (e: Entity | undefined, k: string) => String(e?.[k] ?? "").trim();
const SEP = " › ";
// базовый список типов материалов — как в админке (model.ts TYPELIST)
const MTYPES = ["Видео", "Аудио", "Изображение", "Текст", "Документ", "Печатная продукция", "Графика", "Живопись", "Макет", "Предмет / ДПИ", "Цифровой объект", "Сенсорный материал"];

// ---- вид сущности в выдаче: источник-текст считается «текстом», записи и прочее в поиск не идут ----
export const kindOf = (e: Entity) => (e.type === "source" ? (s(e, "srcKind") === "record" ? "" : "text") : e.type);
const inUniverse = (e: Entity) => published(e) && KINDS.some(([k]) => k === kindOf(e));

// ---- тип/подтип места: исторически хранятся одной строкой «Тип · подтип» ----
const placeTS = (e: Entity): [string, string] => { const [t, ...r] = s(e, "placeType").split(" · "); return [t.trim(), s(e, "subtype") || r.join(" · ").trim()]; };
const typeSub = (e: Entity): [string, string] => {
  if (e.type === "place") return placeTS(e);
  if (e.type === "material") return [s(e, "mtype"), s(e, "subtype")];
  if (e.type === "event") return [s(e, "evType"), s(e, "subtype")];
  return ["", ""];
};

// ---- справочники: значения из данных + добавленные − убранные, порядок из админки ----
function dict(db: Record<string, Entity>, key: string, base: string[]) {
  const d = db["dict-" + key] || ({} as Entity);
  const rem = new Set<string>((d.removed as string[]) || []);
  const vals = [...new Set([...base, ...((d.added as string[]) || [])])].filter((v) => v && !rem.has(v));
  const order = (d.order as string[]) || [];
  const at = (v: string) => { const i = order.indexOf(v); return i < 0 ? 1e6 : i; };
  return vals.sort((a, b) => at(a) - at(b) || a.localeCompare(b, "ru"));
}
const uniq = (a: string[]) => [...new Set(a.filter(Boolean))];

// ---- годы сущности для Периода и подписи карточки ----
const years = (v: string) => (v.match(/\d{4}/g) || []).map(Number);
function periodYears(e: Entity): number[] {
  const k = kindOf(e);
  if (k === "theme" || k === "collection") return [];
  if (k === "person") return years(s(e, "life")).slice(0, 1); // год рождения
  if (k === "text") return years(s(e, "year") || s(e, "date")).slice(0, 1);
  if (k === "project") { const y = years(s(e, "dates")); return y.length ? uniq([String(y[0]), String(y[y.length - 1])]).map(Number) : []; } // начало или окончание
  return years(s(e, "date")).slice(0, 1); // материал, событие, место — первый год
}
export function periodRange(db: Record<string, Entity>): [number, number] {
  const d = db["dict-period"];
  const from = Number(d?.from), to = Number(d?.to);
  if (from && to && to >= from) return [from, to];
  const all = Object.values(db).filter(inUniverse).flatMap(periodYears);
  if (!all.length) return [1900, 1939];
  return [Math.floor(Math.min(...all) / 10) * 10, Math.floor(Math.max(...all) / 10) * 10 + 9];
}

// ---- категории фильтров (окна выбора) ----
export function buildCats(db: Record<string, Entity>): Cat[] {
  const all = Object.values(db).filter(published);
  const of = (t: string) => all.filter((e) => e.type === t);
  const byTitle = (a: Entity, b: Entity) => a.title.localeCompare(b.title, "ru");
  // тип → подтипы (2 уровня): подтипы из справочника sub:<ключ> («Тип › Подтип») и из данных
  const twoLevel = (t: string, key: string, base: string[]): Group[] => {
    const ents = of(t);
    const types = dict(db, key, uniq([...base, ...ents.map((e) => typeSub(e)[0])]));
    const subs = dict(db, "sub:" + key, uniq(ents.map((e) => { const [a, b] = typeSub(e); return a && b ? a + SEP + b : ""; })));
    return types.map((tp) => {
      const items = subs.filter((v) => v.startsWith(tp + SEP)).map((v) => ({ id: v, title: v.slice(tp.length + SEP.length) }));
      return items.length ? { id: tp, title: tp, items } : { id: tp, title: tp, items: [{ id: tp, title: tp }], leaf: true };
    });
  };
  const flat = (vals: string[]): Group[] => [{ id: "", title: "", items: vals.map((v) => ({ id: v, title: v })) }];
  // личности: тип личности → личности
  const persons = of("person").sort(byTitle);
  const pGroups = dict(db, "group", uniq(persons.map((p) => s(p, "group"))));
  const personGroups: Group[] = pGroups.map((g) => ({ id: g, title: g, items: persons.filter((p) => s(p, "group") === g).map((p) => ({ id: p.id, title: p.title })) })).filter((g) => g.items.length);
  const noGroup = persons.filter((p) => !pGroups.includes(s(p, "group")));
  if (noGroup.length) personGroups.push({ id: "_", title: "Другие", items: noGroup.map((p) => ({ id: p.id, title: p.title })) });
  // период: десятилетия → годы из диапазона админки
  const [from, to] = periodRange(db);
  const decades: Group[] = [];
  for (let d = Math.floor(from / 10) * 10; d <= to; d += 10) {
    const items: Leaf[] = [];
    for (let y = Math.max(d, from); y <= Math.min(d + 9, to); y++) items.push({ id: String(y), title: String(y) });
    if (items.length) decades.push({ id: "d" + d, title: `${d}-е`, items });
  }
  const texts = all.filter((e) => kindOf(e) === "text");
  return [
    { key: "mat", label: "Материал", chip: "Материал", ph: "Название", groups: twoLevel("material", "mtype", MTYPES) },
    { key: "theme", label: "Тема", chip: "Тема", ph: "Название", groups: [{ id: "", title: "", items: of("theme").sort(byTitle).map((t) => ({ id: t.id, title: t.title })) }] },
    { key: "place", label: "Место", chip: "Место", ph: "Название", groups: twoLevel("place", "placeType", []) },
    { key: "person", label: "Личность", chip: "Личность", ph: "Имя, фамилия", groups: personGroups },
    { key: "event", label: "Событие", chip: "Событие", ph: "Название", groups: twoLevel("event", "evType", []) },
    { key: "coll", label: "Коллекция", chip: "Коллекция", ph: "Название", groups: flat(dict(db, "colType", uniq(of("collection").map((c) => s(c, "colType"))))) },
    { key: "text", label: "Текст", chip: "Текст", ph: "Название", groups: flat(dict(db, "srcType", uniq(texts.map((t) => s(t, "srcType"))))) },
    { key: "per", label: "Период", chip: "Период", ph: "Год", groups: decades },
  ];
}

// ---- проверка фильтров ----
// значение подходит, если оно есть у самой сущности или у связанной с ней (ТЗ: «Личность: Родченко» → сам Родченко и всё, что с ним связано)
function selfOrLinked(db: Record<string, Entity>, e: Entity, test: (x: Entity) => boolean) {
  if (test(e)) return true;
  return (e.links || []).some((id) => { const x = db[id]; return !!x && published(x) && test(x); });
}
// тип/подтип: целиком выбранный тип (все подтипы) — любая сущность этого типа, иначе — выбранные подтипы
function typeTest(groups: Group[], sel: Set<string>, ofType: string) {
  const fullTypes = new Set(groups.filter((g) => g.items.length && g.items.every((i) => sel.has(i.id))).map((g) => g.id));
  return (x: Entity) => {
    if (x.type !== ofType) return false;
    const [t, sub] = typeSub(x);
    return fullTypes.has(t) || sel.has(t + SEP + sub);
  };
}

type Built = { cats: Cat[]; cat: Record<CatKey, Cat> };
export function makeMatchers(db: Record<string, Entity>, b: Built, sel: Record<CatKey, string[]>) {
  const tests: ((e: Entity) => boolean)[] = [];
  for (const k of CAT_KEYS) {
    const chosen = new Set(sel[k] || []);
    if (!chosen.size) continue;
    const c = b.cat[k];
    if (k === "mat") { const t = typeTest(c.groups, chosen, "material"); tests.push((e) => selfOrLinked(db, e, t)); }
    if (k === "place") { const t = typeTest(c.groups, chosen, "place"); tests.push((e) => selfOrLinked(db, e, t)); }
    if (k === "event") { const t = typeTest(c.groups, chosen, "event"); tests.push((e) => selfOrLinked(db, e, t)); }
    if (k === "coll") tests.push((e) => selfOrLinked(db, e, (x) => x.type === "collection" && chosen.has(s(x, "colType"))));
    if (k === "text") tests.push((e) => selfOrLinked(db, e, (x) => kindOf(x) === "text" && chosen.has(s(x, "srcType"))));
    if (k === "theme") for (const id of chosen) tests.push((e) => e.id === id || (e.links || []).includes(id)); // темы — «И»
    if (k === "person") {
      // целиком выбранный тип личности — «ИЛИ» по его участникам; отдельно выбранные личности — «И»
      const full = c.groups.filter((g) => g.items.every((i) => chosen.has(i.id)));
      const anyOf = new Set(full.flatMap((g) => g.items.map((i) => i.id)));
      if (anyOf.size) tests.push((e) => anyOf.has(e.id) || (e.links || []).some((id) => anyOf.has(id)));
      for (const id of chosen) if (!anyOf.has(id)) tests.push((e) => e.id === id || (e.links || []).includes(id));
    }
    if (k === "per") { const ys = new Set([...chosen].map(Number)); tests.push((e) => periodYears(e).some((y) => ys.has(y))); } // по своей дате
  }
  return (e: Entity) => tests.every((t) => t(e));
}

// ---- строка запроса: название + названия связанных сущностей + типы/подтипы (описания не ищем) ----
const norm = (v: string) => v.toLowerCase().replace(/ё/g, "е").replace(/[«»"“”„'()[\],.:;!?—–-]+/g, " ").replace(/\s+/g, " ").trim();
const stem = (w: string) => (w.length > 5 ? w.slice(0, w.length - 2) : w); // грубая основа: «выставки» ≈ «выставка»
const hits = (words: string[], tok: string) => { const st = stem(tok); return words.some((w) => w.startsWith(st)); };
function relevance(db: Record<string, Entity>, e: Entity, q: string, toks: string[]): number {
  const title = norm(e.title), tw = title.split(" ");
  const own = [title, ...typeSub(e), s(e, "group"), s(e, "colType"), s(e, "srcType"), s(e, "prType")].map(norm).join(" ").split(" ");
  const rel = (e.links || []).map((id) => db[id]).filter((x) => x && published(x) && x.type !== "media").map((x) => norm(x!.title)).join(" ").split(" ");
  if (!toks.every((t) => hits(own, t) || hits(rel, t))) return 0;
  if (title === q) return 1000;
  if (title.includes(q)) return 800;
  if (toks.every((t) => hits(tw, t))) return 600; // всё совпало в названии
  if (toks.every((t) => hits(own, t))) return 300; // через тип/подтип
  return 100; // через связанные сущности
}

// ---- карточка выдачи (поля по ТЗ) ----
export type Card = { id: string; title: string; date: string; type: string; sub: string; img: string; pos?: string };
const plural = (n: number, f: [string, string, string]) => { const a = n % 10, b = n % 100; return f[b >= 11 && b <= 14 ? 2 : a === 1 ? 0 : a >= 2 && a <= 4 ? 1 : 2]; };
export const fmt = (n: number) => n.toLocaleString("ru-RU");
export const resultsWord = (n: number) => plural(n, ["результат", "результата", "результатов"]);
const nMat = (db: Record<string, Entity>, e: Entity) => { const n = linked(db, e, "material").length; return `${fmt(n)} ${plural(n, ["материал", "материала", "материалов"])}`; };
function dateLabel(e: Entity) {
  const k = kindOf(e);
  if (k === "person") return s(e, "life").replace(/\s*[-—]\s*/g, "–");
  if (k === "project") return s(e, "dates");
  if (k === "theme" || k === "collection") return "";
  const y = years(k === "text" ? s(e, "year") || s(e, "date") : s(e, "date"));
  if (!y.length) return "";
  return y.length > 1 && y[y.length - 1] !== y[0] ? `${y[0]}–${y[y.length - 1]}` : String(y[0]);
}
function subLabel(db: Record<string, Entity>, e: Entity) {
  const k = kindOf(e);
  if (k === "material") return s(e, "subtype") || s(e, "mtype");
  if (k === "theme" || k === "collection") return nMat(db, e);
  if (k === "place") { const [t, sub] = placeTS(e); return sub || t; }
  if (k === "person") return s(e, "group");
  return "";
}
export function toCard(db: Record<string, Entity>, e: Entity, img: (e: Entity) => string, pos: (e: Entity) => string | undefined): Card {
  return { id: e.id, title: e.title, date: dateLabel(e), type: CARD_TYPE[kindOf(e)] || "", sub: subLabel(db, e), img: img(e), pos: pos(e) };
}

// ---- поиск целиком ----
export function runSearch(db: Record<string, Entity>, p: Params, cats: Cat[]) {
  const cat = Object.fromEntries(cats.map((c) => [c.key, c])) as Record<CatKey, Cat>;
  const match = makeMatchers(db, { cats, cat }, p.sel);
  const q = norm(p.q), toks = q ? q.split(" ").filter(Boolean) : [];
  const scored: { e: Entity; r: number }[] = [];
  for (const e of Object.values(db)) {
    if (!inUniverse(e) || !match(e)) continue;
    const r = toks.length ? relevance(db, e, q, toks) : 1;
    if (r) scored.push({ e, r });
  }
  // количество по типам — с учётом запроса и фильтров, до типологии
  const counts: Record<string, number> = {};
  for (const { e } of scored) counts[kindOf(e)] = (counts[kindOf(e)] || 0) + 1;
  let list = p.type ? scored.filter((x) => kindOf(x.e) === p.type) : scored;
  // алфавит — без кавычек и скобок в начале названия («Про это» — на «П»)
  const key = (e: Entity) => e.title.replace(/^[\s«»"„“”'(\[]+/, "");
  const az = (a: Entity, b: Entity) => key(a).localeCompare(key(b), "ru");
  const sort = p.sort || (toks.length ? "rel" : "az");
  list = [...list].sort((a, b) => (sort === "za" ? az(b.e, a.e) : sort === "rel" ? b.r - a.r || az(a.e, b.e) : az(a.e, b.e)));
  const total = list.length, pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(Math.max(1, p.page), pages);
  return { total, counts, all: scored.length, page, pages, sort, items: list.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((x) => x.e), cat };
}
