// Репозиторий: вся работа с сущностями и связями.
import { db, canonical } from "./db.js";
import { randomUUID } from "node:crypto";

export type Entity = {
  id: string;
  type: string;
  title: string;
  status: string;
  [k: string]: unknown;
};

const rowToEntity = (r: any): Entity => ({
  id: r.id,
  type: r.type,
  title: r.title,
  status: r.status,
  ...(JSON.parse(r.payload || "{}") as object),
  created_at: r.created_at,
  updated_at: r.updated_at,
});

export function listEntities(opts: {
  type?: string;
  q?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const cond: string[] = [];
  const args: any[] = [];
  if (opts.type) { cond.push("type = ?"); args.push(opts.type); }
  if (opts.status) { cond.push("status = ?"); args.push(opts.status); }
  if (opts.q) { cond.push("lc(title) LIKE ?"); args.push(`%${opts.q.toLowerCase()}%`); }
  const where = cond.length ? "WHERE " + cond.join(" AND ") : "";
  const total = (db.prepare(`SELECT count(*) c FROM entities ${where}`).get(...args) as any).c;
  const rows = db
    .prepare(`SELECT * FROM entities ${where} ORDER BY title LIMIT ? OFFSET ?`)
    .all(...args, opts.limit ?? 50, opts.offset ?? 0);
  return { total, items: rows.map(rowToEntity) };
}

export function getEntity(id: string): (Entity & { links: Entity[] }) | null {
  const r = db.prepare("SELECT * FROM entities WHERE id = ?").get(id);
  if (!r) return null;
  const linked = db
    .prepare(
      `SELECT e.* FROM links l JOIN entities e ON e.id = CASE WHEN l.a = ? THEN l.b ELSE l.a END
       WHERE l.a = ? OR l.b = ?`
    )
    .all(id, id, id)
    .map(rowToEntity);
  return { ...rowToEntity(r), links: linked };
}

export function createEntity(data: { id?: string; type: string; title: string; status?: string; payload?: object; links?: string[] }) {
  const id = data.id || randomUUID().slice(0, 8);
  db.prepare("INSERT INTO entities (id, type, title, status, payload) VALUES (?,?,?,?,?)")
    .run(id, data.type, data.title, data.status || "published", JSON.stringify(data.payload || {}));
  for (const t of data.links || []) addLink(id, t);
  return getEntity(id)!;
}

export function updateEntity(id: string, patch: { title?: string; status?: string; payload?: object }) {
  const cur = db.prepare("SELECT * FROM entities WHERE id = ?").get(id) as any;
  if (!cur) return null;
  const payload = patch.payload
    ? { ...JSON.parse(cur.payload || "{}"), ...patch.payload }
    : JSON.parse(cur.payload || "{}");
  db.prepare(
    "UPDATE entities SET title = ?, status = ?, payload = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(patch.title ?? cur.title, patch.status ?? cur.status, JSON.stringify(payload), id);
  return getEntity(id)!;
}

export function deleteEntity(id: string) {
  db.prepare("DELETE FROM links WHERE a = ? OR b = ?").run(id, id);
  const res = db.prepare("DELETE FROM entities WHERE id = ?").run(id);
  return res.changes > 0;
}

export function addLink(x: string, y: string) {
  if (x === y) throw new Error("self-link");
  const [a, b] = canonical(x, y);
  db.prepare("INSERT OR IGNORE INTO links (a, b) VALUES (?, ?)").run(a, b);
}

export function removeLink(x: string, y: string) {
  const [a, b] = canonical(x, y);
  return db.prepare("DELETE FROM links WHERE a = ? AND b = ?").run(a, b).changes > 0;
}

// Поиск по ТЗ (разд. 18): совпадения по названию и полям + связанные с ними объекты.
export function search(q: string) {
  const ql = `%${q.toLowerCase()}%`;
  const direct = db
    .prepare("SELECT * FROM entities WHERE lc(title) LIKE ? OR lc(payload) LIKE ?")
    .all(ql, ql)
    .map(rowToEntity);
  const ids = new Set(direct.map((e) => e.id));
  const related: Entity[] = [];
  for (const e of direct) {
    const linked = db
      .prepare(
        `SELECT e2.* FROM links l JOIN entities e2 ON e2.id = CASE WHEN l.a = ? THEN l.b ELSE l.a END
         WHERE l.a = ? OR l.b = ?`
      )
      .all(e.id, e.id, e.id);
    for (const r of linked) {
      const ent = rowToEntity(r);
      if (!ids.has(ent.id)) { ids.add(ent.id); related.push(ent); }
    }
  }
  const groups: Record<string, Entity[]> = {};
  for (const e of [...direct, ...related]) (groups[e.type] = groups[e.type] || []).push(e);
  return { query: q, directCount: direct.length, totalCount: ids.size, groups };
}

export function dicts() {
  const distinct = (field: string, type?: string) =>
    db.prepare(
      `SELECT DISTINCT json_extract(payload, '$.${field}') v FROM entities ${type ? "WHERE type = ?" : ""}`
    ).all(...(type ? [type] : [])).map((r: any) => r.v).filter(Boolean).sort();
  return {
    materialTypes: distinct("mtype", "material"),
    eventTypes: distinct("evType", "event"),
    sourceTypes: distinct("srcType", "source"),
    accessLevels: ["open", "request", "restricted"],
    personGroups: distinct("group", "person"),
    statuses: ["draft", "moderation", "published"],
  };
}

// полный экспорт для клик-прототипа: все сущности + пары связей одним запросом
export function exportAll() {
  const entities = db.prepare("SELECT * FROM entities").all().map(rowToEntity);
  const links = (db.prepare("SELECT a, b FROM links").all() as any[]).map((x) => [x.a, x.b]);
  return { entities, links };
}

export function stats() {
  const rows = db.prepare("SELECT type, count(*) c FROM entities GROUP BY type").all() as any[];
  const links = (db.prepare("SELECT count(*) c FROM links").get() as any).c;
  return { byType: Object.fromEntries(rows.map((r) => [r.type, r.c])), links };
}
