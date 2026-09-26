import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ЗОТОВ — Архив",
  description: "Цифровой архив Центра «Зотов»: материалы, личности, события, места и проекты, объединённые в единую систему связей",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400..900&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
