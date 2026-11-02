"use client";
// Плеер видео/аудио — Plyr (MIT). Субтитры WebVTT из медиатеки, оформление через CSS-переменные (см. media.css) —
// когда придёт дизайн, перекрашиваем переменные и иконки, логику не трогаем.
import { useEffect, useRef, useState } from "react";
import "plyr/dist/plyr.css";
import { API } from "@/lib/api";

export type Track = { lang: string; label: string; url: string };
// hls — адрес мастер-плейлиста адаптивного видео (несколько качеств): плеер подбирает качество под сеть и размер экрана,
// в настройках можно выбрать вручную («Авто» / 1080p / 720p…). Без hls (или пока кодирование не закончилось) играет оригинал src.
// mediaId — плеер сам запрашивает подписанную ссылку на оригинал (6 часов) и играет из хранилища напрямую; без неё — src (поток через API)
export default function Player({ kind, src, mediaId, hls, poster, tracks = [], title }: { kind: "video" | "audio"; src: string; mediaId?: string; hls?: string; poster?: string; tracks?: Track[]; title?: string }) {
  const [realSrc, setRealSrc] = useState(src);
  useEffect(() => {
    let alive = true;
    if (!mediaId || hls) { setRealSrc(src); return; }
    fetch(`${API}/media/${mediaId}/original?ttl=21600`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive && j?.url) setRealSrc(String(j.url)); }).catch(() => {});
    return () => { alive = false; };
  }, [mediaId, src, hls]);
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  useEffect(() => {
    let plyr: { destroy: () => void } | null = null;
    let hlsInst: { destroy: () => void } | null = null;
    const el = ref.current; if (!el) return;
    (async () => {
      const { default: Plyr } = await import("plyr");
      let levels: number[] = [];
      let quality: { default: number; options: number[]; forced: boolean; onChange: (q: number) => void } | undefined;
      if (kind === "video" && hls) {
        const { default: Hls } = await import("hls.js");
        if (Hls.isSupported()) {
          // capLevelToPlayerSize — на телефоне не грузим 1080p в окно 360px; старт с уровня по оценке сети
          const h = new Hls({ capLevelToPlayerSize: true, startLevel: -1, maxBufferLength: 30 });
          hlsInst = h;
          await new Promise<void>((res) => { h.on(Hls.Events.MANIFEST_PARSED, () => res()); h.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) res(); }); h.loadSource(hls); h.attachMedia(el); });
          levels = [...new Set(h.levels.map((l) => l.height))].sort((a, b) => b - a);
          if (levels.length) quality = { default: 0, options: [0, ...levels], forced: true, onChange: (q: number) => { h.currentLevel = q === 0 ? -1 : h.levels.findIndex((l) => l.height === q); } };
          else { h.destroy(); hlsInst = null; }
        } else if (el.canPlayType("application/vnd.apple.mpegurl")) { el.src = hls; } // Safari: HLS нативно, качество выбирает сам
      }
      plyr = new Plyr(el, {
        controls: ["play-large", "play", "progress", "current-time", "duration", "mute", "volume", "captions", "settings", "fullscreen"],
        settings: quality ? ["captions", "quality", "speed"] : ["captions", "speed"],
        ...(quality ? { quality } : {}),
        captions: { active: tracks.length > 0, language: tracks[0]?.lang || "ru", update: true },
        i18n: { quality: "Качество", qualityLabel: { 0: "Авто" }, play: "Воспроизвести", pause: "Пауза", mute: "Без звука", unmute: "Включить звук", enterFullscreen: "На весь экран", exitFullscreen: "Выйти из полноэкранного режима", captions: "Субтитры", settings: "Настройки", speed: "Скорость", normal: "Обычная", disabled: "Выключены", enabled: "Включены" },
      });
    })();
    return () => { plyr?.destroy(); hlsInst?.destroy(); };
  }, [realSrc, hls, kind, tracks]);
  const trackEls = tracks.map((t, i) => <track key={t.lang} kind="captions" label={t.label} srcLang={t.lang} src={t.url} default={i === 0} />);
  return kind === "video"
    ? <div className="player video"><video ref={ref} key={realSrc} playsInline controls preload="metadata" poster={poster} title={title} controlsList="nodownload" disablePictureInPicture onContextMenu={(e) => e.preventDefault()}><source src={realSrc} />{trackEls}</video></div>
    : <div className="player audio"><audio ref={ref} key={realSrc} controls preload="metadata" title={title} controlsList="nodownload" onContextMenu={(e) => e.preventDefault()}><source src={realSrc} />{trackEls}</audio></div>;
}
