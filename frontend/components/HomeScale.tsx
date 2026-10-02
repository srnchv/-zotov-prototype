"use client";
// Главная резиновая до 1920: меню 180 фикс, контент — остаток окна (брейкпоинты в home.css).
// Шире 1920 макет не растягиваем, а пропорционально увеличиваем (zoom), как в макете 2560.
import { useEffect } from "react";
export default function HomeScale() {
  useEffect(() => {
    const f = () => { const w = window.innerWidth; document.documentElement.style.zoom = w > 1920 ? String(w / 1920) : ""; };
    f(); window.addEventListener("resize", f);
    return () => { window.removeEventListener("resize", f); document.documentElement.style.zoom = ""; };
  }, []);
  return null;
}
