"use client";
// Плеер видео и аудио по макету (ТЗ «Единый шаблон»): полоса 64 — play 40, название и таймкод, прогресс, кнопки «×1.25» (скорость),
// звук (вертикальный ползунок), субтитры (нажата — серая), настройки (качество: только те варианты, что есть у видео).
// Видео — HLS через hls.js (Safari — нативно), запасной вариант — оригинал; аудио — обычный <audio>.
import { useEffect, useRef, useState } from "react";
import { API } from "@/lib/api";
export type Track = { lang: string; label: string; url: string };
export type AvProps = { kind: "video" | "audio"; src: string; mediaId?: string; hls?: string; poster?: string; tracks?: Track[]; title: string; big?: boolean; onEnded?: () => void; autoPlay?: boolean };
const SPEEDS = [2, 1.5, 1.25, 1, 0.5];
const fmt = (t: number) => { if (!isFinite(t)) return "00:00"; const m = Math.floor(t / 60), s = Math.floor(t % 60); return (m >= 60 ? Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0") : String(m).padStart(2, "0")) + ":" + String(s).padStart(2, "0"); };
const I = {
  play: <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5-9-5.5Z" fill="#262626" /></svg>,
  pause: <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" fill="#262626" /></svg>,
  sound: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 6h2.5L8 3v10L4.5 10H2V6Zm8-1.5a4 4 0 0 1 0 7M10.5 2a6.5 6.5 0 0 1 0 12" stroke="currentColor" strokeWidth="1.5" /></svg>,
  mute: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 6h2.5L8 3v10L4.5 10H2V6Zm8 0 4 4m0-4-4 4" stroke="currentColor" strokeWidth="1.5" /></svg>,
  cc: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3" width="13" height="10" stroke="currentColor" strokeWidth="1.5" /><path d="M7 7a1.5 1.5 0 1 0 0 2M11.5 7a1.5 1.5 0 1 0 0 2" stroke="currentColor" strokeWidth="1.5" /></svg>,
  gear: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.5" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" strokeWidth="1.5" /></svg>,
};
export default function AvPlayer({ kind, src, mediaId, hls, poster, tracks = [], title, big, onEnded, autoPlay }: AvProps) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [useHls, setUseHls] = useState(!!hls);
  const [realSrc, setRealSrc] = useState(hls ? "" : src);
  const [playing, setPlaying] = useState(false), [t, setT] = useState(0), [dur, setDur] = useState(0);
  const [speed, setSpeed] = useState(1), [vol, setVol] = useState(1), [muted, setMuted] = useState(false), [cc, setCc] = useState(false);
  const [levels, setLevels] = useState<number[]>([]), [level, setLevel] = useState(-1), [menu, setMenu] = useState<"" | "speed" | "vol" | "q">("");
  const hlsRef = useRef<{ destroy: () => void; currentLevel: number; levels: { height: number }[] } | null>(null);
  // подписанная ссылка на оригинал для прямого проигрывания (страница кэшируется — ссылку берём на клиенте)
  useEffect(() => {
    let alive = true;
    if (hls && useHls) { setRealSrc(""); return; }
    if (!mediaId) { setRealSrc(src); return; }
    setRealSrc(src);
    fetch(`${API}/media/${mediaId}/original?ttl=21600`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive && j?.url) setRealSrc(String(j.url)); }).catch(() => {});
    return () => { alive = false; };
  }, [mediaId, src, hls, useHls]);
  // HLS
  useEffect(() => {
    const el = ref.current; if (!el || kind !== "video" || !hls || !useHls) return;
    let h: any = null; let dead = false;
    (async () => {
      const { default: Hls } = await import("hls.js");
      if (dead) return;
      if (Hls.isSupported()) {
        h = new Hls({ capLevelToPlayerSize: true, startLevel: -1, maxBufferLength: 30 });
        hlsRef.current = h;
        h.on(Hls.Events.MANIFEST_PARSED, () => { setLevels([...new Set((h.levels as { height: number }[]).map((l) => l.height))].sort((a, b) => b - a)); if (autoPlay) el.play().catch(() => {}); });
        h.on(Hls.Events.ERROR, (_e: unknown, d: { fatal: boolean }) => { if (d.fatal) { h.destroy(); hlsRef.current = null; setUseHls(false); } });
        h.loadSource(hls); h.attachMedia(el);
      } else if (el.canPlayType("application/vnd.apple.mpegurl")) { el.src = hls; }
      else setUseHls(false);
    })();
    return () => { dead = true; h?.destroy(); hlsRef.current = null; };
  }, [hls, useHls, kind, autoPlay]);
  useEffect(() => { const el = ref.current; if (el) { el.playbackRate = speed; } }, [speed, realSrc]);
  useEffect(() => { const el = ref.current; if (el) { el.volume = vol; el.muted = muted; } }, [vol, muted, realSrc]);
  useEffect(() => { const el = ref.current; if (!el) return; for (const tr of Array.from(el.textTracks)) tr.mode = cc ? "showing" : "hidden"; }, [cc, tracks, realSrc]);
  useEffect(() => { if (!menu) return; const off = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(".avm, .avpop")) setMenu(""); }; document.addEventListener("click", off); return () => document.removeEventListener("click", off); }, [menu]);
  const toggle = () => { const el = ref.current; if (!el) return; if (el.paused) el.play().catch(() => {}); else el.pause(); };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => { const el = ref.current; if (!el || !dur) return; const r = e.currentTarget.getBoundingClientRect(); el.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur; };
  const pickLevel = (h: number) => { setLevel(h); setMenu(""); const H = hlsRef.current; if (H) H.currentLevel = h === -1 ? -1 : H.levels.findIndex((l) => l.height === h); };
  const media = kind === "video"
    ? <video ref={ref} key={realSrc || "hls"} playsInline preload="metadata" poster={poster} title={title} controlsList="nodownload" disablePictureInPicture onContextMenu={(e) => e.preventDefault()} autoPlay={autoPlay && !hls} crossOrigin={tracks.length ? undefined : undefined}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} onDurationChange={(e) => setDur(e.currentTarget.duration)} onEnded={onEnded}>
        {realSrc ? <source src={realSrc} /> : null}{tracks.map((tr) => <track key={tr.lang} kind="subtitles" srcLang={tr.lang} label={tr.label} src={tr.url} />)}</video>
    : <audio ref={ref} key={realSrc} preload="metadata" title={title} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} onDurationChange={(e) => setDur(e.currentTarget.duration)} onEnded={onEnded}>
        {realSrc ? <source src={realSrc} /> : null}{tracks.map((tr) => <track key={tr.lang} kind="subtitles" srcLang={tr.lang} label={tr.label} src={tr.url} />)}</audio>;
  const bar = (
    <div className={"avbar" + (big ? " big" : "")}>
      <button type="button" className="avplay" onClick={toggle} aria-label={playing ? "Пауза" : "Воспроизвести"}>{playing ? I.pause : I.play}</button>
      <div className="avprog">
        <div className="avtime"><span className="avtitle">{title}</span><span className="avclock">{fmt(t)}/{fmt(dur)}</span></div>
        <div className="avtrack" onClick={seek}><div className="avfill" style={{ width: dur ? (t / dur) * 100 + "%" : 0 }} /><div className="avknob" style={{ left: dur ? `calc(${(t / dur) * 100}% - 2px)` : 0 }} /></div>
      </div>
      <div className="avbtns">
        <div className="avm"><button type="button" className={"avb txt" + (menu === "speed" ? " on" : "")} onClick={() => setMenu(menu === "speed" ? "" : "speed")}>×{speed}</button>
          {menu === "speed" ? <div className="avpop">{SPEEDS.map((s) => <button type="button" key={s} className={s === speed ? "on" : undefined} onClick={() => { setSpeed(s); setMenu(""); }}>×{s}</button>)}</div> : null}</div>
        <div className="avm">{menu === "vol"
          ? <div className="avvol"><div className="vtrack" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const v = 1 - (e.clientY - r.top) / r.height; setVol(Math.max(0, Math.min(1, v))); setMuted(false); }}><div className="vfill" style={{ height: vol * 100 + "%" }} /><div className="vknob" style={{ bottom: `calc(${vol * 100}% - 2px)` }} /></div><button type="button" className="avb bare" onClick={() => { setMuted((m) => !m); setMenu(""); }}>{muted || vol === 0 ? I.mute : I.sound}</button></div>
          : <button type="button" className="avb" onClick={() => setMenu("vol")} aria-label="Громкость">{muted || vol === 0 ? I.mute : I.sound}</button>}</div>
        {tracks.length ? <button type="button" className={"avb" + (cc ? " on" : "")} onClick={() => setCc((v) => !v)} aria-label="Субтитры">{I.cc}</button> : null}
        {kind === "video" && levels.length ? <div className="avm"><button type="button" className={"avb" + (menu === "q" ? " on" : "")} onClick={() => setMenu(menu === "q" ? "" : "q")} aria-label="Качество">{I.gear}</button>
          {menu === "q" ? <div className="avpop right"><button type="button" className={level === -1 ? "on" : undefined} onClick={() => pickLevel(-1)}>Авто</button>{levels.map((h) => <button type="button" key={h} className={level === h ? "on" : undefined} onClick={() => pickLevel(h)}>{h}p</button>)}</div> : null}</div> : null}
      </div>
    </div>
  );
  return kind === "video" ? <div className="av video"><div className="avframe" onClick={toggle}>{media}</div>{bar}</div> : <div className="av audio">{media}{bar}</div>;
}
