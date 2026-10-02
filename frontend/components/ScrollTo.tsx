"use client";
// Навигация по странице (левое меню): плавный подскролл правой колонки к разделу
export default function ScrollTo({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) {
  return (
    <a className={className} href={"#" + to} onClick={(e) => { e.preventDefault(); const el = document.getElementById(to); if (!el) return;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 12, behavior: "smooth" }); }}>
      {children}
    </a>
  );
}
