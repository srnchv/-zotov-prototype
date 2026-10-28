import { headers } from "next/headers";
// Адреса и индексация. Основной домен задаётся переменной SITE_URL (по умолчанию боевой);
// любой другой хост (тестовый стенд Timeweb, превью) автоматически получает noindex — без отдельной настройки.
export const SITE_URL = (process.env.SITE_URL || "https://archive.centrezotov.ru").replace(/\/+$/, "");
export const SITE_HOST = new URL(SITE_URL).host;
export const SITE_NAME = "ЗОТОВ. Архив";
export const abs = (p: string) => SITE_URL + p;

// хост текущего запроса; NOINDEX=1 закрывает сайт принудительно (на время наполнения), NOINDEX=0 — открывает
// независимо от хоста (на случай, если прокси хостинга не передаёт внешний домен)
export async function noindex(): Promise<boolean> {
  if (process.env.NOINDEX === "1") return true;
  if (process.env.NOINDEX === "0") return false;
  try {
    const h = await headers();
    const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim();
    return !!host && host !== SITE_HOST;
  } catch { return false; }
}

// описание страницы из текста карточки: первый абзац, до ~160 знаков по границе слова
export function descOf(text: string, fallback = "", max = 160) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  const first = t.split(/(?<=[.!?…])\s/)[0] || t;
  const src = first.length >= 60 ? first : t;
  if (!src) return fallback;
  if (src.length <= max) return src;
  const cut = src.slice(0, max - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), 80)).replace(/[,;:—–-]$/, "") + "…";
}
