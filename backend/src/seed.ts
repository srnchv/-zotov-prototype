// Наполнение из данных клик-прототипа (105 сущностей, связи двусторонние).
import { readFileSync } from "node:fs";
import { db, canonical } from "./db.js";

const raw: any[] = JSON.parse(readFileSync(new URL("../seed/data.json", import.meta.url), "utf8"));

db.exec("DELETE FROM links; DELETE FROM entities;");
const insE = db.prepare("INSERT INTO entities (id, type, title, status, payload) VALUES (?,?,?,?,?)");
const insL = db.prepare("INSERT OR IGNORE INTO links (a, b) VALUES (?,?)");

const DRAFTS = new Set(["m13", "ev47", "p7"]); // демонстрация статусов, как в админке прототипа

for (const o of raw) {
  const { id, type, title, links, ...payload } = o;
  insE.run(id, type, title, DRAFTS.has(id) ? "draft" : "published", JSON.stringify(payload));
}
let n = 0;
for (const o of raw) for (const t of o.links || []) {
  if (raw.some((x) => x.id === t)) { insL.run(...canonical(o.id, t)); n++; }
}
console.log(`seed: ${raw.length} entities, ${n} link records (deduplicated on insert)`);
