// Наполнение из данных клик-прототипа (105 сущностей, связи двусторонние).
import { readFileSync } from "node:fs";
import { q, SQL, canonical } from "./db.js";

const raw: any[] = JSON.parse(readFileSync(new URL("../seed/data.json", import.meta.url), "utf8"));

await q.run("DELETE FROM links");
await q.run("DELETE FROM entities");

const DRAFTS = new Set(["m13", "ev47", "p7"]); // демонстрация статусов, как в админке прототипа

for (const o of raw) {
  const { id, type, title, links, ...payload } = o;
  await q.run("INSERT INTO entities (id, type, title, status, payload) VALUES (?,?,?,?,?)",
    [id, type, title, DRAFTS.has(id) ? "draft" : "published", JSON.stringify(payload)]);
}
let n = 0;
for (const o of raw) for (const t of o.links || []) {
  if (raw.some((x) => x.id === t)) { await q.run(SQL.LINK_INSERT, canonical(o.id, t)); n++; }
}
console.log(`seed: ${raw.length} entities, ${n} link records (deduplicated on insert)`);
