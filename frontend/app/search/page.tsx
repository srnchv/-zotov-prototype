import "./search.css";
import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import SectionTitle from "@/components/SectionTitle";
import Footer from "@/components/Footer";
import StageScale from "@/components/StageScale";
import { loadArchive, ofType, published, searchApi, entityYear, imgOf, TYPES, type Entity } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Поиск — ЗОТОВ. Архив" };

type SP = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<SP> };

const s = (e: Entity, k: string) => String(e[k] ?? "");
const PAGE = 18;
// вкладки по типам — порядок как в макете
const TABS = ["material", "theme", "place", "person", "event", "collection", "project", "org"];
// фильтры-связи: параметр → тип сущности, подпись
const LINK_FILTERS: [string, string, string][] = [["theme", "theme", "Темы"], ["person", "person", "Личности"], ["place", "place", "Места"], ["event", "event", "События"], ["coll", "collection", "Коллекции"]];
const SORTS: Record<string, string> = { rel: "по релевантности", title: "по названию", date: "по дате" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";
const list = (v: string | string[] | undefined) => first(v).split(",").filter(Boolean);

// сборка ссылки с изменённым набором параметров (фильтры — обычные ссылки, всё работает без JS)
function mk(sp: Record<string, string>, patch: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
  p.delete("n");
  const q = p.toString();
  return "/search" + (q ? "?" + q : "");
}
const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]).join(",");

// подпись под карточкой: тип + подтип/категория
const kind = (e: Entity) => {
  const sub = s(e, "mtype") || s(e, "evType") || s(e, "placeType") || s(e, "group") || s(e, "prType") || s(e, "colType") || s(e, "orgType") || s(e, "role");
  return [TYPES[e.type]?.pl || e.type, sub] as const;
};
const yearLabel = (e: Entity) => s(e, "date") || s(e, "dates") || s(e, "life") || s(e, "period") || s(e, "year") || (entityYear(e) ? String(entityYear(e)) : "");

const Plus = <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M7.2 2h1.6v5.2H14v1.6H8.8V14H7.2V8.8H2V7.2h5.2V2Z" fill="#262626" /></svg>;
const X = <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 2.4 8 6.9l4.5-4.5 1.1 1.1L9.1 8l4.5 4.5-1.1 1.1L8 9.1l-4.5 4.5-1.1-1.1L6.9 8 2.4 3.5l1.1-1.1Z" fill="#262626" /></svg>;
const Chev = <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 6l5 5 5-5" stroke="#262626" strokeWidth="1.6" fill="none" /></svg>;

