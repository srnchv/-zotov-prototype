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
  return (<><Suspense fallback={null}><YearJump /></Suspense><ToTop /></>);
}
