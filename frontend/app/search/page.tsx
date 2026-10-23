import "./search.css";
import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import MobileMenu from "@/components/MobileMenu";
import { Lettering } from "@/components/Lettering";
import Footer from "@/components/Footer";
import HomeScale from "@/components/HomeScale";
import SoftNav from "@/components/SoftNav";
import SearchFilters, { SelectedChips, type Chip } from "@/components/SearchFilters";
import Dropdown from "@/components/Dropdown";
import SearchPh from "@/components/SearchPh";
import { getSite } from "@/lib/site";
import { loadArchive, imgOf, imgPos, type Entity } from "@/lib/api";
import { buildCats, runSearch, toCard, fmt, resultsWord, CAT_KEYS, KINDS, SORTS, type CatKey } from "@/lib/search";

// Поиск по ТЗ DEV (Figma «Поиск», 50:3709): запрос + 8 категорий фильтров + типология + сортировка + пагинация.
// Всё состояние — в адресе: ?q=…&mat=…&mat=…&type=…&sort=…&page=… (ссылкой можно поделиться, «Назад» работает).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Поиск — ЗОТОВ. Архив" };

type SP = Record<string, string | string[] | undefined>;
const arr = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).flatMap((x) => x.split("|")).filter(Boolean);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

// ссылка с изменёнными параметрами; смена чего угодно, кроме страницы, возвращает на первую страницу
function href(base: Record<string, string[]>, patch: Record<string, string[] | undefined>, keepPage = false) {
  const p = new URLSearchParams();
  const all = { ...base, ...patch };
  for (const [k, vs] of Object.entries(all)) for (const v of vs || []) if (v) p.append(k, v);
  if (!keepPage) p.delete("page");
  const q = p.toString();
  return "/search" + (q ? "?" + q : "");
}
const Arrow = ({ left }: { left?: boolean }) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={left ? { transform: "scaleX(-1)" } : undefined}><path d="M2 7.3h9.6L8 3.7l1-1L14.3 8 9 13.3l-1-1 3.6-3.6H2V7.3Z" fill="currentColor" /></svg>;

