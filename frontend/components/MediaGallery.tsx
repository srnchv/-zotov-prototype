"use client";
// Галерея на странице сущности (макет 02.10): кадр 3:2, круглые стрелки 36 по бокам, под кадром подпись и счётчик «2/18».
// В кадре могут быть фото, видео и аудио — видео/аудио играют тем же плеером (Plyr).
import { useState } from "react";
import Player, { type Track } from "./Player";
export type MSlide =
  | { kind: "image"; src: string; title: string; pos?: React.CSSProperties; sub?: string } // sub — «Автор, год» из полей файла
  | { kind: "video" | "audio"; src: string; title: string; poster?: string; tracks?: Track[] }
  | { kind: "tour"; src: string; title: string };
const Arrow = ({ left }: { left?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={left ? { transform: "scaleX(-1)" } : undefined}><path d="M2 7.2h9.25L7.54 3.5H9.5L14 8l-4.5 4.5H7.54l3.71-3.7H2V7.2Z" fill="#262626" /></svg>
);
// 3D-тур (Matterport, Kuula, 3DVista и т.п.): живёт внутри окна галереи; на весь экран — кнопкой самого тура
export function Tour({ src, title }: { src: string; title: string }) {
  return <iframe className="tour" src={src} title={title} loading="lazy" allowFullScreen allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer; autoplay; vr" referrerPolicy="no-referrer-when-downgrade" />;
}
export default function MediaGallery({ slides, caption }: { slides: MSlide[]; caption?: string }) {
  const [i, setI] = useState(0);
  const n = slides.length;
  const cur = slides[Math.min(i, n - 1)];
  const go = (d: number) => setI((x) => (x + d + n) % n);
  const label = cur.kind === "video" ? "Видео · " + cur.title : cur.kind === "audio" ? "Аудио · " + cur.title : cur.kind === "tour" ? "3D-тур · " + cur.title : cur.title;
  return (
    <div className="mgal">
      <div className="mgal-view">
        {cur.kind === "image" ? <img src={cur.src} alt={cur.title} style={cur.pos} />
          : cur.kind === "tour" ? <Tour src={cur.src} title={cur.title} />
          : <Player key={cur.src} kind={cur.kind} src={cur.src} poster={cur.poster} tracks={cur.tracks || []} title={cur.title} />}
        {n > 1 ? <>
          <button type="button" className="mgal-arr l" aria-label="Предыдущий" onClick={() => go(-1)}><Arrow left /></button>
          <button type="button" className="mgal-arr r" aria-label="Следующий" onClick={() => go(1)}><Arrow /></button>
        </> : null}
      </div>
      <div className="mgal-cap"><span>{caption || label}{cur.kind === "image" && cur.sub ? <small>{cur.sub}</small> : null}</span>{n > 1 ? <b>{i + 1}/{n}</b> : null}</div>
    </div>
  );
}
