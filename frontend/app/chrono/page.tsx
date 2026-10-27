import "./chrono.css";
import type { Metadata } from "next";
import MobileMenu from "@/components/MobileMenu";
import { Lettering } from "@/components/Lettering";
import Footer from "@/components/Footer";
import SoftNav from "@/components/SoftNav";
import ChronoClient from "@/components/ChronoClient";
import SearchFilters, { SelectedChips, type Chip } from "@/components/SearchFilters";
import EmptyResults from "@/components/EmptyResults";
import { getSite } from "@/lib/site";
import { loadArchive, imgOf, imgPos, type Entity } from "@/lib/api";
import { fmt, resultsWord } from "@/lib/search";
import { CKEYS, allEvents, buildChronoCats, chronoRange, decodeSel, removeOne, makeChronoMatch, eventDate, sortInYear, type Sel } from "@/lib/chrono";

// Хронограф по ТЗ DEV (Figma 450:71516): все события по годам, пять категорий фильтров (общий компонент с поиском),
// таймлайн по диапазону из админки, закрепляется при прокрутке; состояние — в адресе (?person=…&y=1927).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Хронограф — ЗОТОВ. Архив" };

type SP = Record<string, string | string[] | undefined>;
const s = (e: Entity, k: string) => String(e[k] ?? "");
const arr = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";
function href(base: Record<string, string[]>, patch: Record<string, string[] | undefined>) {
  const p = new URLSearchParams();
  for (const [k, vs] of Object.entries({ ...base, ...patch })) for (const v of vs || []) if (v) p.append(k, v);
  const q = p.toString();
  return "/chrono" + (q ? "?" + q : "");
}

export default async function ChronoPage({ searchParams }: { searchParams: Promise<SP> }) {
  const raw = await searchParams;
  const [db, site] = await Promise.all([loadArchive(), getSite()]);
  const events = allEvents(db);
  const cats = buildChronoCats(db, events);
  const tokens = Object.fromEntries(CKEYS.map((k) => [k, arr(raw[k])])) as Record<string, string[]>;
  const sel = Object.fromEntries(cats.map((c) => [c.key, decodeSel(c, tokens[c.key] || [])])) as Record<string, Sel>;
  const match = makeChronoMatch(db, cats, sel);
  const found = events.filter((e) => eventDate(e).y && match(e));
  const [from, to] = chronoRange(db, events);
  const yearsAll = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const hasAny = new Set(events.map((e) => eventDate(e).y)), hasFound = new Set(found.map((e) => eventDate(e).y));
  const years = yearsAll.filter((y) => hasFound.has(y));
  const yearSel = Number(one(raw.y)) || 0;
  const anyFilter = CKEYS.some((k) => sel[k].ids.length);
  // чипсы: каждый выбранный элемент отдельно; снятие элемента из группы оставляет остальных по «ИЛИ»
  const chips: Chip[] = [];
  for (const c of cats) {
    const sl = sel[c.key]; if (!sl.ids.length) continue;
    const title = new Map(c.groups.flatMap((g) => g.items.map((i) => [i.id, i.title] as const)));
    for (const id of sl.ids) chips.push({ cat: c.key, catLabel: c.chip, id, title: title.get(id) || id, href: href(tokens, { [c.key]: removeOne(c, sl.tokens, id), y: undefined }) });
  }
  // количество элементов в кнопке категории — выбранные элементы
  const selCount = Object.fromEntries(cats.map((c) => [c.key, sel[c.key].ids.map((id) => id)]));

  return (
    <>
      <div id="rest" className="chr">
        <div id="chr">
          <SoftNav root="chr" prefix="/chrono" />
          <ChronoClient />
          <div className="mhead"><MobileMenu centerUrl={site.centerUrl} /></div>
          <Lettering text="хронограф" />
          <div id="intro">{site.chronoIntro}</div>

          {/* панель: чёрная линия → фильтры → таймлайн (закрепляется) → выбранные фильтры */}
          <div id="cpanel">
            <div className="div8" />
            <div id="cfilters"><SearchFilters cats={cats} sel={selCount} prefix="/chrono" groupTokens /></div>
            <div id="tline" className={years.length ? undefined : "all-dim"}>
              <div className="tl-row">
                {yearsAll.map((y) => {
                  const ok = anyFilter ? hasFound.has(y) : hasAny.has(y);
                  return ok ? <a key={y} data-y={y} className={yearSel === y ? "on" : undefined} href={href(tokens, { y: [String(y)] }) + "#y-" + y}>{y}</a> : <span key={y} className="dim">{y}</span>;
                })}
              </div>
            </div>
            {anyFilter ? <SelectedChips chips={chips} clearHref="/chrono" /> : null}
          </div>

          {found.length ? (
            <>
              <div id="ccount"><h2>{fmt(found.length)} {resultsWord(found.length)}</h2></div>
              <div id="years">
                {years.map((y) => (
                  <section className="yblock" key={y} id={"y-" + y}>
                    <div className="ylab"><div className="div8" /><div className="yn">{y}</div></div>
                    <div className="ygrid">
                      {found.filter((e) => eventDate(e).y === y).sort(sortInYear).map((e) => {
                        const im = imgOf(db, e);
                        return (
                          <a className="vcard small ev" key={e.id} href={`/m/${e.id}`}>
                            <div className="dv" />
                            <div className="tx"><h3>{e.title}</h3><div className="vb" /><div className="inf"><b>Событие</b>{(() => { const t = s(e, "subtype") || s(e, "evType"); return t && t !== "Событие" ? <span>{t}</span> : null; })()}</div></div>
                            {im ? <div className="im"><img src={im} alt="" loading="lazy" style={imgPos(db, e)} /></div> : null}
                          </a>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
              <div className="rend" />
            </>
          ) : <EmptyResults />}
        </div>
        <Footer site={site} />
      </div>
    </>
  );
}
