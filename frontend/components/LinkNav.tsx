"use client";
// Переходы по внутренним ссылкам без перезагрузки страницы: меню слева остаётся на месте, подгружается только контент.
// Перехватываем обычные <a href="/…"> по всему сайту (карточки, связанные, футер) и ведём через роутер Next.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
const SKIP = /^\/(api|subs|assets|admin)(\/|$)|\.(pdf|zip|jpg|jpeg|png|webp|svg|mp4|mp3|vtt|srt)(\?|$)/i;
export default function LinkNav() {
  const router = useRouter();
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") || "";
      if (!href.startsWith("/") || href.startsWith("//") || SKIP.test(href)) return;
      const url = new URL(href, location.href);
      if (url.pathname === location.pathname && url.search === location.search) return; // якорь на этой же странице — браузеру
      e.preventDefault();
      router.push(href);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [router]);
  return null;
}
