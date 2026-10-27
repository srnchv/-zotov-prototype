"use client";
// Карта мест по ТЗ DEV «Карта»: Яндекс Карты JavaScript API 3.0 со стилями дизайнера, свои метки-флажки
// (чёрный — утрачено, красный — существует), кластеры кругом с числом, карточка места поверх карты,
// список мест панелью (кроме мобайла) с сортировкой, легенда, кнопка «Открыть список». Открытое место — в адресе (?place=).
// Стандартных контролов Яндекса нет; копирайт убрать по условиям API нельзя.
import { useEffect, useRef, useState, useCallback } from "react";
import STYLE from "@/lib/map-style.json";

export type MPlace = { id: string; title: string; city: string; address: string; type: string; status: "exists" | "lost"; lat: number; lon: number; img?: string; pos?: string };
const RED = "#f43c3a", INK = "#262626";
const SORTS: [string, string][] = [["rel", "по релевантности"], ["az", "по алфавиту (А–Я)"], ["za", "по алфавиту (Я–А)"]];

let loading: Promise<any> | null = null;
function loadV3(key: string) {
  if (loading) return loading;
  loading = new Promise((res, rej) => {
    const sc = document.createElement("script"); sc.src = `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
    sc.onload = async () => { const y = (window as any).ymaps3; await y.ready; res(y); }; sc.onerror = () => rej(new Error("map")); document.head.appendChild(sc);
  });
  loading.catch(() => { loading = null; });
  return loading;
}
// флажок 36×37 из библиотеки (map/signs): чёрное древко, полотнище по статусу
const flagSvg = (c: string) => `<svg width="36" height="37" viewBox="0 0 36 37" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="4" height="37" fill="#262626"/><path d="M6 0L36 12.093L6 26V0Z" fill="${c}"/></svg>`;
const Arrow = <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 7.3h9.6L8 3.7l1-1L14.3 8 9 13.3l-1-1 3.6-3.6H2V7.3Z" fill="currentColor" /></svg>;
const X = <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 2.4 8 6.9l4.5-4.5 1.1 1.1L9.1 8l4.5 4.5-1.1 1.1L8 9.1l-4.5 4.5-1.1-1.1L6.9 8 2.4 3.5l1.1-1.1Z" fill="currentColor" /></svg>;
const Chev = <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.4" fill="none" /></svg>;

export default function MapView({ apiKey, places, initial, sort: sortIn, hasQuery }: { apiKey: string; places: MPlace[]; initial?: string; sort: string; hasQuery: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(initial || null);
  const [list, setList] = useState(false);
  const [sort, setSort] = useState(sortIn);
  const [sortOpen, setSortOpen] = useState(false);
  const cur = places.find((p) => p.id === open) || null;

  // открытое место — в адресе, без перезагрузки
  const setPlace = useCallback((id: string | null) => {
    setOpen(id);
    const u = new URL(location.href); if (id) u.searchParams.set("place", id); else u.searchParams.delete("place");
    history.replaceState(null, "", u.toString());
  }, []);
  const flyTo = useCallback((p: MPlace) => { mapRef.current?.update({ location: { center: [p.lon, p.lat], zoom: Math.max(mapRef.current.zoom || 0, 15), duration: 400 } }); }, []);

  useEffect(() => {
    if (!apiKey || !box.current || !places.length) return;
    let map: any, destroyed = false;
    loadV3(apiKey).then(async (Y) => {
      if (destroyed || !box.current) return;
      const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = Y;
      const { YMapClusterer, clusterByGrid } = await Y.import("@yandex/ymaps3-clusterer@0.0.1");
      const lons = places.map((p) => p.lon), lats = places.map((p) => p.lat);
      const init = initial ? places.find((p) => p.id === initial) : null;
      const location = init ? { center: [init.lon, init.lat], zoom: 15 }
        : places.length > 1 ? { bounds: [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]] } : { center: [places[0].lon, places[0].lat], zoom: 14 };
      map = new YMap(box.current, { location, margin: [60, 60, 60, 60], showScaleInCopyrights: false }, [new YMapDefaultSchemeLayer({ customization: STYLE }), new YMapDefaultFeaturesLayer({})]);
      mapRef.current = map;
      // метка-флажок
      const marker = (f: any) => {
        const p = f.properties as MPlace;
        const el = document.createElement("button"); el.type = "button"; el.className = "mflag " + p.status; el.innerHTML = flagSvg(p.status === "lost" ? INK : RED); el.title = p.title;
        el.onclick = (e) => { e.stopPropagation(); setPlace(p.id); map.update({ location: { center: [p.lon, p.lat], zoom: Math.max(map.zoom, 15), duration: 400 } }); };
        return new YMapMarker({ coordinates: f.geometry.coordinates, source: "pl" }, el);
      };
      // кластер — круг с числом; клик приближает, кластер распадается
      const cluster = (coords: [number, number], feats: any[]) => {
        const el = document.createElement("button"); el.type = "button"; el.className = "mcluster"; el.innerHTML = `<b>${feats.length}</b>`; // круг из библиотеки (map-cluster.svg) — фоном в CSS
        el.onclick = (e) => { e.stopPropagation(); map.update({ location: { center: coords, zoom: map.zoom + 2, duration: 400 } }); };
        return new YMapMarker({ coordinates: coords, source: "pl" }, el);
      };
      const clusterer = new YMapClusterer({ method: clusterByGrid({ gridSize: 64 }), features: places.map((p) => ({ type: "Feature", id: p.id, geometry: { type: "Point", coordinates: [p.lon, p.lat] }, properties: p })), marker, cluster });
      map.addChild(clusterer);
    }).catch(() => setErr("Карта не загрузилась"));
    return () => { destroyed = true; try { map?.destroy(); } catch {} mapRef.current = null; };
  }, [apiKey, places, initial, setPlace]);

  const sorted = [...places].sort((a, b) => { const k = (p: MPlace) => p.title.replace(/^[\s«»"„“”'(\[]+/, ""); return sort === "za" ? k(b).localeCompare(k(a), "ru") : sort === "rel" && hasQuery ? 0 : k(a).localeCompare(k(b), "ru"); });

  if (!apiKey) return <div className="mapbox"><span className="ph">Карта будет доступна после подключения ключа Яндекс Карт</span></div>;
  return (
    <div className="mapbox">
      <div className="mcanvas" ref={box} />
      {err ? <span className="ph">{err}</span> : null}
      {/* легенда: на мобайле выносится над картой стилями */}
      <div className="mlegend"><span><i className="lost" />Утрачено</span><span><i className="exists" />Существует</span></div>
      {!list ? <button type="button" className="mlist-btn" onClick={() => setList(true)}><span>Открыть список</span>{Arrow}</button> : null}
      {list ? (
        <div className="mlist">
          <button type="button" className="mlist-x" aria-label="Закрыть список" onClick={() => setList(false)}>{X}</button>
          <div className="mlist-panel">
            <div className="mlist-sort">
              <span className="g">Сортировать:</span>
              <button type="button" className="v" onClick={() => setSortOpen((v) => !v)}><span>{SORTS.find(([k]) => k === sort)?.[1]}</span>{Chev}</button>
              {sortOpen ? <div className="dd-list">{SORTS.map(([k, l]) => <button type="button" key={k} className={"dd-row" + (k === sort ? " on" : "")} onClick={() => { setSort(k); setSortOpen(false); }}>{l}</button>)}</div> : null}
            </div>
            <div className="mlist-items">
              {sorted.map((p) => <button type="button" key={p.id} className={"mlist-it" + (p.id === open ? " on" : "")} onClick={() => { setPlace(p.id); flyTo(p); }}><b>{p.title}</b><span>{p.city}</span></button>)}
            </div>
          </div>
        </div>
      ) : null}
      {cur ? (
        <div className={"mcard" + (cur.img ? "" : " noimg")}>
          <a className="mcard-in" href={`/m/${cur.id}`}>
            <div className="dv" />
            <div className="tx"><h3>{cur.title}</h3>{cur.address ? <div className="sub">{cur.address}</div> : null}<div className="vb" /><div className="inf"><b>{cur.type || "Место"}</b><span>{cur.status === "lost" ? "Утрачено" : "Существует"}</span></div></div>
            {cur.img ? <div className="im"><img src={cur.img} alt="" style={cur.pos ? { objectPosition: cur.pos } : undefined} /><i className="go">{Arrow}</i></div> : null}
            <span className="mcard-open">Открыть страницу места{Arrow}</span>
          </a>
          <button type="button" className="mcard-x" aria-label="Закрыть" onClick={() => setPlace(null)}>{X}</button>
        </div>
      ) : null}
    </div>
  );
}
