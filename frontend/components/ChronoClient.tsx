"use client";
// Клиентская часть хронографа: прокрутка к выбранному году (?y=), закрепление таймлайна (класс stuck по положению),
// автоподсветка активного года по блоку на экране с подкруткой ленты, кнопка «наверх» вместе с закреплённым таймлайном.
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const TOP = 12; // отступ закреплённого таймлайна от верха (макет)
const yearTop = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY - (TOP + 40 + 12);

function YearJump() {
  const sp = useSearchParams();
  const y = sp.get("y");
  useEffect(() => {
    if (!y) return;
    const el = document.getElementById("y-" + y);
    if (el) window.scrollTo({ top: yearTop(el), behavior: "smooth" });
  }, [y]);
  return null;
}

function Sticky({ onStuck }: { onStuck: (v: boolean) => void }) {
  useEffect(() => {
    const strip = document.getElementById("tline"); if (!strip) return;
    const links = [...strip.querySelectorAll<HTMLAnchorElement>("a[data-y]")];
    const row = strip.querySelector<HTMLElement>(".tl-row");
    let raf = 0;
    const f = () => {
      raf = 0;
      const stuck = strip.getBoundingClientRect().top <= TOP + 0.5 && window.scrollY > 100;
      strip.classList.toggle("stuck", stuck); document.body.classList.toggle("chr-stuck", stuck); onStuck(stuck);
      const blocks = [...document.querySelectorAll<HTMLElement>(".yblock")];
      if (!blocks.length) return;
      const line = TOP + 40 + 16; // низ закреплённой ленты
      let cur: HTMLElement | null = null;
      for (const b of blocks) if (b.getBoundingClientRect().top <= line) cur = b;
      if (!cur && stuck) cur = blocks[0];
      const y = cur ? cur.id.replace("y-", "") : "";
      for (const a of links) {
        const on = a.dataset.y === y;
        a.classList.toggle("on", on);
        // в закреплённом состоянии лента подкручивается, чтобы активный год был виден
        if (on && row && row.scrollWidth > row.clientWidth) {
          if (a.offsetLeft + a.offsetWidth > row.scrollLeft + row.clientWidth) row.scrollTo({ left: a.offsetLeft - 12, behavior: "smooth" });
          else if (a.offsetLeft < row.scrollLeft) row.scrollTo({ left: a.offsetLeft - 12, behavior: "smooth" });
        }
      }
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(f); };
    const wheel = (e: WheelEvent) => { if (row && row.scrollWidth > row.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); row.scrollLeft += e.deltaY; } };
    row?.addEventListener("wheel", wheel, { passive: false });
    f(); window.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", on);
    return () => { row?.removeEventListener("wheel", wheel); window.removeEventListener("scroll", on); window.removeEventListener("resize", on); if (raf) cancelAnimationFrame(raf); document.body.classList.remove("chr-stuck"); };
  }, [onStuck]);
  return null;
}

export default function ChronoClient() {
  const [stuck, setStuck] = useState(false);
  return (
    <>
      <Suspense fallback={null}><YearJump /></Suspense>
      <Sticky onStuck={setStuck} />
      {/* кнопка «наверх»: 40×40, серая, появляется вместе с закреплённым таймлайном */}
      <button type="button" id="totop" className={stuck ? "on" : undefined} aria-label="Наверх" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M7.2 14V4.75L3.5 8.46V6.5L8 2l4.5 4.5v1.96L8.8 4.75V14H7.2Z" fill="currentColor" /></svg>
      </button>
    </>
  );
}