export default async function SearchPage({ searchParams }: Props) {
  const raw = await searchParams;
  const sp: Record<string, string> = {};
  for (const k of ["q", "type", "dec", "theme", "person", "place", "event", "coll", "proj", "sort"]) if (first(raw[k])) sp[k] = first(raw[k]);
  const q = sp.q?.trim() || "";
  const n = Math.max(PAGE, Number(first(raw.n)) || PAGE);
  const sort = SORTS[sp.sort] ? sp.sort : "rel";

  const [db, hits] = await Promise.all([loadArchive(), q ? searchApi(q) : Promise.resolve([])]);
  const okType = (e: Entity) => published(e) && !["media", "tag", "source", "dict"].includes(e.type);

  // база выдачи: серверный поиск по запросу или весь архив
  const snippets: Record<string, string> = {};
  let base: Entity[];
  if (q) {
    base = hits.map((h) => { if (h.snippet) snippets[h.id] = h.snippet; return db[h.id]; }).filter((e) => e && okType(e));
  } else {
    base = Object.values(db).filter(okType).sort((a, b) => a.title.localeCompare(b.title, "ru"));
  }

  // фильтры по связям и периоду
  const decs = list(sp.dec);
  const linkSel: Record<string, string[]> = {};
  for (const [param] of LINK_FILTERS) linkSel[param] = list(sp[param]);
  const passes = (e: Entity) => {
    if (decs.length) { const y = entityYear(e); if (!decs.includes(String(Math.floor(y / 10) * 10))) return false; }
    for (const [param] of LINK_FILTERS) {
      const sel = linkSel[param];
      if (sel.length && !sel.some((id) => id === e.id || (e.links || []).includes(id))) return false;
    }
    if (sp.proj && !(e.links || []).some((id) => db[id]?.type === "project") && e.type !== "project") return false;
    return true;
  };
  const filtered = base.filter(passes);
  const counts: Record<string, number> = {};
  for (const e of filtered) counts[e.type] = (counts[e.type] || 0) + 1;
  let items = sp.type ? filtered.filter((e) => e.type === sp.type) : filtered;
  if (sort === "title") items = [...items].sort((a, b) => a.title.localeCompare(b.title, "ru"));
  if (sort === "date") items = [...items].sort((a, b) => (entityYear(a) || 9999) - (entityYear(b) || 9999));
  const shown = items.slice(0, n);

  // значения для выпадающих списков
  const decades = [...new Set(base.map(entityYear).filter(Boolean).map((y) => Math.floor(y / 10) * 10))].sort((a, b) => a - b);
  const options = (t: string) => ofType(db, t).sort((a, b) => a.title.localeCompare(b.title, "ru"));
  const chipGroups: { label: string; tags: { t: string; href: string }[] }[] = [];
  if (q) chipGroups.push({ label: "Запрос", tags: [{ t: q, href: mk(sp, { q: undefined }) }] });
  if (decs.length) chipGroups.push({ label: "Период:", tags: decs.map((d) => ({ t: `${d}-е`, href: mk(sp, { dec: toggle(decs, d) }) })) });
  for (const [param, , label] of LINK_FILTERS) if (linkSel[param].length)
    chipGroups.push({ label: label + ":", tags: linkSel[param].map((id) => ({ t: db[id]?.title || id, href: mk(sp, { [param]: toggle(linkSel[param], id) }) })) });
  if (sp.proj) chipGroups.push({ label: "Проекты Центра", tags: [{ t: "только связанное", href: mk(sp, { proj: undefined }) }] });
  const hasFilters = chipGroups.length > 0;

  return (
    <>
      <StageScale shift={180} />
      <div id="stage"><Sidebar variant="mat" active="/search" /></div>
      <div id="restWrap">
        <div id="rest" className="srch">
          <div id="srch">
            <SectionTitle text="поиск" bare />

            <div id="sform">
              <form action="/search" method="get">
                {Object.entries(sp).filter(([k]) => k !== "q").map(([k, v]) => <input type="hidden" name={k} value={v} key={k} />)}
                <label htmlFor="q">Поиск в каталоге</label>
                <div className="in">
                  <input id="q" name="q" defaultValue={q} placeholder="Название, личность, место, год" autoComplete="off" />
                  <button type="submit" aria-label="Найти">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="10.5" cy="10.5" r="6.5" stroke="#262626" strokeWidth="2" /><path d="M15.5 15.5 21 21" stroke="#262626" strokeWidth="2" /></svg>
                  </button>
                </div>
              </form>
            </div>

            <div id="fbar">
              <details className="fdd">
                <summary><span className="t"><b>Период</b>{decs.length ? <i>({decs.length})</i> : null}</span>{Plus}</summary>
                <div className="dd">{decades.length ? decades.map((d) => <a key={d} className={decs.includes(String(d)) ? "on" : undefined} href={mk(sp, { dec: toggle(decs, String(d)) })}>{d}-е</a>) : <div className="no">Нет датированных объектов</div>}</div>
              </details>
              {LINK_FILTERS.map(([param, t, label]) => (
                <details className="fdd" key={param}>
                  <summary><span className="t"><b>{label}</b>{linkSel[param].length ? <i>({linkSel[param].length})</i> : null}</span>{Plus}</summary>
                  <div className="dd">{options(t).map((o) => <a key={o.id} className={linkSel[param].includes(o.id) ? "on" : undefined} href={mk(sp, { [param]: toggle(linkSel[param], o.id) })}>{o.title}</a>)}</div>
                </details>
              ))}
              <details className="fdd">
                <summary><span className="t"><b>Дополнительно</b></span>{Plus}</summary>
                <div className="dd">{Object.entries(SORTS).map(([k, v]) => <a key={k} className={sort === k ? "on" : undefined} href={mk(sp, { sort: k })}>Сортировать {v}</a>)}</div>
              </details>
              <div className="fdd tog">
                <a className="sm" href={mk(sp, { proj: sp.proj ? undefined : "1" })}><span className="t"><b>Проекты Центра</b></span><span className={"sw" + (sp.proj ? " on" : "")} /></a>
              </div>
            </div>

            <div id="chips">
              {chipGroups.map((g) => (
                <div className="chg" key={g.label}><span className="l">{g.label}</span><span className="tags">{g.tags.map((t) => <a key={t.href} href={t.href}>{t.t}{X}</a>)}</span></div>
              ))}
              {hasFilters ? <a className="clr" href="/search">Очистить все</a> : null}
            </div>

            <div id="res">
              <h2>{items.length} {plural(items.length)}</h2>
              <div id="tabs">
                <div className="l">
                  <a className={!sp.type ? "on" : undefined} href={mk(sp, { type: undefined })}>Все <i>({filtered.length})</i></a>
                  {TABS.filter((t) => counts[t]).map((t) => <a key={t} className={sp.type === t ? "on" : undefined} href={mk(sp, { type: t })}>{TYPES[t].pl} <i>({counts[t]})</i></a>)}
                </div>
                <div className="r">
                  <div className="sort"><span className="g">Сортировать:</span>
                    <details><summary>{SORTS[sort]}{Chev}</summary>
                      <div className="dd">{Object.entries(SORTS).map(([k, v]) => <a key={k} className={sort === k ? "on" : undefined} href={mk(sp, { sort: k })}>{v}</a>)}</div>
                    </details>
                  </div>
                  <span className="act"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 2h8v9H5V2Zm-2 3h1v9h8v1H3V5Z" stroke="#262626" fill="none" /></svg>Скопировать</span>
                  <span className="act"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M7.2 2h1.6v7l2.6-2.6 1.1 1.1L8 12 3.5 7.5l1.1-1.1 2.6 2.6V2ZM2 13h12v1.5H2V13Z" fill="#262626" /></svg>Скачать</span>
                </div>
              </div>

              {shown.length ? (
                <div id="grid">
                  {shown.map((e) => {
                    const [t, sub] = kind(e);
                    const im = imgOf(db, e);
                    return (
                      <a className="rc" key={e.id} href={`/m/${e.id}`}>
                        <div className="tx">
                          <h3>{e.title}</h3>
                          <div className="y">{yearLabel(e)}</div>
                          <div className="vb" />
                          {snippets[e.id] ? <div className="snip" dangerouslySetInnerHTML={{ __html: snippets[e.id] }} /> : null}
                          <div className="k"><b>{t}</b>{sub ? <span>{sub}</span> : null}</div>
                        </div>
                        <div className={"im" + (e.type === "person" ? " p" : "")}>{im ? <img src={im} alt="" loading="lazy" /> : null}</div>
                      </a>
                    );
                  })}
                </div>
              ) : <div id="empty">{q ? `По запросу «${q}» ничего не найдено. Попробуйте другое написание или снимите фильтры.` : "Ничего не найдено."}</div>}

              {items.length > n ? <div id="more"><a href={mk(sp, {}) + (Object.keys(sp).length ? "&" : "?") + "n=" + (n + PAGE)}>Показать ещё</a></div> : null}
            </div>
            <div id="sfoot"><Footer /></div>
          </div>
        </div>
      </div>
    </>
  );
}

function plural(n: number) {
  const a = n % 10, b = n % 100;
  if (b >= 11 && b <= 14) return "результатов";
  if (a === 1) return "результат";
  if (a >= 2 && a <= 4) return "результата";
  return "результатов";
}
