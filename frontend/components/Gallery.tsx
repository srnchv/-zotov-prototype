"use client";
// Листалка коллекции на главной: до 5 фото, снизу справа индикатор «1 НАЗВАНИЕ 2 3 4 5» — клик переключает кадр
import { useState } from "react";
export type Slide = { src: string; title: string; pos?: string };
export default function Gallery({ slides, alt }: { slides: Slide[]; alt: string }) {
  const [i, setI] = useState(0);
  const cur = slides[Math.min(i, slides.length - 1)];
  return (
    <div className="gal">
      <img src={cur.src} alt={alt} style={cur.pos ? { objectPosition: cur.pos } : undefined} />
      {slides.length > 1 ? (
        <div className="gal-nav" onClick={(e) => e.preventDefault()}>
          {slides.map((sl, n) => (
            <button type="button" key={n} className={n === i ? "on" : undefined} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setI(n); }}>
              <b>{n + 1}</b>{n === i ? <span>{sl.title}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
