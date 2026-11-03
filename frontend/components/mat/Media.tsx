"use client";
// Медиа-блок страницы сущности (ТЗ, состояния 1–9): одно фото / галерея (фото и видео вместе) / видео / аудио-виджет / 3D-тур.
// Стрелки 32 (mix-blend), кнопка «на весь экран», под кадром подпись и автор/год. Полноэкранная галерея: белый фон, превью
// (колонка слева — десктоп, лента снизу — мобайл), подпись, счётчик «2/132», закрытие крестиком и Esc; видео — на весь экран с полосой плеера.
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import AvPlayer, { type Track } from "./AvPlayer";
export type Slide =
  | { kind: "image"; src: string; big?: string; w?: number; h?: number; caption: string; credit: string; pos?: CSSProperties }
  | { kind: "video"; src: string; mediaId: string; hls?: string; poster?: string; thumb?: string; tracks: Track[]; caption: string; credit: string }
  | { kind: "tour"; src: string; caption: string; credit: string };
const Play = () => <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5-9-5.5Z" fill="#fff" /></svg>;
const Arr = ({ left }: { left?: boolean }) => <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={left ? { transform: "scaleX(-1)" } : undefined}><path d="M4 14.4h18.5L15.1 7l2-2L28 16 17.1 27l-2-2 7.4-7.4H4v-3.2Z" fill="#fff" /></svg>;
const Full = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke="#fff" strokeWidth="1.6" /></svg>;
const X = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 2.4 8 6.9l4.5-4.5 1.1 1.1L9.1 8l4.5 4.5-1.1 1.1L8 9.1l-4.5 4.5-1.1-1.1L6.9 8 2.4 3.5l1.1-1.1Z" fill="#fff" /></svg>;
export function Tour({ src, title }: { src: string; title: string }) {
  return <iframe className="tour" src={src} title={title} loading="lazy" sandbox="allow-scripts allow-same-origin allow-pointer-lock" allowFullScreen allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer; autoplay; vr" referrerPolicy="no-referrer-when-downgrade" />;
}
const ratio = (s: Slide) => (s.kind === "image" && s.w && s.h ? s.w / s.h : 1.5);

export default function Media({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0), [full, setFull] = useState(false);
  const n = slides.length, cur = slides[Math.min(i, n - 1)];
  const go = useCallback((d: number) => setI((x) => (x + d + n) % n), [n]);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    document.addEventListener("keydown", onKey); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [full, go]);
  if (!n) return null;
  const isVideo = cur.kind === "video";
  const frame = (s: Slide, big: boolean) =>
    s.kind === "image" ? <img src={big && s.big ? s.big : s.src} alt={s.caption} style={big ? undefined : s.pos} draggable={false} />
    : s.kind === "tour" ? <Tour src={s.src} title={s.caption} />
    : <AvPlayer key={s.src + (big ? "f" : "")} kind="video" src={s.src} mediaId={s.mediaId} hls={s.hls} poster={s.poster} tracks={s.tracks} title={s.caption} big={big} />;
  return (
    <>
      <div className={"mblock" + (isVideo ? " isvideo" : cur.kind === "tour" ? " istour" : "")}>
        <div className={"mframe" + (cur.kind === "image" ? " clickable" : "")} onClick={cur.kind === "image" ? () => setFull(true) : undefined}>
          {full && isVideo ? <div className="avhold" /> : frame(cur, false)} {/* в фуллскрине видео живёт только там — не два плеера */}
          {n > 1 ? <><button type="button" className="marr l" aria-label="Предыдущий" onClick={(e) => { e.stopPropagation(); go(-1); }}><Arr left /></button><button type="button" className="marr r" aria-label="Следующий" onClick={(e) => { e.stopPropagation(); go(1); }}><Arr /></button></> : null}
          {cur.kind !== "tour" ? <button type="button" className="mfull" aria-label="На весь экран" onClick={(e) => { e.stopPropagation(); setFull(true); }}><Full /></button> : null}
        </div>
        <div className="mcap"><div>{cur.caption}</div>{cur.credit ? <div className="grey">{cur.credit}</div> : null}</div>
      </div>
      {full ? createPortal(
        <div className={"fs" + (isVideo ? " fsvideo" : "") + (n > 1 ? " multi" : "")} role="dialog" aria-modal="true">
          {!isVideo && n > 1 ? <div className="fsthumbs">{slides.map((s, k) => <button type="button" key={k} className={k === i ? "on" : undefined} style={{ aspectRatio: String(ratio(s)) }} onClick={() => setI(k)} aria-label={`Слайд ${k + 1}`}>{s.kind === "image" ? <img src={s.src} alt="" draggable={false} /> : s.kind === "video" ? <span className="vth">{s.thumb ? <img src={s.thumb} alt="" draggable={false} /> : null}<Play /></span> : <span />}</button>)}</div> : null}
          <div className="fsimg">{frame(cur, true)}</div>
          {!isVideo ? <div className="fsinfo"><div className="fscap"><div>{cur.caption}</div>{cur.credit ? <div className="grey">{cur.credit}</div> : null}{n > 1 ? <div className="grey num">{i + 1}/{n}</div> : null}</div><button type="button" className="fsx" aria-label="Закрыть" onClick={() => setFull(false)}><X /></button></div>
            : <button type="button" className="fsx" aria-label="Закрыть" onClick={() => setFull(false)}><X /></button>}
          {n > 1 ? <><button type="button" className="marr l" aria-label="Предыдущий" onClick={() => go(-1)}><Arr left /></button><button type="button" className="marr r" aria-label="Следующий" onClick={() => go(1)}><Arr /></button></> : null}
        </div>, document.body) : null}
    </>
  );
}
