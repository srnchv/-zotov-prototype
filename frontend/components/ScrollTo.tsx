"use client";
// Навигация по странице (левое меню): подскролл правой колонки с учётом масштаба сцены
export default function ScrollTo({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) {
  return (
    <a className={className} href={"#" + to} onClick={(e) => { e.preventDefault(); const el = document.getElementById(to); if (!el) return;
      const k = window.innerWidth / 1920; window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80 * k, behavior: "smooth" }); }}>
      {children}
    </a>
  );
}
