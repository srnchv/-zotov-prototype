import "./map.css";
import type React from "react";
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
import { abs } from "@/lib/seo";
import { qMap, getConfig } from "@/lib/api";
import { fmt, resultsWord } from "@/lib/search";
import { removeOne } from "@/lib/chrono";
import { MKEYS } from "@/lib/map";

// Карта по ТЗ DEV (Figma 123:27632): поиск по названию и адресу, шесть категорий фильтров (общий компонент),
// счётчик, карта с флажками и кластерами, карточка места, список; состояние — в адресе (?q=…&city=…&place=…).
export const revalidate = 3600; // страница из кэша; сброс — из админки при сохранении (/api/revalidate), страховка — раз в час
// описание — из админки («Описания разделов»), варианты с фильтрами в индекс не идут
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const [sp, site] = await Promise.all([searchParams, getSite()]);
  return { title: "Карта", description: site.catDesc_map || "Конструктивистские адреса на карте: здания, клубы и инженерные сооружения, связанные с героями архива.", alternates: { canonical: abs("/map") }, robots: Object.keys(sp).length ? { index: false, follow: true } : undefined };
}

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";
function href(base: Record<string, string[]>, patch: Record<string, string[] | undefined>) {
  const p = new URLSearchParams();
  for (const [k, vs] of Object.entries({ ...base, ...patch })) for (const v of vs || []) if (v) p.append(k, v);
  const q = p.toString();
  return "/map" + (q ? "?" + q : "");
}

export default async function MapPage({ searchParams }: { searchParams: Promise<SP> }) {
  const raw = await searchParams;
  // места и фильтры считает API на снимке архива (/api/q/map)
  const [r, site, cfg] = await Promise.all([qMap(raw, MKEYS), getSite(), getConfig()]);
  const { cats, tokens, q, sortIn, sort, sel, items: found } = r;
  const base: Record<string, string[]> = { ...tokens, ...(q ? { q: [q] } : {}), ...(sortIn ? { sort: [sortIn] } : {}) };
  const anyFilter = MKEYS.some((k) => sel[k].ids.length);
  const chips: Chip[] = [];
  for (const c of cats) {
    const sl = sel[c.key]; if (!sl.ids.length) continue;
    const title = new Map(c.groups.flatMap((g) => g.items.map((i) => [i.id, i.title] as const)));
    for (const id of sl.ids) chips.push({ cat: c.key, catLabel: c.chip, id, title: title.get(id) || id, href: href(base, { [c.key]: removeOne(c, sl.tokens, id) }) });
  }
  const selCount = Object.fromEntries(cats.map((c) => [c.key, sel[c.key].ids]));
  const mplaces: MPlace[] = found.map((p) => ({ ...p, img: p.img || undefined, pos: p.pos as React.CSSProperties }));
  const place = one(raw.place);

  return (
    <>
      <div id="rest" className="mapp">
        <div id="mapp">
          <SoftNav root="mapp" prefix="/map" />
          <div className="mhead"><MobileMenu centerUrl={site.centerUrl} /></div>
          <Lettering text="карта" h1 />
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
