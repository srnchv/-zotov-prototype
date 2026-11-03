"use client";
// Группа связанных: до 6 карточек, дальше «Показать все N» (ТЗ); карточки — item/horizontal по макету; роль связи — после подписи через « · »
import { useState, type CSSProperties } from "react";
export type RelCard = { id: string; title: string; sub: string; role?: string; img?: string; pos?: CSSProperties; aspect: number };
export default function Related({ id, label, items }: { id: string; label: string; items: RelCard[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 6);
  return (
    <div className="relgroup">
      <div className="subhead" id={id}><span className="tsm">{label}</span><span className="tsm grey">({items.length})</span></div>
      {shown.map((x) => (
        <a className="rel-item" key={x.id} href={`/m/${x.id}`}>
          <div className="dv" />
          <div className="row">
            <div className="tx"><h3>{x.title}</h3>{x.sub || x.role ? <div className="sub">{[x.sub, x.role].filter(Boolean).join(" · ")}</div> : null}<div className="vb" /></div>
            {x.img ? <div className="im" style={{ aspectRatio: String(x.aspect) }}><img src={x.img} alt="" style={x.pos} loading="lazy" /></div> : null}
          </div>
        </a>
      ))}
      {items.length > 6 && !all ? <button type="button" className="cut more" onClick={() => setAll(true)}><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M7.2 2h1.6v5.2H14v1.6H8.8V14H7.2V8.8H2V7.2h5.2V2Z" fill="currentColor" /></svg><span>Показать все {items.length}</span></button> : null}
      <div className="div8" />
    </div>
  );
}
