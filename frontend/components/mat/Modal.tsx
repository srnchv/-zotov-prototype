"use client";
// Модальное окно по макету: затемнение grey-1 40 %, белое окно без рамки и крестика; закрытие — клик вне или Esc
import { useEffect, type ReactNode } from "react";
export default function Modal({ onClose, children, className = "" }: { onClose: () => void; children: ReactNode; className?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="ovl" onClick={onClose} role="dialog" aria-modal="true">
      <div className={"mbox " + className} onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}
