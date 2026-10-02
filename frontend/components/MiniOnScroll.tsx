"use client";
// Мини-«АРХИВ» под логотипом появляется, когда большой леттеринг главной ушёл за верх экрана
import { useEffect } from "react";
export default function MiniOnScroll() {
  useEffect(() => {
    const el = document.getElementById("mini-arhiv"), word = document.getElementById("word");
    const on = () => { if (el) el.classList.toggle("on", word ? word.getBoundingClientRect().bottom < 0 : window.scrollY > 340); };
    window.addEventListener("scroll", on, { passive: true }); on();
    return () => window.removeEventListener("scroll", on);
  }, []);
  return null;
}
