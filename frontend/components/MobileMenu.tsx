"use client";
// Шапка планшета/мобайла (макет 1st screen): слева блок «логотип + кнопка Меню», справа «Зотов Центр ↗».
// «Меню» открывает панель поверх страницы (мобайл — почти во весь экран, планшет — 384 слева):
// крестик слева сверху, логотип с «АРХИВ» справа, список разделов, внизу «Войти».
import { useEffect, useState } from "react";
import { NAV, LOGIN_URL, CENTER_URL, ExtIcon } from "./Sidebar";

const LETTERS = ["a", "r", "h", "i", "v"];
export default function MobileMenu({ centerUrl = CENTER_URL }: { centerUrl?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <>
      <div className="mmenu">
        <a className="mlogo" href="/"><img src="/assets/logo-zotov.svg" alt="Зотов" /></a>
        <button type="button" className="mbtn" onClick={() => setOpen(true)}>Меню</button>
      </div>
      <a className="mcenter" href={centerUrl} target="_blank" rel="noreferrer"><span>Зотов Центр</span><ExtIcon /></a>
      {open ? (
        <div className="moverlay" onClick={() => setOpen(false)}>
          <div className="mpanel" role="dialog" aria-label="Меню" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="mclose" aria-label="Закрыть" onClick={() => setOpen(false)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="#fff" strokeWidth="2" /></svg>
            </button>
            <div className="mlogo2">
              <img src="/assets/logo-zotov.svg" alt="Зотов" />
              <div className="marh">{LETTERS.map((l) => <img key={l} src={`/assets/letter-${l}.svg`} alt="" />)}</div>
            </div>
            <nav className="mnav">
              {NAV.map(([t, h]) => <a key={t} href={h}>{t}</a>)}
              <a className="mext" href={centerUrl} target="_blank" rel="noreferrer"><span>Зотов Центр</span><ExtIcon /></a>
            </nav>
            <a className="mlogin" href={LOGIN_URL}>Войти</a>
          </div>
        </div>
      ) : null}
    </>
  );
}
