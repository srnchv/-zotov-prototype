import "./chrono.css";
import type React from "react";
import type { Metadata } from "next";
import MobileMenu from "@/components/MobileMenu";
import { Lettering } from "@/components/Lettering";
import Footer from "@/components/Footer";
import SoftNav from "@/components/SoftNav";
import ChronoClient from "@/components/ChronoClient";
import SearchFilters, { SelectedChips, type Chip } from "@/components/SearchFilters";
import EmptyResults from "@/components/EmptyResults";
import { getSite } from "@/lib/site";
import { abs } from "@/lib/seo";
import { qChrono } from "@/lib/api";
import { fmt, resultsWord } from "@/lib/search";
import { CKEYS, removeOne } from "@/lib/chrono";

// Хронограф по ТЗ DEV (Figma 450:71516): все события по годам, пять категорий фильтров (общий компонент с поиском),
// таймлайн по диапазону из админки, закрепляется при прокрутке; состояние — в адресе (?person=…&y=1927).
export const revalidate = 3600; // страница из кэша; сброс — из админки при сохранении (/api/revalidate), страховка — раз в час
// описание — из админки («Описания разделов»), варианты с фильтрами в индекс не идут
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const [sp, site] = await Promise.all([searchParams, getSite()]);
  return { title: "Хронограф", description: site.catDesc_chrono || "История конструктивизма и Центра «Зотов» на шкале времени: события, выставки, премьеры и публикации по годам.", alternates: { canonical: abs("/chrono") }, robots: Object.keys(sp).length ? { index: false, follow: true } : undefined };
}

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";
function href(base: Record<string, string[]>, patch: Record<string, string[] | undefined>) {
  const p = new URLSearchParams();
  for (const [k, vs] of Object.entries({ ...base, ...patch })) for (const v of vs || []) if (v) p.append(k, v);
  const q = p.toString();
  return "/chrono" + (q ? "?" + q : "");
}

export default async function ChronoPage({ searchParams }: { searchParams: Promise<SP> }) {
  const raw = await searchParams;
  // события и фильтры считает API на снимке архива (/api/q/chrono)
  const [r, site] = await Promise.all([qChrono(raw, CKEYS), getSite()]);
  const { cats, tokens, sel, from, to, items: found } = r;
  const yearsAll = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const hasAny = new Set(r.hasAny), hasFound = new Set(r.hasFound);
  const years = yearsAll.filter((y) => hasFound.has(y));
  const nByYear = new Map<number, number>(); for (const it of found) nByYear.set(it.year, (nByYear.get(it.year) || 0) + 1); // счётчик событий года с учётом фильтров — под выбранным годом
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
          <Lettering text="хронограф" h1 />
          <div id="intro">{site.chronoIntro}</div>

          {/* панель: чёрная линия → фильтры → таймлайн (закрепляется) → выбранные фильтры */}
          {/* панель: чёрная линия → фильтры; таймлайн — отдельным блоком, чтобы закрепляться на всю длину страницы; ниже чипсы и серая линия */}
          <div id="cpanel">
            <div className="div8" />
            <div id="cfilters"><SearchFilters cats={cats} sel={selCount} prefix="/chrono" groupTokens /></div>
          </div>
          <div id="tline" className={years.length ? undefined : "all-dim"}>
            <div className="tl-row">
              {yearsAll.map((y) => {
                const ok = anyFilter ? hasFound.has(y) : hasAny.has(y);
                return ok ? <a key={y} data-y={y} className={yearSel === y ? "on" : undefined} href={href(tokens, { y: [String(y)] }) + "#y-" + y}><b>{y}</b><i>({nByYear.get(y) || 0})</i></a> : <span key={y} className="dim">{y}</span>;
              })}
            </div>
          </div>
          <div id="cbelow">{anyFilter ? <SelectedChips chips={chips} clearHref="/chrono" /> : null}</div>

          {found.length ? (
            <>
              <div id="ccount"><h2>{fmt(found.length)} {resultsWord(found.length)}</h2></div>
              <div id="years">
                {years.map((y) => (
                  <section className="yblock" key={y} id={"y-" + y}>
                    <div className="ylab"><div className="div8" /><div className="yn">{y}</div></div>
                    <div className="ygrid">
                      {found.filter((e) => e.year === y).map((e) => (
                        <a className="vcard small ev" key={e.id} href={`/m/${e.id}`}>
                          <div className="dv" />
                          <div className="tx"><h3>{e.title}</h3><div className="vb" /><div className="inf"><b>Событие</b>{e.sub ? <span>{e.sub}</span> : null}</div></div>
                          {e.img ? <div className="im"><img src={e.img} alt="" loading="lazy" style={e.pos as React.CSSProperties} /></div> : null}
                        </a>
                      ))}
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
