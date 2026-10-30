import type { MetadataRoute } from "next";
import { SITE_URL, noindex } from "@/lib/seo";
export const dynamic = "force-dynamic";
// Тестовые хосты закрыты целиком; на основном домене открыто всё, кроме служебных маршрутов
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (await noindex()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/subs/"] }], // варианты поиска с параметрами закрыты через noindex, а не здесь — иначе робот его не увидит
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
