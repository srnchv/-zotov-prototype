"use client";
// Листалка медиа на странице сущности: все фото, видео и аудио карточки в одном окне,
// внизу справа индикатор «1 НАЗВАНИЕ 2 3 4 5». Видео/аудио — тем же плеером (Plyr).
import { useState } from "react";
import Player, { type Track } from "./Player";
export type MSlide =
  | { kind: "image"; src: string; title: string; pos?: string }
  | { kind: "video" | "audio"; src: string; title: string; poster?: string; tracks?: Track[] };
export default function MediaGallery({ slides }: { slides: MSlide[] }) {
  const [i, setI] = useState(0);
  const cur = slides[Math.min(i, slides.length - 1)];
  return (
    <div className="mgal">
      <div className="mgal-view">
        {cur.kind === "image" ? <img src={cur.src} alt={cur.title} style={cur.pos ? { objectPosition: cur.pos } : undefined} />
          : <Player key={cur.src} kind={cur.kind} src={cur.src} poster={cur.poster} tracks={cur.tracks || []} title={cur.title} />}
      </div>
      <div className="mgal-nav">
        {slides.map((sl, n) => (
          <button type="button" key={n} className={n === i ? "on" : undefined} onClick={() => setI(n)}>
            <b>{n + 1}</b>{n === i ? <span>{sl.kind === "video" ? "Видео · " : sl.kind === "audio" ? "Аудио · " : ""}{sl.title}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
