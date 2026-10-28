import MobileMenu from "@/components/MobileMenu";
import { Lettering } from "@/components/Lettering";
import Footer from "@/components/Footer";
import SoftNav from "@/components/SoftNav";
import SearchFilters, { SelectedChips, type Chip } from "@/components/SearchFilters";
import Dropdown from "@/components/Dropdown";
import SearchPh from "@/components/SearchPh";
import EmptyResults from "@/components/EmptyResults";
import { getSite } from "@/lib/site";
import { loadArchive, imgOf, imgPos, type Entity } from "@/lib/api";
import { buildCats, runSearch, toCard, fmt, resultsWord, unitsWord, authorOrYear, CAT_KEYS, KINDS, SORTS, type CatKey } from "@/lib/search";

// Поиск по ТЗ DEV (Figma «Поиск», 50:3709): запрос + 8 категорий фильтров + типология + сортировка + пагинация.
// Всё состояние — в адресе: ?q=…&mat=…&mat=…&type=…&sort=…&page=… (ссылкой можно поделиться, «Назад» работает).
export type SP = Record<string, string | string[] | undefined>;
const arr = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).flatMap((x) => x.split("|")).filter(Boolean);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

// ссылка с изменёнными параметрами; смена чего угодно, кроме страницы, возвращает на первую страницу
function hrefAt(path: string, base: Record<string, string[]>, patch: Record<string, string[] | undefined>, keepPage = false) {
  const p = new URLSearchParams();
  const all = { ...base, ...patch };
  for (const [k, vs] of Object.entries(all)) for (const v of vs || []) if (v) p.append(k, v);
  if (!keepPage) p.delete("page");
  const q = p.toString();
  return path + (q ? "?" + q : "");
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

// Одна страница на поиск и разделы: у раздела типология зафиксирована (fixed), адрес свой (path).
// section — режим раздела по макетам DEV «Личности»/«Тексты» (550:75129): свой набор фильтров (catKeys), поиск только по названию,
// 36 карточек на страницу, счётчик «единиц», интро и плейсхолдер из админки, без типологии.
export type Section = { catKeys: CatKey[]; intro: string; ph: string; cls: string; cardsOf: "person" | "text" };
export default async function SearchView({ raw, path = "/search", fixed = "", lettering = "поиск", section }: { raw: SP; path?: string; fixed?: string; lettering?: string; section?: Section }) {
  const href = (base: Record<string, string[]>, patch: Record<string, string[] | undefined>, keepPage = false) => hrefAt(path, base, patch, keepPage);
  const [db, site] = await Promise.all([loadArchive(), getSite()]);
  const keys: CatKey[] = section ? section.catKeys : CAT_KEYS;
  const cats = buildCats(db).filter((c) => keys.includes(c.key)).sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key));
  const sel = Object.fromEntries(keys.map((k) => [k, arr(raw[k])])) as Record<CatKey, string[]>;
  sel.per?.sort(); // годы в чипсах по порядку
  const q = one(raw.q).trim();
  const type = fixed || (KINDS.some(([k]) => k === one(raw.type)) ? one(raw.type) : "");
  const sortIn = SORTS.some(([k]) => k === one(raw.sort)) ? one(raw.sort) : "";
  const r = runSearch(db, { q, sel, type, sort: sortIn, page: Number(one(raw.page)) || 1, titleOnly: !!section, perPage: section ? 36 : undefined }, cats);
  const word = section ? unitsWord : resultsWord;

  // текущее состояние для ссылок
  const typeQ: Record<string, string[]> = type && !fixed ? { type: [type] } : {};
  const base: Record<string, string[]> = { ...sel, ...(q ? { q: [q] } : {}), ...typeQ, ...(sortIn ? { sort: [sortIn] } : {}) };
  const anyFilter = keys.some((k) => sel[k].length);

  // чипсы выбранных значений: по категориям, каждый элемент группы — отдельно
  const chips: Chip[] = [];
  for (const c of cats) {
    const chosen = sel[c.key]; if (!chosen.length) continue;
    const title = new Map(c.groups.flatMap((g) => g.items.map((i) => [i.id, i.title] as const)));
    for (const id of chosen) chips.push({ cat: c.key, catLabel: c.chip, id, title: title.get(id) || id, href: href(base, { [c.key]: chosen.filter((x) => x !== id) }) });
  }
  const clearAll = href({ ...(q ? { q: [q] } : {}), ...typeQ, ...(sortIn ? { sort: [sortIn] } : {}) }, {});

  // карточка текста в разделе «Тексты»: под названием автор, если его нет — год (макет)
  const cards = r.items.map((e) => { const c = toCard(db, e, (x: Entity) => imgOf(db, x), (x: Entity) => imgPos(db, x)); return section?.cardsOf === "text" ? { ...c, date: authorOrYear(e) } : c; });
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
    <>
      <div id="rest" className={"srch" + (section ? " sec " + section.cls : "")}>
        <div id="srch">
          <SoftNav prefix={path} />
          <div className="mhead"><MobileMenu centerUrl={site.centerUrl} /></div>
          <Lettering text={lettering} h1 />
          <div id="intro">{section ? section.intro : site.searchIntro}</div>

          <div id="spanel">
            <div id="sform">
              <div className="div8" />
              <form action={path} method="get">
                {keys.flatMap((k) => sel[k].map((v) => <input type="hidden" name={k} value={v} key={k + v} />))}
                {type && !fixed ? <input type="hidden" name="type" value={type} /> : null}
                <label htmlFor="home-q">Поиск в архиве</label>
                <div className="in">
                  <input id="home-q" name="q" defaultValue={q} placeholder={section ? section.ph : site.searchPh} data-ph-m={section ? section.ph : site.searchPhM} autoComplete="off" /><SearchPh />
                  <button type="submit" aria-label="Найти"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="10.5" cy="10.5" r="6.5" stroke="#262626" strokeWidth="2" /><path d="M15.5 15.5 21 21" stroke="#262626" strokeWidth="2" /></svg></button>
                </div>
              </form>
            </div>
            <SearchFilters cats={cats} sel={sel} prefix={path} />
            {anyFilter ? <SelectedChips chips={chips} clearHref={clearAll} /> : null}
          </div>

          <div id="results">
            {r.total ? (
              <>
                <div id="rhead">
                  <h2>{fmt(r.total)} {word(r.total)}</h2>
                  <div id="rtools">
                    {fixed ? null : <Dropdown caption="Типология:" value={type ? KINDS.find(([k]) => k === type)![1] : "все результаты"} items={typeItems} />}
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
                        {section?.cardsOf === "person" ? null : section?.cardsOf === "text" ? (c.sub ? <div className="k"><b>{c.sub}</b></div> : null) : <div className="k"><b>{c.type}</b>{c.sub ? <span>{c.sub}</span> : null}</div>}
                      </div>
                      {c.img ? <div className="im"><img src={c.img} alt="" loading="lazy" style={c.pos} /></div> : null}
                    </a>
                  ))}
                </div>
                <div className="rend" />
                {r.pages > 1 ? <>{nav(10, "d")}{nav(3, "m")}</> : null}
              </>
            ) : <EmptyResults />}
          </div>
        </div>
        <Footer site={site} />
      </div>
    </>
  );
}
