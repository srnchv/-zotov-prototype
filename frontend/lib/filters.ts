import type { Entity } from "./api";
// Группировка значений фильтра для панели (макет 02.10): личности — по группе, места — по городу,
// события — по типу, коллекции — по типу фонда; остальные — одним списком.
const KEY: Record<string, string> = { person: "group", place: "city", event: "evType", collection: "colType", material: "mtype", project: "prType", org: "orgType" };
export function groupItems(list: Entity[], type: string): { title: string; items: { id: string; title: string }[] }[] {
  const k = KEY[type];
  if (!k) return [{ title: "", items: list.map((e) => ({ id: e.id, title: e.title })) }];
  const by: Record<string, { id: string; title: string }[]> = {};
  for (const e of list) { const g = String(e[k] ?? "").trim() || "Другое"; (by[g] ||= []).push({ id: e.id, title: e.title }); }
  const titles = Object.keys(by).sort((a, b) => (a === "Другое" ? 1 : b === "Другое" ? -1 : a.localeCompare(b, "ru")));
  if (titles.length === 1) return [{ title: "", items: by[titles[0]] }];
  return titles.map((t) => ({ title: t, items: by[t] }));
}
