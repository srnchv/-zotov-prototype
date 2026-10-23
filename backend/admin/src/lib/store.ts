// Состояние админки: сессия, снимок архива (/export) с двусторонними связями, журнал, справочники, проверки главной.
import { reactive, computed } from "vue";
import { type Entity, type Role, HOME_KEY, onHome, HOME_DEF, SITE_DEF, TYPEKEY, SUBKEY, TYPELIST, A11Y, plural } from "./model";

export const API = import.meta.env.VITE_API_URL || "/api";
// публичный сайт (Next.js) живёт на другом хосте
export const SITE = import.meta.env.VITE_SITE_URL || "https://srnchv-zotov-prototype-2367.twc1.net";
const LS = { token: "zadm_token", name: "zadm_name", role: "zadm_role", uid: "zadm_uid" };

export const S = reactive({
  token: localStorage.getItem(LS.token) || "",
  name: localStorage.getItem(LS.name) || "",
  role: (localStorage.getItem(LS.role) || "editor") as Role,
  uid: localStorage.getItem(LS.uid) || "",
  apiLive: null as boolean | null,
  loaded: false,
  raw: [] as Entity[],
  db: {} as Record<string, Entity>,
  audit: null as null | { recent: any[]; summary: Record<string, { edits: number; lastAt: string; lastActor: string }> },
  toasts: [] as { id: number; msg: string }[],
});
export const logged = computed(() => !!S.token);
export const isAdmin = computed(() => S.role === "admin");
export const canEdit = computed(() => S.role === "admin" || S.role === "editor");

export function toast(msg: string) {
  const id = Date.now() + Math.random();
  S.toasts.push({ id, msg });
  setTimeout(() => { S.toasts = S.toasts.filter((t) => t.id !== id); }, 2400);
}

export class ApiError extends Error { status: number; constructor(m: string, s: number) { super(m); this.status = s; } }
const ERR: Record<string, string> = { unauthorized: "Сессия истекла — войдите заново", forbidden: "Недостаточно прав для этого действия", "bad credentials": "Неверный логин или пароль", "login taken": "Такой логин уже есть", "last admin": "Нельзя оставить систему без администратора", "self demote": "Нельзя снять роль администратора с себя", "self delete": "Нельзя удалить себя", "storage not configured": "Хранилище файлов не настроено" };
export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string> || {}) };
  if (!(opts.body instanceof FormData)) headers["content-type"] = "application/json";
  if (S.token) headers.authorization = "Bearer " + S.token;
  const r = await fetch(API + path, { ...opts, headers });
  if (r.status === 401 && S.token && path !== "/login") { logout(); }
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    const key = String(e.error || "");
    throw new ApiError(ERR[key] || (key.startsWith("storage:") ? "Хранилище: " + key.slice(8) : key) || "HTTP " + r.status, r.status);
  }
  return r.status === 204 ? (null as T) : r.json();
}

export async function login(l: string, p: string) {
  const d = await api<{ token: string; name: string; role: Role; id: string }>("/login", { method: "POST", body: JSON.stringify({ login: l, password: p }) });
  S.token = d.token; S.name = d.name || l; S.role = d.role; S.uid = d.id;
  localStorage.setItem(LS.token, d.token); localStorage.setItem(LS.name, S.name); localStorage.setItem(LS.role, d.role); localStorage.setItem(LS.uid, d.id);
  await load();
}
export function logout() {
  S.token = ""; S.name = ""; S.uid = ""; S.audit = null;
  Object.values(LS).forEach((k) => localStorage.removeItem(k));
}

