"use client";
// Пункт «Связанные материалы (N)» в навигации по странице (макет 02.10): плюс раскрывает подсписок групп по типам
// со счётчиками — линия слева 4px, отступ 48; клик по группе подскролливает к ней.
import { useState } from "react";
import ScrollTo from "./ScrollTo";
export default function NavRel({ total, groups }: { total: number; groups: { id: string; label: string; n: number }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="navrel">
      <ScrollTo to="a-rel"><span>Связанные материалы</span><span className="num">({total})</span><span className="sp" /></ScrollTo>
      <button type="button" className="pm" aria-label={open ? "Свернуть" : "Раскрыть"} onClick={() => setOpen((v) => !v)}>
        {open ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 7.2h12v1.6H2z" fill="#262626" /></svg>
          : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M7.2 2h1.6v5.2H14v1.6H8.8V14H7.2V8.8H2V7.2h5.2V2Z" fill="#262626" /></svg>}
      </button>
      {open ? <div className="tert">{groups.map((g) => <ScrollTo key={g.id} to={g.id}><span>{g.label}</span><span className="num">({g.n})</span></ScrollTo>)}</div> : null}
    </div>
  );
}
