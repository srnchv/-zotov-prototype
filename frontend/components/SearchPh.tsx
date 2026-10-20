"use client";
// Плейсхолдер строки поиска: на мобайле — короткий вариант из админки (data-ph-m), чтобы помещался в 336.
import { useEffect } from "react";
export default function SearchPh() {
  useEffect(() => {
    const inp = document.getElementById("home-q") as HTMLInputElement | null; if (!inp) return;
    const full = inp.placeholder, short = inp.dataset.phM || full, mq = window.matchMedia("(max-width:599px)");
    const apply = () => { inp.placeholder = mq.matches ? short : full; };
    apply(); mq.addEventListener("change", apply); return () => mq.removeEventListener("change", apply);
  }, []);
  return null;
}
