"use client";
// Фильтры, вкладки и сортировка поиска — обычные ссылки (работают без JS), но с JS переход делаем «мягким»:
// Next подгружает только новую выдачу, страница не перезагружается и не прыгает наверх.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function SoftNav() {
  const router = useRouter();
  useEffect(() => {
    const root = document.getElementById("srch");
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a[href^='/search']") as HTMLAnchorElement | null;
      if (!a || e.metaKey || e.ctrlKey || e.button !== 0) return;
      e.preventDefault();
      router.push(a.getAttribute("href")!, { scroll: false });
    };
    const onSubmit = (e: Event) => {
      const f = e.target as HTMLFormElement;
      if (f.getAttribute("action") !== "/search") return;
      e.preventDefault();
      const p = new URLSearchParams(new FormData(f) as unknown as Record<string, string>);
      for (const [k, v] of [...p]) if (!v) p.delete(k);
      router.push("/search" + (p.toString() ? "?" + p.toString() : ""), { scroll: false });
    };
    root.addEventListener("click", onClick); root.addEventListener("submit", onSubmit);
    return () => { root.removeEventListener("click", onClick); root.removeEventListener("submit", onSubmit); };
  }, [router]);
  return null;
}