// номера страниц: десктоп — окно из 10 + последняя, мобайл — 3 + последняя
function pageList(cur: number, total: number, win: number): (number | "…")[] {
  if (total <= win + 1) return Array.from({ length: total }, (_, i) => i + 1);
  let start = Math.max(1, Math.min(cur - Math.floor(win / 2), total - win));
  const out: (number | "…")[] = [];
  if (start > 1) { out.push(1); if (start > 2) out.push("…"); start = Math.max(start, 2); }
  for (let i = start; i < start + win && i < total; i++) out.push(i);
  if (start + win < total) out.push("…");
  out.push(total);
  return out;
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const raw = await searchParams;
  const [db, site] = await Promise.all([loadArchive(), getSite()]);
  const cats = buildCats(db);
  const sel = Object.fromEntries(CAT_KEYS.map((k) => [k, arr(raw[k])])) as Record<CatKey, string[]>;
  const q = one(raw.q).trim();
  const type = KINDS.some(([k]) => k === one(raw.type)) ? one(raw.type) : "";
  const sortIn = SORTS.some(([k]) => k === one(raw.sort)) ? one(raw.sort) : "";
  const r = runSearch(db, { q, sel, type, sort: sortIn, page: Number(one(raw.page)) || 1 }, cats);

  // текущее состояние для ссылок
  const base: Record<string, string[]> = { ...sel, ...(q ? { q: [q] } : {}), ...(type ? { type: [type] } : {}), ...(sortIn ? { sort: [sortIn] } : {}) };
  const anyFilter = CAT_KEYS.some((k) => sel[k].length);

  // чипсы выбранных значений: по категориям, каждый элемент группы — отдельно
  const chips: Chip[] = [];
  for (const c of cats) {
    const chosen = sel[c.key]; if (!chosen.length) continue;
    const title = new Map(c.groups.flatMap((g) => g.items.map((i) => [i.id, i.title] as const)));
    for (const id of chosen) chips.push({ cat: c.key, catLabel: c.chip, id, title: c.key === "mat" || c.key === "place" || c.key === "event" ? (title.get(id) || id) : title.get(id) || id, href: href(base, { [c.key]: chosen.filter((x) => x !== id) }) });
  }
  const clearAll = href({ ...(q ? { q: [q] } : {}), ...(type ? { type: [type] } : {}), ...(sortIn ? { sort: [sortIn] } : {}) }, {});

  const cards = r.items.map((e) => toCard(db, e, (x: Entity) => imgOf(db, x), (x: Entity) => imgPos(db, x)?.objectPosition as string | undefined));
  const typeItems = [{ label: "все результаты", href: href(base, { type: undefined }), active: !type },
    ...KINDS.map(([k, l]) => ({ label: l, count: `(${fmt(r.counts[k] || 0)})`, href: r.counts[k] ? href(base, { type: [k] }) : undefined, active: type === k }))];
  const sortItems = SORTS.map(([k, l]) => ({ label: l, href: href(base, { sort: [k] }), active: r.sort === k }));
  const pageHref = (n: number) => href(base, { page: n > 1 ? [String(n)] : undefined }, true) + "#results";
  const nav = (win: number, cls: string) => (
    <nav className={"pgn " + cls} aria-label="Страницы">
      {r.page > 1 ? <a className="pg-arr" href={pageHref(r.page - 1)} aria-label="Предыдущая"><Arrow left /></a> : <span className="pg-arr off"><Arrow left /></span>}
      <span className="pg-nums">{pageList(r.page, r.pages, win).map((n, i) => n === "…" ? <span key={"e" + i} className="pg-n gap">…</span> : <a key={n} className={"pg-n" + (n === r.page ? " on" : "")} href={pageHref(n)}>{n}</a>)}</span>
      {r.page < r.pages ? <a className="pg-arr" href={pageHref(r.page + 1)} aria-label="Следующая"><Arrow /></a> : <span className="pg-arr off"><Arrow /></span>}
    </nav>
  );

  return (
    <div className="pg">
      <HomeScale />
      <div id="stage"><Sidebar variant="mat" active="/search" centerUrl={site.centerUrl} /></div>
      <div id="rest" className="srch">
        <div id="srch">
          <SoftNav />
          <div className="mhead"><MobileMenu centerUrl={site.centerUrl} /></div>
          <Lettering text="поиск" />
          <div id="intro">{site.searchIntro}</div>

          <div id="spanel">
            <div id="sform">
              <div className="div8" />
              <form action="/search" method="get">
                {CAT_KEYS.flatMap((k) => sel[k].map((v) => <input type="hidden" name={k} value={v} key={k + v} />))}
                {type ? <input type="hidden" name="type" value={type} /> : null}
                <label htmlFor="home-q">Поиск в архиве</label>
                <div className="in">
                  <input id="home-q" name="q" defaultValue={q} placeholder={site.searchPh} data-ph-m={site.searchPhM} autoComplete="off" /><SearchPh />
                  <button type="submit" aria-label="Найти"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="10.5" cy="10.5" r="6.5" stroke="#262626" strokeWidth="2" /><path d="M15.5 15.5 21 21" stroke="#262626" strokeWidth="2" /></svg></button>
                </div>
              </form>
            </div>
            <SearchFilters cats={cats} sel={sel} />
            {anyFilter ? <SelectedChips chips={chips} clearHref={clearAll} /> : null}
          </div>

          <div id="results">
            {r.total ? (
              <>
                <div id="rhead">
                  <h2>{fmt(r.total)} {resultsWord(r.total)}</h2>
                  <div id="rtools">
                    <Dropdown caption="Типология:" value={type ? KINDS.find(([k]) => k === type)![1] : "все результаты"} items={typeItems} />
                    <Dropdown caption="Сортировка:" value={SORTS.find(([k]) => k === r.sort)![1]} items={sortItems} />
                  </div>
                </div>
                <div id="grid">
                  {cards.map((c) => (
                    <a className="rc" key={c.id} href={`/m/${c.id}`}>
                      <div className="tx">
                        <h3>{c.title}</h3>
                        {c.date ? <div className="y">{c.date}</div> : null}
                        <div className="vb" />
                        <div className="k"><b>{c.type}</b>{c.sub ? <span>{c.sub}</span> : null}</div>
                      </div>
                      {c.img ? <div className="im"><img src={c.img} alt="" loading="lazy" style={c.pos ? { objectPosition: c.pos } : undefined} /></div> : null}
                    </a>
                  ))}
                </div>
                <div className="rend" />
                {r.pages > 1 ? <>{nav(10, "d")}{nav(3, "m")}</> : null}
              </>
            ) : (
              <div id="empty">
                <div className="eimg" aria-hidden="true"><span>?</span></div>
                <h2>ничего не найдено</h2>
                <p>Попробуйте изменить запрос.</p>
              </div>
            )}
          </div>
        </div>
        <Footer site={site} />
      </div>
    </div>
  );
}
