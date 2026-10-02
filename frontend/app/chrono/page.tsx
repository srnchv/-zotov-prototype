import "./chrono.css";
import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import MobileMenu from "@/components/MobileMenu";
import { Lettering } from "@/components/Lettering";
import Footer from "@/components/Footer";
import HomeScale from "@/components/HomeScale";
import SoftNav from "@/components/SoftNav";
import ChronoClient from "@/components/ChronoClient";
import FilterBar, { type Filter } from "@/components/FilterBar";
import { groupItems } from "@/lib/filters";
import { getSite } from "@/lib/site";
import { loadArchive, ofType, linked, yearOf, imgOf, imgPos, type Entity } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Хронограф — ЗОТОВ. Архив" };

type SP = Record<string, string | string[] | undefined>;
const s = (e: Entity, k: string) => String(e[k] ?? "");
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";
const list = (v: string | string[] | undefined) => first(v).split(",").filter(Boolean);
const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]).join(",");
// фильтры по связям (макет: Период · Тип события · Тема · Место · Личности · Выставки)
const LINK_FILTERS: [string, string, string][] = [["theme", "theme", "Тема"], ["place", "place", "Место"], ["person", "person", "Личности"], ["proj", "project", "Выставки"]];
const PARAMS = ["dec", "ev", "theme", "place", "person", "proj", "y"];

function mk(sp: Record<string, string>, patch: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
  const q = p.toString();
  return "/chrono" + (q ? "?" + q : "");
}
const X = <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 2.4 8 6.9l4.5-4.5 1.1 1.1L9.1 8l4.5 4.5-1.1 1.1L8 9.1l-4.5 4.5-1.1-1.1L6.9 8 2.4 3.5l1.1-1.1Z" fill="#262626" /></svg>;

export default async function ChronoPage({ searchParams }: { searchParams: Promise<SP> }) {
  const raw = await searchParams;
  const sp: Record<string, string> = {};
  for (const k of PARAMS) if (first(raw[k])) sp[k] = first(raw[k]);
  const [db, site] = await Promise.all([loadArchive(), getSite()]);

  const all = ofType(db, "event").filter((e) => yearOf(e.date)).sort((a, b) => yearOf(a.date) - yearOf(b.date) || a.title.localeCompare(b.title, "ru"));
  const decs = list(sp.dec), evs = list(sp.ev);
  const linkSel: Record<string, string[]> = {};
  for (const [param] of LINK_FILTERS) linkSel[param] = list(sp[param]);
  const events = all.filter((e) => {
    const y = yearOf(e.date);
    if (decs.length && !decs.includes(String(Math.floor(y / 10) * 10))) return false;
    if (evs.length && !evs.includes(s(e, "evType"))) return false;
    for (const [param] of LINK_FILTERS) { const sel = linkSel[param]; if (sel.length && !sel.some((id) => (e.links || []).includes(id))) return false; }
    return true;
  });
  const years = [...new Set(events.map((e) => yearOf(e.date)))];
  const allYears = [...new Set(all.map((e) => yearOf(e.date)))];
  const decades = [...new Set(all.map((e) => Math.floor(yearOf(e.date) / 10) * 10))];
  const evTypes = [...new Set(all.map((e) => s(e, "evType")).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
  const options = (t: string) => ofType(db, t).filter((o) => all.some((e) => (e.links || []).includes(o.id))).sort((a, b) => a.title.localeCompare(b.title, "ru"));
  const year = Number(sp.y) || 0;

  // чипы выбранных фильтров
  const chips: { label: string; tags: { t: string; href: string }[] }[] = [];
  if (decs.length) chips.push({ label: "Период", tags: decs.map((d) => ({ t: `${d}-е`, href: mk(sp, { dec: toggle(decs, d) }) })) });
  if (evs.length) chips.push({ label: "Тип события", tags: evs.map((v) => ({ t: v, href: mk(sp, { ev: toggle(evs, v) }) })) });
  for (const [param, , label] of LINK_FILTERS) if (linkSel[param].length) chips.push({ label, tags: linkSel[param].map((id) => ({ t: db[id]?.title || id, href: mk(sp, { [param]: toggle(linkSel[param], id) }) })) });

  const filters: Filter[] = [
    { param: "dec", label: "Период", selected: decs, groups: [{ title: "", items: decades.map((d) => ({ id: String(d), title: `${d}-е` })) }] },
    { param: "ev", label: "Тип события", selected: evs, groups: [{ title: "", items: evTypes.map((v) => ({ id: v, title: v })) }] },
    ...LINK_FILTERS.map(([param, t, label]) => ({ param, label, selected: linkSel[param], groups: groupItems(options(t), t), ph: t === "person" ? "Имя, фамилия" : "Название" })),
  ];

  return (
    <div className="pg">
      <HomeScale />
      <div id="stage"><Sidebar variant="mat" active="/chrono" centerUrl={site.centerUrl} /></div>
      <div id="rest" className="chr">
        <div id="chr">
          <SoftNav root="chr" prefix="/chrono" />
          <ChronoClient />
          <div className="mhead"><MobileMenu centerUrl={site.centerUrl} /></div>
          <Lettering text="хронограф" />
          <div id="intro">{site.chronoIntro}</div>

          {/* панель: чёрная линия → фильтры → лента лет (липкая при скролле) → чипы */}
          <div id="panel">
            <div className="div8" />
            <FilterBar prefix="/chrono" sp={sp} filters={filters} />
          </div>
          <div id="ystrip">
            {allYears.map((y) => <a key={y} data-y={y} className={(year === y ? "on" : "") + (years.includes(y) ? "" : " dim")} href={mk(sp, { y: String(y) })}>{y}</a>)}
          </div>
          {chips.length ? (
            <div id="chips">
              {chips.map((g) => <div className="chg" key={g.label}><span className="l">{g.label}</span><span className="tags">{g.tags.map((t) => <a key={t.href} href={t.href}>{t.t}{X}</a>)}</span></div>)}
              <a className="clr" href={mk({}, { y: sp.y })}>Очистить</a>
            </div>
          ) : null}

          {/* годы: слева год с линией, справа сетка карточек по 276 */}
          <div id="years">
            {years.map((y) => (
              <section className="yblock" key={y} id={"y-" + y}>
                <div className="ylab"><div className="div8" /><div className="yn">{y}</div></div>
                <div className="ygrid">
                  {events.filter((e) => yearOf(e.date) === y).map((e) => {
                    const im = imgOf(db, e);
                    const place = linked(db, e, "place")[0];
                    return (
                      <a className="vcard small ev" key={e.id} href={`/m/${e.id}`}>
                        <div className="dv" />
                        <div className="tx"><h3>{e.title}</h3><div className="sub">{s(e, "date")}</div><div className="vb" /><div className="inf"><b>{s(e, "evType") || "Событие"}</b>{place ? <span>{place.title}</span> : null}</div></div>
                        {im ? <div className="im"><img src={im} alt="" loading="lazy" style={imgPos(db, e)} /></div> : null}
                      </a>
                    );
                  })}
                </div>
              </section>
            ))}
            {!years.length ? <div id="empty">По выбранным фильтрам событий нет.</div> : null}
          </div>
        </div>
        <Footer site={site} />
      </div>
    </div>
  );
}
