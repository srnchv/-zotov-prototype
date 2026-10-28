import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import HomeScale from "@/components/HomeScale";
import LinkNav from "@/components/LinkNav";
import { getSite } from "@/lib/site";
import { SITE_URL, SITE_NAME, noindex } from "@/lib/seo";

const DESCRIPTION = "Цифровой архив Центра «Зотов»: материалы, личности, события, места и проекты, объединённые в единую систему связей";
// Общие метаданные: основной домен (SITE_URL), шаблон заголовка, превью для соцсетей; тексты и картинка — из админки («Тексты сайта» → SEO).
// На любом хосте, кроме основного (тестовый стенд), и при NOINDEX=1 — noindex для всех страниц, коды подтверждения не подставляются.
export async function generateMetadata(): Promise<Metadata> {
  const [closed, site] = await Promise.all([noindex(), getSite()]);
  const title = site.seoTitle || "ЗОТОВ — Архив", description = site.seoDesc || DESCRIPTION;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s — ${SITE_NAME}` },
    description,
    applicationName: SITE_NAME,
    openGraph: { siteName: SITE_NAME, locale: "ru_RU", type: "website", title, description, images: site.ogImage ? [{ url: site.ogImage }] : undefined },
    twitter: { card: site.ogImage ? "summary_large_image" : "summary" },
    alternates: { canonical: "/" },
    robots: closed ? { index: false, follow: false, nocache: true } : { index: true, follow: true },
    verification: closed ? undefined : { ...(site.gscCode ? { google: site.gscCode } : {}), ...(site.ywCode ? { yandex: site.ywCode } : {}) },
  };
}

// Каркас общий для всех страниц: фиксированное меню слева (180) + контент; меню при переходах не перерисовывается
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [site, closed] = await Promise.all([getSite(), noindex()]);
  const metrika = !closed && /^\d+$/.test(site.metrikaId) ? site.metrikaId : "";
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400..900&display=swap" rel="stylesheet" />
        {metrika ? <script dangerouslySetInnerHTML={{ __html: `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${metrika},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:false});` }} /> : null}
      </head>
      <body>
        <div className="pg">
          <HomeScale />
          <LinkNav />
          <div id="stage"><Sidebar centerUrl={site.centerUrl} /></div>
          {children}
        </div>
      </body>
    </html>
  );
}