// снимок архива: сущности + связи (двусторонние строятся здесь)
export async function load() {
  try {
    const r = await fetch(API + "/export", { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error("export");
    const { entities, links } = await r.json();
    const raw: Entity[] = entities.map((e: any) => ({ ...e, links: [] }));
    const db: Record<string, Entity> = {};
    raw.forEach((o) => (db[o.id] = o));
    for (const [a, b] of links) if (db[a] && db[b]) { db[a].links.push(b); db[b].links.push(a); }
    S.raw = raw; S.db = db; S.apiLive = true; S.loaded = true;
  } catch { S.apiLive = false; S.loaded = true; }
}
export async function loadAudit(force = false) {
  if (S.audit && !force) return;
  try { S.audit = await api("/audit"); } catch { S.audit = { recent: [], summary: {} }; }
}

export const all = (t: string) => S.raw.filter((o) => o.type === t);
export const get = (id: string) => S.db[id];
export const linked = (o: Entity, t?: string) => (o.links || []).map((id) => S.db[id]).filter((x) => x && (!t || x.type === t));
export const yearNum = (o: Entity) => { const m = String(o.date || o.dates || o.life || o.year || "").match(/\d{4}/); return m ? +m[0] : 0; };

// ---- справочники: базовые значения из данных + добавленные/скрытые в сущностях dict-<ключ> ----
const dvals = (t: string, k: string) => [...new Set(all(t).map((o) => o[k]).filter(Boolean))].sort() as string[];
export type DictDef = { key: string; label: string; base: () => string[] };
export const DICTDEF = (): DictDef[] => [
  { key: "mtype", label: "Типы материалов", base: () => TYPELIST },
  { key: "evType", label: "Типы событий", base: () => dvals("event", "evType") },
  { key: "srcType", label: "Типы источников", base: () => dvals("source", "srcType") },
  { key: "placeType", label: "Типы мест", base: () => [...new Set(all("place").map((p) => String(p.placeType || "").split("·")[0].trim()).filter(Boolean))] },
  { key: "group", label: "Группы личностей", base: () => dvals("person", "group") },
  { key: "colType", label: "Типы коллекций", base: () => dvals("collection", "colType") },
  { key: "orgType", label: "Типы организаций", base: () => dvals("org", "orgType") },
  { key: "prType", label: "Типы проектов Центра", base: () => dvals("project", "prType") },
  ...Object.entries({ mtype: "материалов", evType: "событий", group: "личностей (роли)", colType: "коллекций", placeType: "мест", orgType: "организаций", prType: "проектов Центра", srcType: "источников" }).map(([tk, l]) => ({
    key: "sub:" + tk, label: "Подтипы " + l, base: () => {
      const types = Object.keys(TYPEKEY).filter((t) => TYPEKEY[t] === tk);
      return [...new Set(S.raw.filter((o) => types.includes(o.type)).map((o) => { const [t, sub] = typeSubOf(o, tk); return t && sub ? t + " › " + sub : ""; }).filter(Boolean))].sort() as string[];
    },
  })),
  { key: "a11y", label: "Доступность", base: () => [...new Set([...A11Y, ...all("material").flatMap((o) => o.a11y || [])])] as string[] },
];
export function dictValues(key: string): string[] {
  const def = DICTDEF().find((d) => d.key === key);
  const base = def ? def.base() : [];
  const s = S.db["dict-" + key] || {};
  const rem = new Set<string>(s.removed || []);
  const order: string[] = s.order || [];
  const at = (v: string) => { const i = order.indexOf(v); return i < 0 ? 1e6 : i; };
  // порядок из админки (стрелки в «Справочниках»); новые значения — в конце по алфавиту
  return [...new Set([...base, ...(s.added || [])])].filter((v) => v && !rem.has(v)).sort((a, b) => at(a) - at(b) || a.localeCompare(b, "ru"));
}
type DictState = { added: string[]; removed: string[]; order: string[] };
export async function dictPatch(key: string, mut: (st: DictState) => void) {
  const cur = S.db["dict-" + key];
  const st: DictState = { added: [...((cur && cur.added) || [])], removed: [...((cur && cur.removed) || [])], order: [...((cur && cur.order) || [])] };
  mut(st);
  if (cur) await api("/entities/dict-" + key, { method: "PATCH", body: JSON.stringify({ payload: st }) });
  else await api("/entities", { method: "POST", body: JSON.stringify({ id: "dict-" + key, type: "dict", title: "Справочник: " + (DICTDEF().find((d) => d.key === key)?.label || key), payload: st }) });
  await load();
}
// тип и подтип сущности по ключу справочника; у мест исторически одной строкой «Тип · подтип»
export function typeSubOf(o: Entity, tk: string): [string, string] {
  const sk = SUBKEY[o.type] || "subtype";
  const raw = String(o[tk] || "").trim();
  if (tk === "placeType") { const [t, ...r] = raw.split(" · "); return [t.trim(), String(o[sk] || "").trim() || r.join(" · ").trim()]; }
  return [raw, String(o[sk] || "").trim()];
}
// сущности, у которых стоит значение справочника (для проверки удаления и переименования)
export function dictUsage(key: string, v: string): Entity[] {
  const sub = key.startsWith("sub:"), tk = sub ? key.slice(4) : key;
  if (tk === "a11y") return S.raw.filter((o) => (o.a11y || []).includes(v));
  const types = Object.keys(TYPEKEY).filter((t) => TYPEKEY[t] === tk);
  return S.raw.filter((o) => {
    if (!types.includes(o.type)) return false;
    const [t, st] = typeSubOf(o, tk);
    return sub ? t + " › " + st === v : t === v;
  });
}
// переименование значения: справочник + все карточки, где оно стоит (и подтипы переименованного типа)
export async function dictRename(key: string, from: string, to: string) {
  const sub = key.startsWith("sub:"), tk = sub ? key.slice(4) : key;
  const users = dictUsage(key, from);
  for (const o of users) {
    const sk = SUBKEY[o.type] || "subtype";
    const [t, st] = typeSubOf(o, tk);
    const composite = tk === "placeType" && String(o[tk] || "").includes(" · ");
    let payload: Record<string, unknown>;
    if (sub) { const nsub = to.split(" › ").slice(1).join(" › "); payload = composite ? { [tk]: t + " · " + nsub } : { [sk]: nsub }; }
    else payload = composite ? { [tk]: to + " · " + st } : { [tk]: to };
    await api("/entities/" + o.id, { method: "PATCH", body: JSON.stringify({ payload }) });
  }
  const swap = (st: DictState, a: string, b: string) => {
    st.added = st.added.filter((x) => x !== a); if (!st.removed.includes(a)) st.removed.push(a);
    st.removed = st.removed.filter((x) => x !== b); if (!st.added.includes(b)) st.added.push(b);
    st.order = st.order.map((x) => (x === a ? b : x));
  };
  await dictPatch(key, (st) => swap(st, from, to));
  if (!sub && DICTDEF().some((d) => d.key === "sub:" + key)) { // у типа переименовываются и его подтипы
    const subs = dictValues("sub:" + key).filter((x) => x.startsWith(from + " › "));
    if (subs.length) await dictPatch("sub:" + key, (st) => { for (const x of subs) swap(st, x, to + x.slice(from.length)); });
  }
  await load();
  return users.length;
}
// диапазон Периода для фильтра поиска (dict-period: from/to)
export const periodVal = () => { const d = S.db["dict-period"] || {}; return { from: String(d.from || ""), to: String(d.to || "") }; };
export async function savePeriod(from: number, to: number) {
  if (S.db["dict-period"]) await api("/entities/dict-period", { method: "PATCH", body: JSON.stringify({ payload: { from, to } }) });
  else await api("/entities", { method: "POST", body: JSON.stringify({ id: "dict-period", type: "dict", title: "Справочник: период поиска", payload: { from, to } }) });
  await load();
}
export const subOptions = (tk: string, typeVal: string) => (typeVal ? dictValues("sub:" + tk).filter((v) => v.startsWith(typeVal + " › ")).map((v) => v.slice(typeVal.length + 3)) : []);

// ---- тексты сайта и главной (сущность site) ----
export function siteVal(k: string): string {
  const s = S.db["site"] || {};
  if (s[k] != null && s[k] !== "") return String(s[k]);
  if (k === "heroText" && s.hero1) return [s.hero1, s.hero2, s.hero3, s.hero4].filter(Boolean).join("\n");
  if (k === "aboutText" && s.about1) return [s.about1, s.about2, s.about3].filter(Boolean).join("\n");
  if (k in HOME_DEF) return HOME_DEF[k];
  const def = SITE_DEF.flatMap((g) => g[1]).find((f) => f[0] === k);
  return def ? def[2] : "";
}
export async function patchSite(payload: Record<string, unknown>) {
  if (S.db["site"]) await api("/entities/site", { method: "PATCH", body: JSON.stringify({ payload }) });
  else await api("/entities", { method: "POST", body: JSON.stringify({ id: "site", type: "dict", title: "Тексты сайта", payload }) });
  await load();
}
// загрузка файла в медиатеку (прикрепляется к сущности, если задана)
export async function uploadFile(file: File, entityId?: string) {
  const fd = new FormData(); fd.append("file", file); if (entityId) fd.append("entityId", entityId);
  return api<Entity>("/media", { method: "POST", body: fd });
}

// ---- главная: состав и ограничения (одни данные с галочками в карточках) ----
export const homeList = (t: string) => all(t).filter(onHome);
export const collItems = (o: Entity): Record<string, { img?: string; caption?: string; hl?: boolean }> => o.items || {};
export const collMaterials = (o: Entity) => linked(o, "material");
export const collHighlights = (o: Entity) => collMaterials(o).filter((m) => (collItems(o)[m.id] || {}).hl);
export function homeCheck(draft?: Partial<Entity> & { id: string }, heroLen?: number) {
  const g = (o: Entity) => (draft && draft.id === o.id ? ({ ...o, ...draft } as Entity) : o);
  const errors: string[] = [], warnings: string[] = [];
  const list = (t: string) => all(t).map(g).filter(onHome);
  const th = list("theme");
  if (th.length > 9) errors.push("На главной может быть не больше 9 тем — уберите лишние.");
  else if (th.length < 5) warnings.push(`На главной будет показано ${th.length} ${plural(th.length, ["тема", "темы", "тем"])}. По макету минимум 5 — если хотите больше, отметьте ещё.`);
  const pr = list("project"), feat = pr.filter((o) => o.featured);
  if (pr.length > 3) errors.push("На главной может быть не больше 3 проектов.");
  if (feat.length > 1) errors.push("Фичером может быть только один проект.");
  if (pr.length === 3 && feat.length !== 1) errors.push("Выберите один проект-фичер для главной: при трёх проектах он становится большой карточкой.");
  if (pr.length < 2) warnings.push(`На главной будет показано ${pr.length} ${plural(pr.length, ["проект", "проекта", "проектов"])}. По макету минимум 2.`);
  const co = list("collection");
  if (co.length > 2) errors.push("На главной может быть не больше 2 коллекций.");
  co.forEach((c) => { const n = collHighlights(c).length;
    if (n > 5) errors.push(`«${c.title}»: в хайлайтах не больше 5 материалов.`);
    else if (n < 2) warnings.push(`«${c.title}»: в хайлайтах ${n} ${plural(n, ["материал", "материала", "материалов"])} — по макету галерея из 2–5, пока покажем обложку.`); });
  if ((heroLen ?? 0) > 500) errors.push("Подзаголовок первого экрана длиннее 500 знаков.");
  return { errors, warnings };
}
export { HOME_KEY, onHome };
