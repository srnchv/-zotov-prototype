// Описание карточки: HTML из редактора админки (абзацы, заголовок, списки, сноски). Старые описания — простой текст с абзацами.
// Перед выводом чистим до разрешённого набора тегов; сноска — <span class="fn" data-fn="n">[n]</span>.
import sanitize from "sanitize-html";
export const toHtml = (v: unknown) => {
  const s = String(v ?? "").trim(); if (!s) return "";
  if (/^<([a-z]+)[\s>]/i.test(s)) return s;
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
  const blocks = html.match(/<(p|h2|h3|ul|ol)\b[\s\S]*?<\/\1>/g) || [html];
  let out = "", n = 0;
  for (const b of blocks) { if (n && n + textLength(b) > limit) return { head: out, cut: true }; out += b; n += textLength(b); }
  return { head: out, cut: false };
}
