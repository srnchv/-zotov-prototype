"use client";
// Модальное окно по макету: затемнение grey-1 40 %, белое окно без рамки и крестика; закрытие — клик вне или Esc
import { useEffect, useRef, type ReactNode } from "react";
export default function Modal({ onClose, children, className = "" }: { onClose: () => void; children: ReactNode; className?: string }) {
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", onKey); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, []);
  // закрываем по нажатию именно на подложку (выделение текста в поле с отпусканием снаружи окно не закрывает)
  return (
    <div className="ovl" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true">
      <div className={"mbox " + className}>{children}</div>
    </div>
  );
}
