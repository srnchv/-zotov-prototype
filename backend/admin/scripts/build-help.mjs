// Собирает public/help.html из help.md — инструкция по админке для клиента (/admin/help.html)
import { marked } from "marked";
import { readFileSync, writeFileSync } from "node:fs";
const md = readFileSync(new URL("../help.md", import.meta.url), "utf8");
const body = marked.parse(md, { gfm: true });
// оглавление по h2
const toc = [...body.matchAll(/<h2 id="([^"]+)">([^<]+)<\/h2>/g)].map(([, id, t]) => `<li><a href="#${id}">${t}</a></li>`).join("");
const css = `
@font-face{font-family:'PT Root UI';src:url('/admin/fonts/pt-root-ui.woff2') format('woff2');font-weight:300 700;font-display:swap}
*{box-sizing:border-box}body{margin:0;font-family:'PT Root UI',system-ui,sans-serif;color:#262626;font-size:16px;line-height:24px;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
.wrap{display:grid;grid-template-columns:260px minmax(0,760px);gap:48px;padding:40px 48px;max-width:1140px}
nav{position:sticky;top:24px;align-self:start;font-size:14px;line-height:20px}
nav ol{list-style:none;padding:0;margin:12px 0 0}nav li{margin:0 0 6px}nav a{color:#262626;text-decoration:none;border-bottom:1px solid #ccc}nav a:hover{color:#f43c3a;border-color:#f43c3a}
.back{display:inline-block;font-size:14px;color:#262626;text-decoration:none;border-bottom:1px solid #262626}
h1{font-size:36px;line-height:40px;font-weight:700;margin:0 0 20px;letter-spacing:-.01em}
h2{font-size:24px;line-height:28px;font-weight:700;margin:56px 0 16px;padding-top:16px;border-top:4px solid #262626}
h3{font-size:18px;line-height:24px;font-weight:700;margin:32px 0 10px}
p{margin:0 0 14px}ul,ol{padding-left:22px;margin:0 0 14px}li{margin-bottom:6px}
table{border-collapse:collapse;width:100%;margin:0 0 20px;font-size:14px;line-height:20px}
th,td{border-top:1px solid #d9d9d9;padding:8px 10px 8px 0;text-align:left;vertical-align:top}th{font-weight:700;border-top:2px solid #262626}
tr:last-child td{border-bottom:1px solid #d9d9d9}
code{font-family:ui-monospace,Menlo,monospace;font-size:13px;background:#f2f2f2;padding:1px 5px}
pre{background:#f2f2f2;padding:12px 14px;overflow:auto;font-size:13px;line-height:18px}pre code{background:none;padding:0}
strong{font-weight:700}
@media(max-width:900px){.wrap{grid-template-columns:1fr;padding:24px 16px;gap:24px}nav{position:static}h1{font-size:28px;line-height:32px}}
@media print{nav{display:none}.wrap{display:block;padding:0}}
`;
const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Инструкция по админке — Зотов · Архив</title><style>${css}</style></head>
<body><div class="wrap"><nav><a class="back" href="/admin/">← В админку</a><ol>${toc}</ol></nav><main>${body}</main></div></body></html>`;
writeFileSync(new URL("../public/help.html", import.meta.url), html);
console.log("help.html:", (html.length / 1024).toFixed(0), "KB");
