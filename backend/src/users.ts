// Пользователи админки и сессии: пароли — scrypt, сессия — подписанный токен (HMAC), без внешних зависимостей.
// Роли: admin — всё, включая пользователей; editor — контент и медиа; moderator — только статусы публикации и чтение.
import { randomBytes, scryptSync, timingSafeEqual, createHmac, randomUUID } from "node:crypto";
import { q, SQL } from "./db.js";

export type Role = "admin" | "editor" | "moderator";
export type User = { id: string; login: string; name: string; role: Role; active: number; created_at?: string; last_login?: string | null };
export const ROLES: Role[] = ["admin", "editor", "moderator"];

// секрет сессий обязателен: без него (и без ADMIN_TOKEN) сервер не стартует — см. requireSecrets()
const SECRET = process.env.JWT_SECRET || process.env.ADMIN_TOKEN || "";
export function requireSecrets() {
  const prod = process.env.NODE_ENV === "production" || !!process.env.DATABASE_URL;
  const missing = ["ADMIN_TOKEN", "JWT_SECRET"].filter((k) => !process.env[k]);
  if (missing.length && prod) throw new Error(`Не заданы переменные окружения: ${missing.join(", ")} — сервер не запускается`);
  if (missing.length) console.warn(`ВНИМАНИЕ: не заданы ${missing.join(", ")} — допустимо только для локальной разработки`);
}
const TTL = 30 * 24 * 3600; // 30 дней

export function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(pw, salt, 64).toString("hex");
}
export function checkPassword(pw: string, stored: string) {
  const [salt, hex] = String(stored || "").split(":");
  if (!salt || !hex) return false;
  const a = scryptSync(pw, salt, 64), b = Buffer.from(hex, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (s: string) => createHmac("sha256", SECRET).update(s).digest("base64url");
export function issueToken(u: User & { sess_ver?: number }) {
  const body = b64({ uid: u.id, v: u.sess_ver || 1, exp: Math.floor(Date.now() / 1000) + TTL });
  return body + "." + sign(body);
}
// проверка токена: подпись и срок + актуальный пользователь из базы (активен, та же версия сессии, текущая роль)
export async function verifyToken(t: string): Promise<{ uid: string; role: Role; name: string } | null> {
  const [body, sig] = String(t || "").split(".");
  if (!body || !sig || !SECRET || sign(body) !== sig) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!p.exp || p.exp < Date.now() / 1000) return null;
    const u = await q.get("SELECT * FROM users WHERE id = ?", [p.uid]);
    if (!u || !Number(u.active) || Number(u.sess_ver || 1) !== Number(p.v || 1)) return null;
    return { uid: u.id, role: u.role, name: u.name };
  } catch { return null; }
}

const pub = (r: any): User & { sess_ver: number } => ({ id: r.id, login: r.login, name: r.name, role: r.role, active: Number(r.active), sess_ver: Number(r.sess_ver || 1), created_at: r.created_at, last_login: r.last_login });
export async function listUsers(): Promise<User[]> { return (await q.all("SELECT * FROM users ORDER BY created_at")).map(pub); }
export async function getUser(id: string) { const r = await q.get("SELECT * FROM users WHERE id = ?", [id]); return r ? pub(r) : null; }
export async function findByLogin(login: string) { return q.get(`SELECT * FROM users WHERE ${SQL.LC}(login) = ${SQL.LC}(?)`, [login]); }
export async function createUser(d: { login: string; name: string; role: Role; password: string }) {
  const id = randomUUID().slice(0, 8);
  await q.run("INSERT INTO users (id, login, name, role, pass_hash) VALUES (?,?,?,?,?)", [id, d.login.trim(), d.name.trim(), d.role, hashPassword(d.password)]);
  return getUser(id);
}
export async function updateUser(id: string, d: { name?: string; role?: Role; password?: string; active?: boolean; login?: string }) {
  const cur = await q.get("SELECT * FROM users WHERE id = ?", [id]);
  if (!cur) return null;
  // смена роли, пароля или отключение — старые сессии перестают действовать
  const bump = (d.role && d.role !== cur.role) || !!d.password || (d.active != null && (d.active ? 1 : 0) !== Number(cur.active));
  await q.run("UPDATE users SET login = ?, name = ?, role = ?, active = ?, pass_hash = ?, sess_ver = ? WHERE id = ?", [
    d.login?.trim() || cur.login, d.name ?? cur.name, d.role ?? cur.role, d.active == null ? cur.active : (d.active ? 1 : 0),
    d.password ? hashPassword(d.password) : cur.pass_hash, Number(cur.sess_ver || 1) + (bump ? 1 : 0), id]);
  return getUser(id);
}
export async function deleteUser(id: string) { return (await q.run("DELETE FROM users WHERE id = ?", [id])).changes > 0; }
export async function touchLogin(id: string) { await q.run(`UPDATE users SET last_login = ${SQL.NOW} WHERE id = ?`, [id]); }
export async function countAdmins() { const r = await q.get("SELECT count(*) AS n FROM users WHERE role = 'admin' AND active = 1"); return Number(r?.n || 0); }

// первый администратор — из переменных окружения, когда пользователей ещё нет
export async function bootstrap() {
  const r = await q.get("SELECT count(*) AS n FROM users");
  if (Number(r?.n || 0) > 0) return;
  const login = process.env.ADMIN_LOGIN, password = process.env.ADMIN_PASSWORD;
  if (!login || !password) throw new Error("Пользователей нет, а ADMIN_LOGIN / ADMIN_PASSWORD не заданы — первого администратора создать не из чего");
  await createUser({ login, name: "Администратор", role: "admin", password });
  console.log(`users: создан первый администратор «${login}»`);
}
