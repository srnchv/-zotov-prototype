import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import HomeScale from "@/components/HomeScale";
import { getSite } from "@/lib/site";

export const metadata: Metadata = {
  title: "ЗОТОВ — Архив",
  description: "Цифровой архив Центра «Зотов»: материалы, личности, события, места и проекты, объединённые в единую систему связей",
};

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
