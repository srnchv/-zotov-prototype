"use client";
// Плеер видео/аудио — Plyr (MIT). Субтитры WebVTT из медиатеки, оформление через CSS-переменные (см. media.css) —
// когда придёт дизайн, перекрашиваем переменные и иконки, логику не трогаем.
import { useEffect, useRef } from "react";
import "plyr/dist/plyr.css";

export type Track = { lang: string; label: string; url: string };
export default function Player({ kind, src, poster, tracks = [], title }: { kind: "video" | "audio"; src: string; poster?: string; tracks?: Track[]; title?: string }) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  useEffect(() => {
    let plyr: { destroy: () => void } | null = null;
    import("plyr").then(({ default: Plyr }) => {
      if (!ref.current) return;
      plyr = new Plyr(ref.current, {
        controls: ["play-large", "play", "progress", "current-time", "duration", "mute", "volume", "captions", "settings", "fullscreen"],
        settings: ["captions", "speed"],
        captions: { active: tracks.length > 0, language: tracks[0]?.lang || "ru", update: true },
        i18n: { play: "Воспроизвести", pause: "Пауза", mute: "Без звука", unmute: "Включить звук", enterFullscreen: "На весь экран", exitFullscreen: "Выйти из полноэкранного режима", captions: "Субтитры", settings: "Настройки", speed: "Скорость", normal: "Обычная", disabled: "Выключены", enabled: "Включены" },
      });
    });
    return () => { plyr?.destroy(); };
  }, [src, tracks]);
  const trackEls = tracks.map((t, i) => <track key={t.lang} kind="captions" label={t.label} srcLang={t.lang} src={t.url} default={i === 0} />);
  return kind === "video"
    ? <div className="player"><video ref={ref} playsInline controls preload="metadata" poster={poster} title={title}><source src={src} />{trackEls}</video></div>
    : <div className="player audio"><audio ref={ref} controls preload="metadata" title={title}><source src={src} />{trackEls}</audio></div>;
}
