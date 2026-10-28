import type { MetadataRoute } from "next";
import { loadArchive } from "@/lib/api";
import { kindOf, KINDS } from "@/lib/search";
import { SITE_URL, noindex } from "@/lib/seo";
import { CAT_PATHS } from "@/lib/cats";
export const dynamic = "force-dynamic";
// Только опубликованные карточки основного домена (публичный /export уже без черновиков и закрытых файлов)
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (await noindex()) return [];
  const db = await loadArchive();
  const pages: MetadataRoute.Sitemap = [
    { url: SITE_URL + "/", changeFrequency: "weekly", priority: 1 },
    ...["/search", "/map", "/chrono", ...Object.values(CAT_PATHS)].map((p) => ({ url: SITE_URL + p, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
  for (const e of Object.values(db)) {
    const k = kindOf(e);
    if (!k || !KINDS.some(([x]) => x === k)) continue;
    const lm = e.updated_at ? new Date(String(e.updated_at)) : undefined;
    pages.push({ url: `${SITE_URL}/m/${encodeURIComponent(e.id)}`, lastModified: lm && !isNaN(+lm) ? lm : undefined, changeFrequency: "monthly", priority: 0.6 });
  }
  return pages;
}
