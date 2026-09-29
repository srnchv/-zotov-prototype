"use client";
// Мобильная шапка главной (макет mobile / 1st screen): слева блок «логотип + кнопка Меню», справа «Зотов Центр ↗».
// «Меню» раскрывает список разделов поверх страницы.
import { useState } from "react";
import { NAV, LOGIN_URL, CENTER_URL, ExtIcon } from "./Sidebar";

export default function MobileMenu({ centerUrl = CENTER_URL }: { centerUrl?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="mmenu">
        <a className="mlogo" href="/"><img src="/assets/logo-zotov.svg" alt="Зотов" /></a>
        <button type="button" className="mbtn" onClick={() => setOpen(true)}>Меню</button>
      </div>
      <a className="mcenter" href={centerUrl} target="_blank" rel="noreferrer"><span>Зотов Центр</span><ExtIcon /></a>
      {open ? (
        <div className="moverlay" role="dialog" aria-label="Меню">
          <div className="mmenu open">
            <a className="mlogo" href="/"><img src="/assets/logo-zotov.svg" alt="Зотов" /></a>
            <button type="button" className="mbtn" onClick={() => setOpen(false)}>Закрыть</button>
          </div>
          <nav className="mnav">
            {NAV.map(([t, h]) => <a key={t} href={h}>{t}</a>)}
            <a className="mext" href={centerUrl} target="_blank" rel="noreferrer"><span>Зотов Центр</span><ExtIcon /></a>
          </nav>
          <a className="mlogin" href={LOGIN_URL}>Войти</a>
        </div>
      ) : null}
    </>
  );
}
