// Слой БД с двумя драйверами:
//  - задан DATABASE_URL → PostgreSQL (managed-база, данные переживают редеплой);
//  - иначе → встроенный SQLite (локальная разработка и тесты, без нативных зависимостей).
// Весь остальной код ходит через единый async-интерфейс q и диалектные фрагменты SQL.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const isPg = !!process.env.DATABASE_URL;

export type Q = {
  all(sql: string, args?: unknown[]): Promise<any[]>;
  get(sql: string, args?: unknown[]): Promise<any | undefined>;
  run(sql: string, args?: unknown[]): Promise<{ changes: number }>;
};

// Диалектные различия собраны в одном месте
export const SQL = isPg
  ? {
      LC: "lower", // PG корректно приводит кириллицу к нижнему регистру
      NOW: "now()",
      JSON_GET: (f: string) => `(payload::json->>'${f}')`,
      LINK_INSERT: "INSERT INTO links (a, b) VALUES (?, ?) ON CONFLICT DO NOTHING",
    }
  : {
      LC: "lc", // JS-функция: lower() SQLite не работает с кириллицей
      NOW: "datetime('now')",
      JSON_GET: (f: string) => `json_extract(payload, '$.${f}')`,
      LINK_INSERT: "INSERT OR IGNORE INTO links (a, b) VALUES (?, ?)",
    };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS entities (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'published',
  payload    TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (${SQL.NOW}),
  updated_at TEXT NOT NULL DEFAULT (${SQL.NOW})
);
CREATE INDEX IF NOT EXISTS idx_entities_type  ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_title ON entities(title);

-- Связь «многие-ко-многим», двусторонняя по построению:
-- пара хранится один раз в каноническом порядке (a < b), читается с обеих сторон.
CREATE TABLE IF NOT EXISTS links (
  a TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  b TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (${SQL.NOW}),
  PRIMARY KEY (a, b)
);
CREATE INDEX IF NOT EXISTS idx_links_b ON links(b);
`;

export let q: Q;

if (isPg) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    // managed-базы обычно за TLS с самоподписанным сертификатом; PGSSL=disable выключает
    ssl: process.env.PGSSL === "disable" ? undefined : { rejectUnauthorized: false },
    max: 5,
  });
  // '?' → $1, $2, … (плейсхолдеры pg)
  const conv = (sql: string) => {
    let n = 0;
    return sql.replace(/\?/g, () => `$${++n}`);
  };
  q = {
    all: async (sql, args = []) => (await pool.query(conv(sql), args as any[])).rows,
    get: async (sql, args = []) => (await pool.query(conv(sql), args as any[])).rows[0],
    run: async (sql, args = []) => ({ changes: (await pool.query(conv(sql), args as any[])).rowCount ?? 0 }),
  };
  // PG понимает TIMESTAMPTZ-дефолты лучше, но TEXT-даты сохраняем для 1:1 совместимости строк
  await pool.query(SCHEMA);
  console.log("БД: PostgreSQL (managed)");
} else {
  const { DatabaseSync } = await import("node:sqlite");
  const DB_PATH = process.env.DB_PATH || "./data/zotov.db";
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  try { db.exec("PRAGMA journal_mode=WAL"); } catch { /* WAL недоступен на некоторых FS — ок */ }
  db.exec(SCHEMA);
  db.function("lc", { deterministic: true }, (v: unknown) => String(v ?? "").toLowerCase());
  q = {
    all: async (sql, args = []) => db.prepare(sql).all(...(args as any[])),
    get: async (sql, args = []) => db.prepare(sql).get(...(args as any[])),
    run: async (sql, args = []) => ({ changes: Number(db.prepare(sql).run(...(args as any[])).changes) }),
  };
  console.log(`БД: SQLite (${DB_PATH})`);
}

export const canonical = (x: string, y: string): [string, string] =>
  x < y ? [x, y] : [y, x];
