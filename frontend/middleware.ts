import { NextResponse, type NextRequest } from "next/server";
// Страницы отдаются из кэша и не знают хоста запроса, поэтому запрет индексации тестовых хостов — заголовком здесь:
// любой хост, кроме основного (SITE_URL), получает X-Robots-Tag: noindex. NOINDEX=0 отключает проверку.
const SITE_HOST = new URL(process.env.SITE_URL || "https://archive.centrezotov.ru").host;
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (process.env.NOINDEX === "0") return res;
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim();
  if (process.env.NOINDEX === "1" || (host && host !== SITE_HOST)) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
export const config = { matcher: ["/((?!_next/|assets/|favicon).*)"] };
