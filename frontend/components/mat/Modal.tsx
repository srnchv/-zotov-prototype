"use client";
// Модальное окно по макету: затемнение grey-1 40 %, белое окно без рамки и крестика; закрытие — клик вне или Esc
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
const X = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 2.4 8 6.9l4.5-4.5 1.1 1.1L9.1 8l4.5 4.5-1.1 1.1L8 9.1l-4.5 4.5-1.1-1.1L6.9 8 2.4 3.5l1.1-1.1Z" fill="#fff" /></svg>;
export default function Modal({ onClose, children, className = "" }: { onClose: () => void; children: ReactNode; className?: string }) {
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", onKey); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, []);
  // закрываем по нажатию именно на подложку (выделение текста в поле с отпусканием снаружи окно не закрывает)
  if (!mounted) return null;
  // портал в body: окно и затемнение поверх всей страницы, вне колонок и их слоёв
  return createPortal(
    <div className="ovl" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true">
      <div className="lwrap"><div className={"mbox " + className}>{children}</div><button type="button" className="lx" aria-label="Закрыть" onClick={onClose}><X /></button></div>
    </div>, document.body);
}
