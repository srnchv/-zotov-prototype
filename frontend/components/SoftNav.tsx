"use client";
// Фильтры, вкладки и сортировка поиска — обычные ссылки (работают без JS), но с JS переход делаем «мягким»:
// Next подгружает только новую выдачу, страница не перезагружается и не прыгает наверх.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function SoftNav({ root = "srch", prefix = "/search" }: { root?: string; prefix?: string }) {
  const router = useRouter();
  useEffect(() => {
    const rootEl = document.getElementById(root);
    if (!rootEl) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest(`a[href^='${prefix}']`) as HTMLAnchorElement | null;
      if (!a || e.metaKey || e.ctrlKey || e.button !== 0) return;
      e.preventDefault();
      router.push(a.getAttribute("href")!, { scroll: false });
    };
    const onSubmit = (e: Event) => {
      const f = e.target as HTMLFormElement;
      if (f.getAttribute("action") !== prefix) return;
      e.preventDefault();
      const p = new URLSearchParams(new FormData(f) as unknown as Record<string, string>);
      for (const [k, v] of [...p]) if (!v) p.delete(k);
      router.push(prefix + (p.toString() ? "?" + p.toString() : ""), { scroll: false });
    };
    rootEl.addEventListener("click", onClick); rootEl.addEventListener("submit", onSubmit);
    return () => { rootEl.removeEventListener("click", onClick); rootEl.removeEventListener("submit", onSubmit); };
  }, [router, root, prefix]);
  return null;
}
