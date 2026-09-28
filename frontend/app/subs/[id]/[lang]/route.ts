import { API } from "@/lib/api";
// Субтитры с того же origin, что и страница: браузер не требует CORS от хранилища для <track>
export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; lang: string }> }) {
  const { id, lang } = await params;
  const l = lang.replace(/\.vtt$/, "");
  try {
    const m = await fetch(`${API}/entities/${encodeURIComponent(id)}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
    const t = ((m?.subtitles as { lang: string; url: string }[]) || []).find((x) => x.lang === l);
    if (!t) return new Response("not found", { status: 404 });
    const vtt = await fetch(t.url, { cache: "no-store" }).then((r) => (r.ok ? r.text() : ""));
    if (!vtt) return new Response("not found", { status: 404 });
    return new Response(vtt, { headers: { "content-type": "text/vtt; charset=utf-8", "cache-control": "public, max-age=300" } });
  } catch { return new Response("error", { status: 502 }); }
}
