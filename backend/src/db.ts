// Слой БД. Тестовый стенд: встроенный SQLite (node:sqlite, без нативных зависимостей).
// Прод по смете — PostgreSQL: слой изолирован здесь, замена = переписать этот модуль на `pg`
// с теми же сигнатурами (schema 1:1 переносится, JSON-поле payload → JSONB).
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env.DB_PATH || "./data/zotov.db";
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
try { db.exec("PRAGMA journal_mode=WAL"); } catch { /* WAL недоступен на некоторых FS (сетевые маунты) — ок, остаёмся на журнале по умолчанию */ }
db.exec(`
CREATE TABLE IF NOT EXISTS entities (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'published',
  payload    TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_entities_type  ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_title ON entities(title);

-- Связь «многие-ко-многим», двусторонняя по построению:
-- пара хранится один раз в каноническом порядке (a < b), читается с обеих сторон.
CREATE TABLE IF NOT EXISTS links (
  a TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  b TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (a, b)
);
CREATE INDEX IF NOT EXISTS idx_links_b ON links(b);
`);

// SQLite lower() не работает с кириллицей — регистронезависимый поиск через JS-функцию
db.function("lc", { deterministic: true }, (v: unknown) => String(v ?? "").toLowerCase());

export const canonical = (x: string, y: string): [string, string] =>
  x < y ? [x, y] : [y, x];
