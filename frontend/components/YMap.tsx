"use client";
// Яндекс Карты на публичном сайте: одна точка (страница места) или все места архива (раздел «Карта»).
// Две ветки: JavaScript API 3.0 — векторная карта со стилями дизайнера (lib/map-style.json из «Редактора стилей»),
// включается, когда ключ открыт для 3.0 (конфиг ymapsV3); иначе 2.1 без стилизации (растровые тайлы стили не принимают).
// Ключ приходит с бэкенда (/api/config); маркер — красная точка с подписью в стиле архива, клик ведёт в карточку.
import { useEffect, useRef, useState } from "react";
import STYLE from "@/lib/map-style.json";
export type Pin = { id: string; title: string; lat: number; lon: number; sub?: string };
const loaders: Record<string, Promise<any>> = {};
function loadScript(src: string, ready: () => Promise<any>) {
  if (src in loaders) return loaders[src];
  loaders[src] = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = src;
    s.onload = () => ready().then(res, rej); s.onerror = () => rej(new Error("map"));
    document.head.appendChild(s);
  });
  loaders[src].catch(() => { delete loaders[src]; });
  return loaders[src];
}
const load21 = (key: string) => loadScript(`https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU`, () => new Promise((r) => (window as any).ymaps.ready(() => r((window as any).ymaps))));
const load30 = (key: string) => loadScript(`https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(key)}&lang=ru_RU`, async () => { const y = (window as any).ymaps3; await y.ready; return y; });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
function pinEl(p: Pin, link: boolean) {
  const el = document.createElement(link ? "a" : "div"); el.className = "ypin";
  if (link) (el as HTMLAnchorElement).href = `/m/${p.id}`;
  el.innerHTML = `<i></i><b>${esc(p.title)}</b>`; return el;
}
// focus — id места, на котором карта открывается крупно (переход с коллажа главной: /map?place=…)
export default function YMap({ apiKey, v3, pins, zoom, link = true, className, focus }: { apiKey: string; v3?: boolean; pins: Pin[]; zoom?: number; link?: boolean; className?: string; focus?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!apiKey || !pins.length || !box.current) return;
    let map: any;
    const f = focus ? pins.find((p) => p.id === focus) : undefined;
    const run = v3
      ? load30(apiKey).then((Y) => {
          if (!box.current) return;
          const { YMap: M, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = Y;
          const lons = pins.map((p) => p.lon), lats = pins.map((p) => p.lat);
          const location = f ? { center: [f.lon, f.lat], zoom: 16 }
            : pins.length > 1 ? { bounds: [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]] }
            : { center: [pins[0].lon, pins[0].lat], zoom: zoom || 15 };
          map = new M(box.current, { location, margin: [48, 48, 48, 48], showScaleInCopyrights: false });
          map.addChild(new YMapDefaultSchemeLayer({ customization: STYLE }));
          map.addChild(new YMapDefaultFeaturesLayer({}));
          for (const p of pins) map.addChild(new YMapMarker({ coordinates: [p.lon, p.lat] }, pinEl(p, link)));
        })
      : load21(apiKey).then((Y) => {
          if (!box.current) return;
          map = new Y.Map(box.current, { center: [pins[0].lat, pins[0].lon], zoom: zoom || 15, controls: ["zoomControl"] }, { suppressMapOpenBlock: true, yandexMapDisablePoiInteractivity: true });
          const tag = link ? "a" : "div";
          const layout = Y.templateLayoutFactory.createClass(`<${tag} class="ypin"${link ? ' href="/m/$[properties.id]"' : ""}><i></i><b>$[properties.title]</b></${tag}>`);
          for (const p of pins) map.geoObjects.add(new Y.Placemark([p.lat, p.lon], { id: p.id, title: esc(p.title) }, { iconLayout: layout, iconShape: { type: "Rectangle", coordinates: [[-9, -9], [220, 12]] } }));
          if (f) map.setCenter([f.lat, f.lon], 16);
          else if (pins.length > 1) map.setBounds(map.geoObjects.getBounds(), { checkZoomRange: true, zoomMargin: 48 });
        });
    run.catch(() => setErr("Карта не загрузилась"));
    return () => { try { map?.destroy(); } catch {} };
  }, [apiKey, v3, pins, zoom, link, focus]);
  if (!apiKey) return <div className={"ymap " + (className || "")}><span className="ph">Карта будет доступна после подключения ключа Яндекс Карт</span></div>;
  return <div className={"ymap " + (className || "")} ref={box}>{err ? <span className="ph">{err}</span> : null}</div>;
}
