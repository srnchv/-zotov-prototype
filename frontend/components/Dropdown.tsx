"use client";
// Выпадающий список панели выдачи (Типология / Сортировка) по макету: подпись серым, значение + шеврон;
// открытый список 200 — строки на сером, выбранная — чёрная, «(0)» — неактивная. Пункты — ссылки (работают и без JS).
import { useEffect, useRef, useState } from "react";

export type DItem = { label: string; count?: string; href?: string; active?: boolean };
const Chev = <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.4" fill="none" /></svg>;

export default function Dropdown({ caption, value, items }: { caption: string; value: string; items: DItem[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", off); window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); window.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className={"dd" + (open ? " open" : "")} ref={box}>
      <span className="dd-cap">{caption}</span>
      <button type="button" className="dd-val" aria-expanded={open} onClick={() => setOpen((v) => !v)}><span>{value}</span>{Chev}</button>
      {open ? (
        <div className="dd-list" role="listbox">
          {items.map((it) => it.href && !it.active
            ? <a key={it.label} className="dd-row" href={it.href} onClick={() => setOpen(false)}><span>{it.label}</span>{it.count ? <i>{it.count}</i> : null}</a>
            : <span key={it.label} className={"dd-row" + (it.active ? " on" : " off")}><span>{it.label}</span>{it.count && !it.active ? <i>{it.count}</i> : null}</span>)}
        </div>
      ) : null}
    </div>
  );
}
