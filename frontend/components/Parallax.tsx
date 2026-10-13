"use client";
// Параллакс нижних колонок «Об архиве»: при скролле едут на треть медленнее фона (сдвиг до ±80px)
import { useEffect } from "react";
export default function Parallax({ target, k = 0.33, max = 80 }: { target: string; k?: number; max?: number }) {
  useEffect(() => {
    const el = document.getElementById(target); if (!el) return;
    const sec = el.parentElement!;
    let raf = 0;
    const f = () => { raf = 0; const r = sec.getBoundingClientRect(); const d = (r.top + r.height / 2 - window.innerHeight / 2) * k; el.style.transform = `translateY(${Math.max(-max, Math.min(max, d))}px)`; };
    const on = () => { if (!raf) raf = requestAnimationFrame(f); };
    f(); window.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); el.style.transform = ""; };
  }, [target, k, max]);
  return null;
}
