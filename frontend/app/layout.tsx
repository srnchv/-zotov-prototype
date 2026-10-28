import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import HomeScale from "@/components/HomeScale";
import { getSite } from "@/lib/site";
import { SITE_URL, SITE_NAME, noindex } from "@/lib/seo";

const DESCRIPTION = "Цифровой архив Центра «Зотов»: материалы, личности, события, места и проекты, объединённые в единую систему связей";
// Общие метаданные: основной домен (SITE_URL), шаблон заголовка, превью для соцсетей.
// На любом хосте, кроме основного (тестовый стенд), и при NOINDEX=1 — noindex для всех страниц.
export async function generateMetadata(): Promise<Metadata> {
  const closed = await noindex();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `ЗОТОВ — Архив`, template: `%s — ${SITE_NAME}` },
    description: DESCRIPTION,
    applicationName: SITE_NAME,
    openGraph: { siteName: SITE_NAME, locale: "ru_RU", type: "website", title: "ЗОТОВ — Архив", description: DESCRIPTION },
    twitter: { card: "summary_large_image" },
    alternates: { canonical: "/" },
    robots: closed ? { index: false, follow: false, nocache: true } : { index: true, follow: true },
  };
}

// Каркас общий для всех страниц: фиксированное меню слева (180) + контент; меню при переходах не перерисовывается
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await getSite();
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400..900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="pg">
          <HomeScale />
          <div id="stage"><Sidebar centerUrl={site.centerUrl} /></div>
          {children}
        </div>
      </body>
    </html>
  );
}
