"use client";
// Яндекс Карты JavaScript API 3.0 на публичном сайте: одна точка (страница места) или все места архива (раздел «Карта»).
// Ключ приходит с бэкенда (/api/config); маркер — красная точка с подписью, клик ведёт в карточку.
import { useEffect, useRef, useState } from "react";
export type Pin = { id: string; title: string; lat: number; lon: number; sub?: string };
let loading: Promise<any> | null = null;
function loadYmaps(key: string) {
  if (loading) return loading;
  loading = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
    s.onload = async () => { const y = (window as any).ymaps3; await y.ready; res(y); };
    s.onerror = () => rej(new Error("map"));
    document.head.appendChild(s);
  });
  loading.catch(() => { loading = null; });
  return loading;
}
export default function YMap({ apiKey, pins, zoom, link = true, className }: { apiKey: string; pins: Pin[]; zoom?: number; link?: boolean; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!apiKey || !pins.length || !box.current) return;
    let map: any;
    loadYmaps(apiKey).then((Y) => {
      if (!box.current) return;
      const lons = pins.map((p) => p.lon), lats = pins.map((p) => p.lat);
      const center = [(Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
      map = new Y.YMap(box.current, { location: pins.length > 1 ? { bounds: [[Math.min(...lons) - 0.01, Math.min(...lats) - 0.01], [Math.max(...lons) + 0.01, Math.max(...lats) + 0.01]] } : { center, zoom: zoom || 15 } });
      map.addChild(new Y.YMapDefaultSchemeLayer({ theme: "light" }));
      map.addChild(new Y.YMapDefaultFeaturesLayer({}));
      for (const p of pins) {
        const el = document.createElement(link ? "a" : "div");
        el.className = "ypin";
        el.innerHTML = `<i></i><b>${p.title.replace(/</g, "&lt;")}</b>`;
        if (link) { (el as HTMLAnchorElement).href = `/m/${p.id}`; el.title = p.title; }
        map.addChild(new Y.YMapMarker({ coordinates: [p.lon, p.lat] }, el));
      }
    }).catch(() => setErr("Карта не загрузилась"));
    return () => { try { map?.destroy(); } catch {} };
  }, [apiKey, pins, zoom, link]);
  if (!apiKey) return <div className={"ymap " + (className || "")}><span className="ph">Карта будет доступна после подключения ключа Яндекс Карт</span></div>;
  return <div className={"ymap " + (className || "")} ref={box}>{err ? <span className="ph">{err}</span> : null}</div>;
}
