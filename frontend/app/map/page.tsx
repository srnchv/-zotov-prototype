import "./map.css";
import type { Metadata } from "next";
import MobileMenu from "@/components/MobileMenu";
import { Lettering } from "@/components/Lettering";
import Footer from "@/components/Footer";
import SoftNav from "@/components/SoftNav";
import SearchFilters, { SelectedChips, type Chip } from "@/components/SearchFilters";
import EmptyResults from "@/components/EmptyResults";
import MapView, { type MPlace } from "@/components/MapView";
import YMap from "@/components/YMap";
import { getSite } from "@/lib/site";
import { loadArchive, getConfig, imgOf, imgPos, type Entity } from "@/lib/api";
import { fmt, resultsWord } from "@/lib/search";
import { removeOne } from "@/lib/chrono";
import { MKEYS, allPlaces, buildMapCats, runMap, coordsOf, placeStatus, placeType } from "@/lib/map";

// Карта по ТЗ DEV (Figma 123:27632): поиск по названию и адресу, шесть категорий фильтров (общий компонент),
// счётчик, карта с флажками и кластерами, карточка места, список; состояние — в адресе (?q=…&city=…&place=…).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Карта — ЗОТОВ. Архив" };

type SP = Record<string, string | string[] | undefined>;
const s = (e: Entity, k: string) => String(e[k] ?? "");
const arr = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";
function href(base: Record<string, string[]>, patch: Record<string, string[] | undefined>) {
  const p = new URLSearchParams();
  for (const [k, vs] of Object.entries({ ...base, ...patch })) for (const v of vs || []) if (v) p.append(k, v);
  const q = p.toString();
  return "/map" + (q ? "?" + q : "");
}

export default async function MapPage({ searchParams }: { searchParams: Promise<SP> }) {
  const raw = await searchParams;
  const [db, site, cfg] = await Promise.all([loadArchive(), getSite(), getConfig()]);
  const places = allPlaces(db).filter((p) => coordsOf(p));
  const cats = buildMapCats(db, places);
  const tokens = Object.fromEntries(MKEYS.map((k) => [k, arr(raw[k])])) as Record<string, string[]>;
  const q = one(raw.q).trim();
  const sortIn = ["rel", "az", "za"].includes(one(raw.sort)) ? one(raw.sort) : "";
  const { found, sel, sort } = runMap(db, places, cats, tokens, q, sortIn);
  const base: Record<string, string[]> = { ...tokens, ...(q ? { q: [q] } : {}), ...(sortIn ? { sort: [sortIn] } : {}) };
  const anyFilter = MKEYS.some((k) => sel[k].ids.length);
  const chips: Chip[] = [];
  for (const c of cats) {
    const sl = sel[c.key]; if (!sl.ids.length) continue;
    const title = new Map(c.groups.flatMap((g) => g.items.map((i) => [i.id, i.title] as const)));
    for (const id of sl.ids) chips.push({ cat: c.key, catLabel: c.chip, id, title: title.get(id) || id, href: href(base, { [c.key]: removeOne(c, sl.tokens, id) }) });
  }
  const selCount = Object.fromEntries(cats.map((c) => [c.key, sel[c.key].ids]));
  const mplaces: MPlace[] = found.map((p) => { const c = coordsOf(p)!; return { id: p.id, title: p.title, city: s(p, "city"), address: s(p, "address"), type: placeType(p), status: placeStatus(p), lat: c[0], lon: c[1], img: imgOf(db, p, true) || undefined, pos: imgPos(db, p)?.objectPosition as string | undefined }; });
  const place = one(raw.place);

  return (
    <>
      <div id="rest" className="mapp">
        <div id="mapp">
          <SoftNav root="mapp" prefix="/map" />
          <div className="mhead"><MobileMenu centerUrl={site.centerUrl} /></div>
          <Lettering text="карта" />
          <div id="intro">{site.mapIntro}</div>

          <div id="spanel">
            <div id="sform">
              <div className="div8" />
              <form action="/map" method="get">
                {MKEYS.flatMap((k) => tokens[k].map((v) => <input type="hidden" name={k} value={v} key={k + v} />))}
                <label htmlFor="map-q">Поиск по названию</label>
                <div className="in">
                  <input id="map-q" name="q" defaultValue={q} placeholder={site.mapSearchPh} autoComplete="off" />
                  <button type="submit" aria-label="Найти"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="10.5" cy="10.5" r="6.5" stroke="#262626" strokeWidth="2" /><path d="M15.5 15.5 21 21" stroke="#262626" strokeWidth="2" /></svg></button>
                </div>
              </form>
            </div>
            <div id="mfilters"><SearchFilters cats={cats} sel={selCount} prefix="/map" groupTokens /></div>
            {anyFilter ? <SelectedChips chips={chips} clearHref={href({ ...(q ? { q: [q] } : {}) }, {})} /> : null}
          </div>

          {found.length ? (
            <>
              <div id="mcount"><h2>{fmt(found.length)} {resultsWord(found.length)}</h2></div>
              {cfg.ymapsV3
                ? <MapView apiKey={cfg.ymapsKey} places={mplaces} initial={place || undefined} sort={sort} hasQuery={!!q} />
                : <YMap apiKey={cfg.ymapsKey} pins={mplaces.map((p) => ({ id: p.id, title: p.title, lat: p.lat, lon: p.lon }))} className="big" focus={place || undefined} />}
            </>
          ) : <EmptyResults />}
        </div>
        <Footer site={site} />
      </div>
    </>
  );
}
