// Что видит посетитель без токена: опубликованные записи; у закрытых материалов (по запросу / ограниченный) —
// без ссылок на файлы и копии; медиафайлы закрытых материалов не отдаются вовсе. Используется публичными роутами и серверным поиском.
export const hideOrig = (e: any) => { if (e && e.type === "media" && "origKey" in e) { const { origKey: _o, ...rest } = e; return rest; } return e; };
export const isPublic = (e: any) => e && !["draft", "moderation"].includes(String(e.status || ""));
export const FILE_KEYS = ["thumb", "med", "big", "img", "imgBig", "origKey", "embed", "subtitles", "tourPrefix", "url", "hls"];
export const scrub = (e: any) => { const o = { ...e }; for (const k of FILE_KEYS) delete o[k]; return o; };
export const publicView = (entities: any[]) => {
  const closed = new Set(entities.filter((e) => e.type !== "media" && String(e.access || "open") !== "open").map((e) => e.id));
  const out: any[] = [];
  for (const e of entities) {
    if (!isPublic(e)) continue;
    if (e.type === "media") { if (e.parent && closed.has(String(e.parent))) continue; out.push(hideOrig(e)); continue; }
    out.push(closed.has(e.id) ? scrub(e) : e);
  }
  return out;
};
