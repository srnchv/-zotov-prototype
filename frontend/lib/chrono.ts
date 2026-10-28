// Логика хронографа по ТЗ DEV «Хронограф»: все события архива по годам, пять категорий фильтров
// (Личность, Организация, Тема, Событие, Город), таймлайн по диапазону из админки.
// Внутри категории всё по «ИЛИ». Группы в адресе хранятся как g:<группа>, снятые из неё элементы — как x:<id>
// (компактный адрес и чипсы по элементам).
import { published, type Entity } from "./api";
import type { Group, Leaf } from "./search";
// категория фильтра (структура общая с поиском)
export type FCat = { key: string; label: string; labelM?: string; chip: string; ph: string; groups: Group[] }; // labelM — короткая подпись на узких экранах

export const CKEYS = ["person", "org", "theme", "event", "city"] as const;
export type CKey = (typeof CKEYS)[number];
const s = (e: Entity | undefined, k: string) => String(e?.[k] ?? "").trim();
const SEP = " › ";
const uniq = (a: string[]) => [...new Set(a.filter(Boolean))];
const byTitle = (a: Entity, b: Entity) => a.title.localeCompare(b.title, "ru");

// справочник: значения из данных + добавленные − убранные, порядок из админки
function dict(db: Record<string, Entity>, key: string, base: string[]) {
  const d = db["dict-" + key] || ({} as Entity);
  const rem = new Set<string>((d.removed as string[]) || []);
  const vals = uniq([...base, ...((d.added as string[]) || [])]).filter((v) => !rem.has(v));
  const order = (d.order as string[]) || [];
  const at = (v: string) => { const i = order.indexOf(v); return i < 0 ? 1e6 : i; };
  return vals.sort((a, b) => at(a) - at(b) || a.localeCompare(b, "ru"));
}

// ---- даты события: год, месяц, день (для порядка внутри года) ----
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
export function eventDate(e: Entity): { y: number; m: number; d: number; exact: boolean } {
  const v = s(e, "date");
  const y = Number((v.match(/\d{4}/) || [0])[0]); // первый год (диапазон — по первому)
  let m = 0, d = 0;
  const dm = v.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/); // 12.03.1927
  if (dm) { d = +dm[1]; m = +dm[2]; }
  else {
    const mi = MONTHS.findIndex((mn) => v.toLowerCase().includes(mn));
    if (mi >= 0) { m = mi + 1; const dd = v.match(/(\d{1,2})\s+[а-я]+/i); if (dd) d = +dd[1]; }
    else { const ym = v.match(/(\d{4})-(\d{2})(?:-(\d{2}))?/); if (ym) { m = +ym[2]; d = ym[3] ? +ym[3] : 0; } }
  }
  return { y, m, d, exact: m > 0 };
}
// город события: своё поле, иначе — город привязанного места
export function eventCity(db: Record<string, Entity>, e: Entity) {
  const own = s(e, "city"); if (own) return own;
  const pl = (e.links || []).map((id) => db[id]).find((x) => x && x.type === "place" && s(x, "city"));
  return pl ? s(pl, "city") : "";
}
export const allEvents = (db: Record<string, Entity>) => Object.values(db).filter((e) => e.type === "event" && published(e));

// ---- диапазон таймлайна: из админки (dict-chrono from/to), иначе по событиям ----
export function chronoRange(db: Record<string, Entity>, events: Entity[]): [number, number] {
  const d = db["dict-chrono"];
  const from = Number(d?.from), to = Number(d?.to);
  if (from && to && to >= from) return [from, to];
  const ys = events.map((e) => eventDate(e).y).filter(Boolean);
  return ys.length ? [Math.min(...ys), Math.max(...ys)] : [1920, 1935];
}

// ---- категории фильтров ----
export function buildChronoCats(db: Record<string, Entity>, events: Entity[]): FCat[] {
  const all = Object.values(db).filter(published);
  const of = (t: string) => all.filter((e) => e.type === t).sort(byTitle);
  const grouped = (ents: Entity[], gkey: string, dictKey: string, other: string): Group[] => {
    const groups = dict(db, dictKey, uniq(ents.map((e) => s(e, gkey))));
    const out: Group[] = groups.map((g) => ({ id: g, title: g, items: ents.filter((e) => s(e, gkey) === g).map((e) => ({ id: e.id, title: e.title })) })).filter((g) => g.items.length);
    const rest = ents.filter((e) => !groups.includes(s(e, gkey)));
    if (rest.length) out.push({ id: "_", title: other, items: rest.map((e) => ({ id: e.id, title: e.title })) });
    return out;
  };
  // тип события → подтипы (как в поиске)
  const types = dict(db, "evType", uniq(events.map((e) => s(e, "evType"))));
  const subs = dict(db, "sub:evType", uniq(events.map((e) => (s(e, "evType") && s(e, "subtype") ? s(e, "evType") + SEP + s(e, "subtype") : ""))));
  const evGroups: Group[] = types.map((t) => { const items: Leaf[] = subs.filter((v) => v.startsWith(t + SEP)).map((v) => ({ id: v, title: v.slice(t.length + SEP.length) })); return items.length ? { id: t, title: t, items } : { id: t, title: t, items: [{ id: t, title: t }], leaf: true }; });
  const cities = dict(db, "city", uniq([...events.map((e) => eventCity(db, e)), ...of("place").map((p) => s(p, "city"))]));
  return [
    { key: "person", label: "Личность", chip: "Личность", ph: "Имя, фамилия", groups: grouped(of("person"), "group", "group", "Другие") },
    { key: "org", label: "Организация", chip: "Организация", ph: "Организация", groups: grouped(of("org"), "orgType", "orgType", "Другие") },
    { key: "theme", label: "Тема", chip: "Тема", ph: "Тема", groups: [{ id: "", title: "", items: of("theme").map((t) => ({ id: t.id, title: t.title })) }] },
    { key: "event", label: "Событие", chip: "Событие", ph: "Событие", groups: evGroups },
    { key: "city", label: "Город", chip: "Город", ph: "Город", groups: [{ id: "", title: "", items: cities.map((c) => ({ id: c, title: c })) }] },
  ];
}

