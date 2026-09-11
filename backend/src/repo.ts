// Репозиторий: вся работа с сущностями и связями. Async — работает и с PostgreSQL, и с SQLite.
import { q, SQL, canonical, isPg, trgmAvailable } from "./db.js";
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

export async function listEntities(opts: {
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
  if (opts.q) { cond.push(`${SQL.LC}(title) LIKE ?`); args.push(`%${opts.q.toLowerCase()}%`); }
  const where = cond.length ? "WHERE " + cond.join(" AND ") : "";
  const total = Number((await q.get(`SELECT count(*) c FROM entities ${where}`, args)).c);
  const rows = await q.all(
    `SELECT * FROM entities ${where} ORDER BY title LIMIT ? OFFSET ?`,
    [...args, opts.limit ?? 50, opts.offset ?? 0],
  );
  return { total, items: rows.map(rowToEntity) };
}

const linkedOf = (id: string) =>
  q.all(
    `SELECT e.* FROM links l JOIN entities e ON e.id = CASE WHEN l.a = ? THEN l.b ELSE l.a END
     WHERE l.a = ? OR l.b = ?`,
    [id, id, id],
  );

export async function getEntity(id: string): Promise<(Entity & { links: Entity[] }) | null> {
  const r = await q.get("SELECT * FROM entities WHERE id = ?", [id]);
  if (!r) return null;
  const linked = (await linkedOf(id)).map(rowToEntity);
  return { ...rowToEntity(r), links: linked };
}

export async function createEntity(data: { id?: string; type: string; title: string; status?: string; payload?: object; links?: string[] }) {
  const id = data.id || randomUUID().slice(0, 8);
  await q.run("INSERT INTO entities (id, type, title, status, payload) VALUES (?,?,?,?,?)",
    [id, data.type, data.title, data.status || "published", JSON.stringify(data.payload || {})]);
  for (const t of data.links || []) await addLink(id, t);
  return (await getEntity(id))!;
}

export async function updateEntity(id: string, patch: { title?: string; status?: string; payload?: object }) {
  const cur = await q.get("SELECT * FROM entities WHERE id = ?", [id]);
  if (!cur) return null;
  const payload = patch.payload
    ? { ...JSON.parse(cur.payload || "{}"), ...patch.payload }
    : JSON.parse(cur.payload || "{}");
  await q.run(
    `UPDATE entities SET title = ?, status = ?, payload = ?, updated_at = ${SQL.NOW} WHERE id = ?`,
    [patch.title ?? cur.title, patch.status ?? cur.status, JSON.stringify(payload), id],
  );
  return (await getEntity(id))!;
}

export async function deleteEntity(id: string) {
  await q.run("DELETE FROM links WHERE a = ? OR b = ?", [id, id]);
  const res = await q.run("DELETE FROM entities WHERE id = ?", [id]);
  return res.changes > 0;
}

export async function addLink(x: string, y: string) {
  if (x === y) throw new Error("self-link");
  const [a, b] = canonical(x, y);
  await q.run(SQL.LINK_INSERT, [a, b]);
}

export async function removeLink(x: string, y: string) {
  const [a, b] = canonical(x, y);
  return (await q.run("DELETE FROM links WHERE a = ? AND b = ?", [a, b])).changes > 0;
}

// Поиск по ТЗ (разд. 18): совпадения по названию и полям + связанные с ними объекты.
// PostgreSQL: полнотекст с русской морфологией, ранжирование, сниппеты, опечатки (trgm).
// SQLite (локальная разработка): простой LIKE-фолбэк.
export async function search(query: string) {
  let direct: (Entity & { _snippet?: string })[];
  if (isPg) {
    // значение полей payload без JSON-синтаксиса и имён ключей — источник сниппета
    const PLAIN = `regexp_replace(regexp_replace(coalesce(payload,''), '"[a-zA-Z_0-9]+"\\s*:', ' ', 'g'), '[\\{\\}\\[\\]",]', ' ', 'g')`;
    const TSQ = `websearch_to_tsquery('russian', ?)`;
    const fuzzy = trgmAvailable ? `OR word_similarity(lower(?), lower(title)) > 0.45` : "";
    const rows = await q.all(
      `SELECT *,
         ts_rank(tsv, ${TSQ}) rnk,
         ts_headline('russian', ${PLAIN}, ${TSQ}, 'MaxWords=16, MinWords=6, MaxFragments=1') snippet
       FROM entities
       WHERE tsv @@ ${TSQ} OR lower(title) LIKE ? ${fuzzy}
       ORDER BY rnk DESC, title
       LIMIT 100`,
      [query, query, query, `%${query.toLowerCase()}%`, ...(trgmAvailable ? [query] : [])],
    );
    direct = rows.map((r: any) => {
      const e = rowToEntity(r) as Entity & { _snippet?: string };
      // сниппет отдаём только если полнотекст реально совпал (иначе ts_headline вернёт просто начало текста)
      e._snippet = Number(r.rnk) > 0 && /<b>/.test(r.snippet || "") ? String(r.snippet).trim() : "";
      return e;
    });
  } else {
    const ql = `%${query.toLowerCase()}%`;
    direct = (await q.all(
      `SELECT * FROM entities WHERE ${SQL.LC}(title) LIKE ? OR ${SQL.LC}(payload) LIKE ?`, [ql, ql],
    )).map(rowToEntity);
  }

  const ids = new Set(direct.map((e) => e.id));
  const related: (Entity & { _via?: string })[] = [];
  for (const e of direct) {
    for (const r of await linkedOf(e.id)) {
      const ent = rowToEntity(r) as Entity & { _via?: string };
      if (!ids.has(ent.id)) { ids.add(ent.id); ent._via = e.title; related.push(ent); }
    }
  }
  const groups: Record<string, Entity[]> = {};
  for (const e of [...direct, ...related]) (groups[e.type] = groups[e.type] || []).push(e);
  // items — плоский список в порядке релевантности (прямые по рангу, затем связанные)
  const items = [
    ...direct.map((e) => ({ id: e.id, direct: true, snippet: e._snippet || "" })),
    ...related.map((e) => ({ id: e.id, direct: false, via: e._via })),
  ];
  return { query, directCount: direct.length, totalCount: ids.size, groups, items };
}

export async function dicts() {
  const distinct = async (field: string, type?: string) =>
    (await q.all(
      `SELECT DISTINCT ${SQL.JSON_GET(field)} v FROM entities ${type ? "WHERE type = ?" : ""}`,
      type ? [type] : [],
    )).map((r: any) => r.v).filter(Boolean).sort();
  return {
    materialTypes: await distinct("mtype", "material"),
    eventTypes: await distinct("evType", "event"),
    sourceTypes: await distinct("srcType", "source"),
    accessLevels: ["open", "request", "restricted"],
    personGroups: await distinct("group", "person"),
    statuses: ["draft", "moderation", "published"],
  };
}

// полный экспорт для клик-прототипа: все сущности + пары связей
export async function exportAll() {
  const entities = (await q.all("SELECT * FROM entities")).map(rowToEntity);
  const links = (await q.all("SELECT a, b FROM links")).map((x: any) => [x.a, x.b]);
  return { entities, links };
}

export async function stats() {
  const rows = await q.all("SELECT type, count(*) c FROM entities GROUP BY type");
  const links = Number((await q.get("SELECT count(*) c FROM links")).c);
  return { byType: Object.fromEntries(rows.map((r: any) => [r.type, Number(r.c)])), links };
}
