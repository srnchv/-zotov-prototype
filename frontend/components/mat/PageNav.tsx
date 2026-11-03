"use client";
// Навигация по странице (ТЗ): липкая, только разделы, которые есть; активный — серый фон и жирный (десктоп) / серая линия и жирный (плашка).
// Десктоп: список в левой колонке с подменю «Связанные материалы». Планшет: плашка внизу со всеми пунктами. Мобайл: плашка с текущим разделом, по тапу — список.
import { useEffect, useRef, useState, type ReactNode } from "react";
export type NavItem = { id: string; label: string; count?: number; sub?: { id: string; label: string; count: number }[] };
const Arrow = ({ d }: { d: string }) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d={d} fill="currentColor" /></svg>;
const CHEV = "M3.5 6l4.5 4.5L12.5 6l1.1 1.1L8 12.7 2.4 7.1 3.5 6Z", X = "M3.5 2.4 8 6.9l4.5-4.5 1.1 1.1L9.1 8l4.5 4.5-1.1 1.1L8 9.1l-4.5 4.5-1.1-1.1L6.9 8 2.4 3.5l1.1-1.1Z", PLUS = "M7.2 2h1.6v5.2H14v1.6H8.8V14H7.2V8.8H2V7.2h5.2V2Z", MINUS = "M2 7.2h12v1.6H2z";
function go(id: string) { const el = document.getElementById(id); if (!el) return; window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 12, behavior: "smooth" }); }
export default function PageNav({ items, cite }: { items: NavItem[]; cite?: ReactNode }) {
  const [active, setActive] = useState(items[0]?.id || "");
  const [sub, setSub] = useState(false), [open, setOpen] = useState(false);
  const ids = useRef(items.map((i) => i.id));
  useEffect(() => {
    // активный раздел — последний, чья верхняя кромка выше середины экрана
    const onScroll = () => { let cur = ids.current[0]; for (const id of ids.current) { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.4) cur = id; } setActive(cur); };
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true }); return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const cur = items.find((i) => i.id === active) || items[0];
  return (
    <>
      <nav className="pnav" aria-label="Разделы страницы">
        {items.map((it) => (
          <div key={it.id} className={"pn" + (active === it.id ? " on" : "")}>
            <a href={"#" + it.id} onClick={(e) => { e.preventDefault(); go(it.id); }}>{it.label}{it.count != null ? <span className="num">({it.count})</span> : null}</a>
            {it.sub?.length ? <button type="button" className="pm" aria-label={sub ? "Свернуть" : "Развернуть"} onClick={() => setSub((v) => !v)}><Arrow d={sub ? MINUS : PLUS} /></button> : null}
            {it.sub?.length && sub ? <div className="tert">{it.sub.map((g) => <a key={g.id} href={"#" + g.id} onClick={(e) => { e.preventDefault(); go(g.id); }}>{g.label}<span className="num">({g.count})</span></a>)}</div> : null}
          </div>
        ))}
        <div className="end" />
      </nav>
      {/* планшет и мобайл: плашка внизу экрана */}
      <div className="pbar">
        <div className="pbar-items">{items.map((it) => <a key={it.id} href={"#" + it.id} className={active === it.id ? "on" : undefined} onClick={(e) => { e.preventDefault(); go(it.id); }}>{it.label}</a>)}</div>
        <div className="pbar-cur">
          <button type="button" className="curbtn" onClick={() => setOpen((v) => !v)}><span>{cur?.label}</span><Arrow d={open ? X : CHEV} /></button>
          {open ? <div className="pbar-list">{items.map((it) => <a key={it.id} href={"#" + it.id} className={active === it.id ? "on" : undefined} onClick={(e) => { e.preventDefault(); setOpen(false); go(it.id); }}>{it.label}</a>)}<div className="end" /></div> : null}
        </div>
        {cite ? <div className="pbar-cite">{cite}</div> : null}
      </div>
    </>
  );
}
