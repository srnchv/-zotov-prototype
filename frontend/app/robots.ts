import type { MetadataRoute } from "next";
import { SITE_URL, noindex } from "@/lib/seo";
export const dynamic = "force-dynamic";
// Тестовые хосты закрыты целиком; на основном домене закрыты только параметризованные варианты поиска
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (await noindex()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/search?", "/*?q=", "/*?page=", "/*?sort=", "/subs/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
