"use client";
// Яндекс Карты JavaScript API 2.1 на публичном сайте: одна точка (страница места) или все места архива (раздел «Карта»).
// Ключ приходит с бэкенда (/api/config); маркер — красная точка с подписью в стиле архива, клик ведёт в карточку.
import { useEffect, useRef, useState } from "react";
export type Pin = { id: string; title: string; lat: number; lon: number; sub?: string };
let loading: Promise<any> | null = null;
function loadYmaps(key: string) {
  if (loading) return loading;
  loading = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
    s.onload = () => { const y = (window as any).ymaps; y.ready(() => res(y)); };
    s.onerror = () => rej(new Error("map"));
    document.head.appendChild(s);
  });
  loading.catch(() => { loading = null; });
  return loading;
}
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
// focus — id места, на котором карта открывается крупно (переход с коллажа главной: /map?place=…)
export default function YMap({ apiKey, pins, zoom, link = true, className, focus }: { apiKey: string; pins: Pin[]; zoom?: number; link?: boolean; className?: string; focus?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!apiKey || !pins.length || !box.current) return;
    let map: any;
    loadYmaps(apiKey).then((Y) => {
      if (!box.current) return;
      map = new Y.Map(box.current, { center: [pins[0].lat, pins[0].lon], zoom: zoom || 15, controls: ["zoomControl"] }, { suppressMapOpenBlock: true, yandexMapDisablePoiInteractivity: true });
      const tag = link ? "a" : "div";
      const layout = Y.templateLayoutFactory.createClass(`<${tag} class="ypin"${link ? ' href="/m/$[properties.id]"' : ""}><i></i><b>$[properties.title]</b></${tag}>`);
      for (const p of pins) map.geoObjects.add(new Y.Placemark([p.lat, p.lon], { id: p.id, title: esc(p.title) }, { iconLayout: layout, iconShape: { type: "Rectangle", coordinates: [[-9, -9], [220, 12]] } }));
      const f = focus ? pins.find((p) => p.id === focus) : undefined;
      if (f) map.setCenter([f.lat, f.lon], 16);
      else if (pins.length > 1) map.setBounds(map.geoObjects.getBounds(), { checkZoomRange: true, zoomMargin: 48 });
    }).catch(() => setErr("Карта не загрузилась"));
    return () => { try { map?.destroy(); } catch {} };
  }, [apiKey, pins, zoom, link, focus]);
  if (!apiKey) return <div className={"ymap " + (className || "")}><span className="ph">Карта будет доступна после подключения ключа Яндекс Карт</span></div>;
  return <div className={"ymap " + (className || "")} ref={box}>{err ? <span className="ph">{err}</span> : null}</div>;
}