// ---- разбор адреса: токены категории → выбранные элементы с пометкой «из группы» ----
export type Sel = { ids: string[]; grouped: Set<string>; tokens: string[] }; // grouped — элементы, выбранные целой группой (ИЛИ)
export function decodeSel(c: FCat, tokens: string[]): Sel {
  const ids: string[] = [], grouped = new Set<string>();
  const excluded = new Set(tokens.filter((t) => t.startsWith("x:")).map((t) => t.slice(2)));
  for (const t of tokens) {
    if (t.startsWith("g:")) { const g = c.groups.find((x) => x.id === t.slice(2)); if (g) for (const it of g.items) if (!excluded.has(it.id)) { ids.push(it.id); grouped.add(it.id); } }
    else if (!t.startsWith("x:") && !ids.includes(t)) ids.push(t);
  }
  return { ids: [...new Set(ids)], grouped, tokens };
}
// выбор из окна → токены: целиком отмеченная группа — g:; если раньше была g: и часть снята — g: + x:; иначе id по одному
export function encodeSel(c: FCat, ids: string[], prev: string[]): string[] {
  const set = new Set(ids), out: string[] = [], covered = new Set<string>();
  const prevGroups = new Set(prev.filter((t) => t.startsWith("g:")).map((t) => t.slice(2)));
  for (const g of c.groups) {
    if (!g.items.length || (g.items.length === 1 && g.leaf)) continue;
    const members = g.items.map((i) => i.id), inSel = members.filter((id) => set.has(id));
    if (!inSel.length) continue;
    if (inSel.length === members.length) { out.push("g:" + g.id); members.forEach((id) => covered.add(id)); }
    else if (prevGroups.has(g.id)) { out.push("g:" + g.id); members.filter((id) => !set.has(id)).forEach((id) => out.push("x:" + id)); members.forEach((id) => covered.add(id)); }
  }
  for (const id of ids) if (!covered.has(id)) out.push(id);
  return out;
}
// снять один элемент чипсом: из группы — добавить x:, одиночный — убрать id
export function removeOne(c: FCat, tokens: string[], id: string): string[] {
  const sel = decodeSel(c, tokens);
  if (sel.grouped.has(id)) { const t = [...tokens, "x:" + id]; const left = decodeSel(c, t); return left.ids.length ? t : []; }
  return tokens.filter((t) => t !== id);
}

// ---- проверка события по фильтрам ----
export function makeChronoMatch(db: Record<string, Entity>, cats: FCat[], sel: Record<string, Sel>) {
  const tests: ((e: Entity) => boolean)[] = [];
  const linkedHas = (e: Entity, id: string) => e.id === id || (e.links || []).includes(id);
  for (const c of cats) {
    const sl = sel[c.key]; if (!sl || !sl.ids.length) continue;
    // личности, организации, темы — «ИЛИ» внутри категории (решение 27.10, как и в поиске; в ТЗ было «И» для выбранных по одному)
    if (c.key === "person" || c.key === "org" || c.key === "theme") { const ids = sl.ids; tests.push((e) => ids.some((id) => linkedHas(e, id))); }
    if (c.key === "event") {
      const chosen = new Set(sl.ids);
      const fullTypes = new Set(c.groups.filter((g) => g.items.every((i) => chosen.has(i.id))).map((g) => g.id));
      tests.push((e) => fullTypes.has(s(e, "evType")) || chosen.has(s(e, "evType") + SEP + s(e, "subtype")));
    }
    if (c.key === "city") { const chosen = new Set(sl.ids); tests.push((e) => chosen.has(eventCity(db, e))); }
  }
  return (e: Entity) => tests.every((t) => t(e));
}

// порядок внутри года: по дате; без точной даты — в конце, по алфавиту
export function sortInYear(a: Entity, b: Entity) {
  const da = eventDate(a), dbb = eventDate(b);
  if (da.exact !== dbb.exact) return da.exact ? -1 : 1;
  if (da.exact) return da.m - dbb.m || da.d - dbb.d || byTitle(a, b);
  return byTitle(a, b);
}
