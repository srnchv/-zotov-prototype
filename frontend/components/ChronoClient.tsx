"use client";
// Клиентская часть хронографа: подскролл к выбранному году (параметр y) и кнопка «Наверх» (макет 02.10, вариант 1 — с подписью)
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function YearJump() {
  const sp = useSearchParams();
  const y = sp.get("y");
  useEffect(() => {
    if (!y) return;
    const el = document.getElementById("y-" + y);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: "smooth" });
  }, [y]);
  return null;
}

// при прокрутке подсвечиваем в ленте год, чей блок сейчас под лентой
function YearSpy() {
  useEffect(() => {
    const strip = document.getElementById("ystrip");
    if (!strip) return;
    const links = [...strip.querySelectorAll<HTMLAnchorElement>("a[data-y]")];
    let raf = 0;
    const f = () => {
      raf = 0;
      const blocks = [...document.querySelectorAll<HTMLElement>(".yblock")];
      if (!blocks.length) return;
      const line = 80; // низ липкой ленты
      let cur = blocks[0];
      for (const b of blocks) if (b.getBoundingClientRect().top <= line) cur = b;
      const y = cur.id.replace("y-", "");
      for (const a of links) {
        a.classList.toggle("on", a.dataset.y === y);
        if (a.dataset.y === y && a.offsetLeft + a.offsetWidth > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = a.offsetLeft - 12;
        else if (a.dataset.y === y && a.offsetLeft < strip.scrollLeft) strip.scrollLeft = a.offsetLeft - 12;
      }
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(f); };
    // колесо мыши над лентой листает её вбок, если лет больше, чем влезает
    const wheel = (e: WheelEvent) => { if (strip.scrollWidth > strip.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); strip.scrollLeft += e.deltaY; } };
    strip.addEventListener("wheel", wheel, { passive: false });
    f(); window.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", on);
    return () => { strip.removeEventListener("wheel", wheel); window.removeEventListener("scroll", on); window.removeEventListener("resize", on); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return null;
}

export function ToTop() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const f = () => setOn(window.scrollY > 600);
    f(); window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  return (
    <button type="button" id="totop" className={on ? "on" : undefined} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
      <span>Наверх</span>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M7.2 14V4.75L3.5 8.46V6.5L8 2l4.5 4.5v1.96L8.8 4.75V14H7.2Z" fill="#262626" /></svg>
    </button>
  );
}

export default function ChronoClient() {
  return (<><Suspense fallback={null}><YearJump /></Suspense><YearSpy /><ToTop /></>);
}
