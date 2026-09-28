"use client";
// Мини-«АРХИВ» под логотипом появляется, когда большой леттеринг главной ушёл за верх экрана
import { useEffect } from "react";
export default function MiniOnScroll() {
  useEffect(() => {
    const el = document.getElementById("mini-arhiv");
    const on = () => { if (el) el.classList.toggle("on", window.scrollY > 340 * (window.innerWidth / 1920)); };
    window.addEventListener("scroll", on, { passive: true }); on();
    return () => window.removeEventListener("scroll", on);
  }, []);
  return null;
}
