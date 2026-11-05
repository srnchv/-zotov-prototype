"use client";
// Кнопка «Войти» (ТЗ «Апдейт 05.11»): без авторизации — окно-заглушка «Личный кабинет скоро появится».
// Закрывается крестиком (40×40 снаружи окна), Esc и кликом по подложке. Иллюстрация — по макету: чёрный квадрат, фото, круг, красная диагональ.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
export default function LoginStub({ className, id }: { className?: string; id?: string }) {
  const [open, setOpen] = useState(false), [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);
  return (
    <>
      <button type="button" id={id} className={className} onClick={() => setOpen(true)}>Войти</button>
      {open && mounted ? createPortal(
        <div className="ovl login-ovl" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }} role="dialog" aria-modal="true" aria-labelledby="login-h">
          <div className="lwrap">
            <div className="mbox login">
              <div className="para"><h4 id="login-h">Личный кабинет скоро появится</h4><p>В нём можно будет сохранять материалы и собирать свои подборки.</p></div>
              <svg className="lill" viewBox="0 0 419 172" aria-hidden="true">
                <rect x="129" y="0" width="139" height="139" fill="#262626" />
                <image href="/assets/ch1933.jpg" x="140" y="13" width="139" height="139" preserveAspectRatio="xMidYMid slice" />
                <circle cx="268" cy="135.5" r="36.5" fill="#262626" />
                <path d="M4 158 L415 18" stroke="#F43C3A" strokeWidth="18" strokeLinecap="square" />
              </svg>
            </div>
            <button type="button" className="lx" aria-label="Закрыть" onClick={() => setOpen(false)}><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 2.4 8 6.9l4.5-4.5 1.1 1.1L9.1 8l4.5 4.5-1.1 1.1L8 9.1l-4.5 4.5-1.1-1.1L6.9 8 2.4 3.5l1.1-1.1Z" fill="#fff" /></svg></button>
          </div>
        </div>, document.body) : null}
    </>
  );
}
