// Описание карточки: HTML из редактора админки (абзацы, заголовок, списки, сноски). Старые описания — простой текст с абзацами.
// Перед выводом чистим до разрешённого набора тегов; сноска — <span class="fn" data-fn="n">[n]</span>.
import sanitize from "sanitize-html";
export const toHtml = (v: unknown) => {
  const s = String(v ?? "").trim(); if (!s) return "";
  if (/^<([a-z][a-z0-9]*)[\s>]/i.test(s)) return s;
  return s.split(/\n\s*\n/).map((p) => "<p>" + p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>") + "</p>").join("");
};
export const cleanHtml = (html: string) => sanitize(html, {
  allowedTags: ["p", "h2", "h3", "ul", "ol", "li", "strong", "b", "em", "i", "br", "a", "span"],
  allowedAttributes: { a: ["href", "target", "rel"], span: ["class", "data-fn"] },
  allowedClasses: { span: ["fn"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: { a: sanitize.simpleTransform("a", { rel: "noopener", target: "_blank" }) },
});
export const textLength = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, "x").length;
// первые ~N знаков с сохранением целых блоков (абзацев/списков): режем по верхнеуровневым тегам
export function cutHtml(html: string, limit: number): { head: string; cut: boolean } {
  // верхнеуровневые блоки с учётом вложенных списков
  const blocks: string[] = []; const re = /<(p|h2|h3|ul|ol)\b[^>]*>/g; let m: RegExpExecArray | null; let pos = 0;
  while ((m = re.exec(html))) {
    if (m.index < pos) continue;
    const tag = m[1]; let depth = 0, i = m.index; const open = new RegExp(`<${tag}\\b[^>]*>`, "g"), close = `</${tag}>`;
    const tokens = /<\/?(p|h2|h3|ul|ol)\b[^>]*>/g; tokens.lastIndex = m.index; let t: RegExpExecArray | null; let end = -1;
    while ((t = tokens.exec(html))) { if (t[1] !== tag) continue; if (t[0].startsWith("</")) { depth--; if (depth === 0) { end = t.index + close.length; break; } } else depth++; }
    void open; void i;
    if (end < 0) break;
    blocks.push(html.slice(m.index, end)); pos = end; re.lastIndex = end;
  }
  if (!blocks.length) blocks.push(html);
  let out = "", n = 0;
  for (const b of blocks) {
    const len = textLength(b);
    if (n + len > limit) {
      if (n) return { head: out, cut: true };
      // первый блок сам длиннее лимита — режем абзац по <br> или по концу предложения
      if (/^<p\b/.test(b)) {
        const inner = b.replace(/^<p\b[^>]*>/, "").replace(/<\/p>$/, "");
        let acc = "", k = 0;
        for (const piece of inner.split(/(<br\s*\/?>|(?<=[.!?…])\s+)/)) { if (k + textLength(piece) > limit && acc) break; acc += piece; k += textLength(piece); }
        if (textLength(acc) > limit * 1.3) { // ни переносов, ни предложений — режем по словам вне тегов
          let out2 = "", cnt = 0;
          for (const tok of acc.split(/(<[^>]+>|\s+)/)) { if (!tok) continue; if (!tok.startsWith("<") && cnt + tok.length > limit) break; out2 += tok; if (!tok.startsWith("<")) cnt += tok.length; }
          acc = out2 + "…";
        }
        return { head: "<p>" + acc.replace(/(<br\s*\/?>|\s)+$/, "") + "</p>", cut: true };
      }
      return { head: b, cut: false };
    }
    out += b; n += len;
  }
  return { head: out, cut: false };
}
