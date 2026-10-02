"use client";
// Галерея на странице сущности (макет 02.10): кадр 3:2, круглые стрелки 36 по бокам, под кадром подпись и счётчик «2/18».
// В кадре могут быть фото, видео и аудио — видео/аудио играют тем же плеером (Plyr).
import { useState } from "react";
import Player, { type Track } from "./Player";
export type MSlide =
  | { kind: "image"; src: string; title: string; pos?: string }
  | { kind: "video" | "audio"; src: string; title: string; poster?: string; tracks?: Track[] };
const Arrow = ({ left }: { left?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={left ? { transform: "scaleX(-1)" } : undefined}><path d="M2 7.2h9.25L7.54 3.5H9.5L14 8l-4.5 4.5H7.54l3.71-3.7H2V7.2Z" fill="#262626" /></svg>
);
export default function MediaGallery({ slides, caption }: { slides: MSlide[]; caption?: string }) {
  const [i, setI] = useState(0);
  const n = slides.length;
  const cur = slides[Math.min(i, n - 1)];
  const go = (d: number) => setI((x) => (x + d + n) % n);
  const label = cur.kind === "video" ? "Видео · " + cur.title : cur.kind === "audio" ? "Аудио · " + cur.title : cur.title;
  return (
    <div className="mgal">
      <div className="mgal-view">
        {cur.kind === "image" ? <img src={cur.src} alt={cur.title} style={cur.pos ? { objectPosition: cur.pos } : undefined} />
          : <Player key={cur.src} kind={cur.kind} src={cur.src} poster={cur.poster} tracks={cur.tracks || []} title={cur.title} />}
        {n > 1 ? <>
          <button type="button" className="mgal-arr l" aria-label="Предыдущий" onClick={() => go(-1)}><Arrow left /></button>
          <button type="button" className="mgal-arr r" aria-label="Следующий" onClick={() => go(1)}><Arrow /></button>
        </> : null}
      </div>
      <div className="mgal-cap"><span>{caption || label}</span>{n > 1 ? <b>{i + 1}/{n}</b> : null}</div>
    </div>
  );
}
