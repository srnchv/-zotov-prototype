import "./home.css";
import Sidebar from "@/components/Sidebar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";
import HomeScale from "@/components/HomeScale";
import MiniOnScroll from "@/components/MiniOnScroll";
import Gallery from "@/components/Gallery";
import MapCollage, { BUILDINGS } from "@/components/MapCollage";
import SearchPh from "@/components/SearchPh";
import { Lettering, SectionLink } from "@/components/Lettering";
import { loadArchive, ofType, linked, yearOf, imgOf, imgPos, mediaKind, type Entity } from "@/lib/api";
import { getSite } from "@/lib/site";

export const dynamic = "force-dynamic";

const LETTERS = ["a", "r", "h", "i", "v"];
const s = (e: Entity, k: string) => String(e[k] ?? "");
const plural = (n: number, f: [string, string, string]) => { const a = n % 10, b = n % 100; return f[b >= 11 && b <= 14 ? 2 : a === 1 ? 0 : a >= 2 && a <= 4 ? 1 : 2]; };
// пока фото не загружено в архив — заглушки из вёрстки, чтобы сетка держала форму
const ph = (list: string[], i: number) => `/assets/${list[i % list.length]}`;
const PH_TH = ["th1.jpg", "th2.jpg", "th3.jpg", "th4.jpg", "th5.jpg"];
const PH_PR = ["proj-interior.jpg", "proj-mayak.jpg", "proj-kino.jpg"];
const PH_CH = ["ch1910.jpg", "ch1933.jpg", "ch1947.jpg", "ch1960.jpg"];
const PH_P = Array.from({ length: 13 }, (_, i) => `p${i + 1}.jpg`);
const PH_C = ["proj-interior.jpg", "proj-kino.jpg"];


// строки многострочного поля → до N строк макета (переносы строк в админке = строки макета)
const lines = (t: string, n: number) => t.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, n);
// случайный порядок (личности расставляются по фигуре заново при каждой загрузке)
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
// сценарий раскрытия ховера личности: маленькая плитка — вправо, если две ячейки справа свободны, иначе влево;
// большая — вниз, если ряд под ней свободен, иначе вверх (по макетам hover-состояний)
function hoverDir(m: [number, number, number][], i: number, cols: number, rows: number) {
  const occ = new Set<string>();
  m.forEach(([c, r, sz]) => { for (let dc = 0; dc < sz; dc++) for (let dr = 0; dr < sz; dr++) occ.add(`${c + dc},${r + dr}`); });
  const [c, r, sz] = m[i];
  const free = (x: number, y: number) => x >= 1 && x <= cols && y >= 1 && y <= rows && !occ.has(`${x},${y}`);
  if (sz === 1) return free(c + 1, r) && free(c + 2, r) ? "hr" : "hl";
  return free(c, r + 2) && free(c + 1, r + 2) ? "hd" : "hu";
}
// сетки личностей на планшете (6×5, 10 карточек) и мобайле (3×6, 9 карточек): [колонка, ряд, размер] по макету
const CARDS_T: [number, number, number][] = [[1, 1, 1], [6, 1, 1], [2, 2, 1], [3, 1, 2], [1, 3, 1], [3, 3, 1], [6, 3, 1], [2, 4, 1], [4, 4, 2], [3, 5, 1]];
const CARDS_M: [number, number, number][] = [[1, 1, 1], [3, 1, 1], [2, 2, 1], [3, 2, 1], [1, 3, 2], [3, 4, 1], [2, 5, 1], [1, 6, 1], [3, 6, 1]];
const cap = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);
// мозаика личностей: [колонка, ряд, размер] — desktop 12×4, tablet 8×5, mobile 4×8 (из макетов Section 5)
const MOSAIC_D: [number, number, number][] = [[1, 1, 1], [3, 1, 2], [5, 1, 1], [9, 1, 1], [8, 2, 1], [2, 3, 1], [5, 3, 1], [6, 3, 2], [9, 3, 1], [10, 2, 2], [12, 3, 1], [1, 4, 1], [10, 4, 1]];
const MOSAIC_T: [number, number, number][] = [[1, 1, 1], [2, 1, 2], [5, 1, 1], [8, 1, 1], [4, 2, 1], [1, 3, 1], [3, 3, 1], [6, 2, 2], [8, 3, 1], [4, 4, 2], [7, 4, 1], [2, 5, 1], [6, 5, 1]];
const MOSAIC_M: [number, number, number][] = [[1, 1, 1], [2, 1, 2], [4, 2, 1], [1, 3, 1], [3, 3, 1], [2, 4, 1], [3, 4, 2], [1, 5, 1], [2, 6, 1], [3, 6, 1], [1, 7, 2], [4, 7, 1], [3, 8, 1]];

export default async function Home() {
  const [db, site] = await Promise.all([loadArchive(), getSite()]);
  const nMats = (e: Entity) => { const n = linked(db, e, "material").length; return `${n} ${plural(n, ["материал", "материала", "материалов"])}`; };
  const img = (e: Entity, fb: string, big = false) => imgOf(db, e, big) || fb;
  // состав главной — из админки (раздел «Главная страница» / галочки «Показывать на главной»);
  // пока ничего не отмечено — показываем как раньше, чтобы главная не пустела
  const pick = (t: string, key = "onHome") => { const all = ofType(db, t); const sel = all.filter((e) => e[key]); return sel.length ? sel : all; };
  const themes = pick("theme").slice(0, 9);
  let projects = pick("project");
  projects = (projects.some((p) => p.onHome) ? projects : projects.sort((a, b) => yearOf(b.dates) - yearOf(a.dates)).slice(0, 3)).slice(0, 3);
  projects.sort((a, b) => Number(!!b.featured) - Number(!!a.featured)); // фичер — первым, он большая карточка
  const twoBig = projects.length === 2;
  const chrono = ofType(db, "event").filter((e) => e.inChrono).sort((a, b) => yearOf(a.date) - yearOf(b.date) || a.title.localeCompare(b.title, "ru"));
  const pool = shuffle(pick("person"));
  const persons = pool.length ? Array.from({ length: 13 }, (_, i) => pool[i % pool.length]) : [];
  const colls = pick("collection").slice(0, 2);
  const personsT = pool.length ? Array.from({ length: 10 }, (_, i) => pool[i % pool.length]) : [];
  const personsM = pool.length ? Array.from({ length: 9 }, (_, i) => pool[i % pool.length]) : [];
  const mapL = lines(site.mapText, 3), MAP_AL = ["l", "r", "l"];
  // здания коллажа карты → привязанные в админке места (подпись «Название, Город» и переход в раздел «Карта»)
  const mb = (site.mapBuildings || {}) as Record<string, string>;
  const buildings = BUILDINGS.map((b) => { const p = mb[b.key] ? db[mb[b.key]] : undefined; return { key: b.key, placeId: p?.id, title: p ? `${p.title}${p.city ? ", " + p.city : ""}` : b.defTitle }; });
  const heroL = lines(site.heroText, 4), aboutL = lines(site.aboutText, 3);
  const HERO_AL = ["l", "l", "r", "c"], ABOUT_AL = ["l", "r", "c"];

  const card = (e: Entity, cls: string, i: number, fb: string[], meta: string, info?: string) => (
    <a className={"vcard " + cls} key={e.id} href={`/m/${e.id}`}>
      <div className="dv" />
      <div className="tx"><h3>{e.title}</h3>{meta ? <div className="sub">{meta}</div> : null}<div className="vb" />{info ? <div className="inf"><b>{info}</b></div> : null}</div>
      <div className="im"><img src={img(e, ph(fb, i), true)} alt="" style={imgPos(db, e)} /></div>
    </a>
  );

  return (
    <div className="pg">
      <HomeScale />
      <MiniOnScroll />
      <div id="stage"><Sidebar centerUrl={site.centerUrl} /></div>

      <div id="rest" className="home">
        {/* ---- первый экран ---- */}
        <div className="mhead sticky"><MobileMenu centerUrl={site.centerUrl} /></div>
        <section id="hero">
          <div id="word">{LETTERS.map((l) => <img key={l} src={`/assets/letter-${l}.svg`} alt="" />)}</div>
          <div id="lede">{heroL.map((t, i) => <span className={HERO_AL[i]} key={i}>{t}</span>)}</div>
          <div id="lede-m">
            <p>{heroL.slice(0, 2).join(" ")}</p>
            {heroL.length > 2 ? <p className="r">{heroL.slice(2).join(" ")}</p> : null}
          </div>
          <form id="search" action="/search" method="get">
            <label className="lbl" htmlFor="home-q">Поиск по архиву</label>
            <div className="box">
              <input id="home-q" name="q" placeholder={site.searchPh} data-ph-m={site.searchPhM} autoComplete="off" /><SearchPh />
              <button type="submit" aria-label="Найти"><svg className="ic" viewBox="0 0 24 24" fill="none"><circle cx="10.5" cy="10.5" r="6.5" stroke="#262626" strokeWidth="2" /><path d="M15.5 15.5 21 21" stroke="#262626" strokeWidth="2" /></svg></button>
            </div>
          </form>
        </section>

        {/* ---- темы: лента на десктопе и планшете, столбик на мобайле ---- */}
        <section id="themes">
          <div className="hrow">
            {themes.map((t, i) => (
              <a className="theme" key={t.id} href={`/m/${t.id}`}>
                <div className="dv" />
                <div className="row">
                  <div className="tx"><h4>{t.title}</h4><div className="vb" /><div className="cnt">{nMats(t)}</div></div>
                  <div className="im"><img src={img(t, ph(PH_TH, i))} alt="" style={imgPos(db, t)} /></div>
                </div>
              </a>
            ))}
          </div>
          <SectionLink href="/cat/theme" text="Все темы" />
        </section>

        {/* ---- проекты центра: 3 → фичер большой + два средних; 2 → две большие ---- */}
        <section id="projects" className="sec">
          <a href="/cat/project"><Lettering text="проекты центра" /></a>
          <div className={"feat " + (twoBig ? "cgrid" : "pgrid")}>
            {projects.map((p, i) => card(p, twoBig || i === 0 ? "big" : "med", i, PH_PR, s(p, "dates")))}
          </div>
          <SectionLink href="/cat/project" text="Все проекты" />
        </section>

        {/* ---- хронограф: лента по годам по возрастанию; у события — только год и тип ---- */}
        <section id="chrono" className="sec">
          <a href="/chrono"><Lettering text="хронограф" /></a>
          <div className="feat hrow">
            {chrono.map((e, i) => (
              <a className="ditem" key={e.id} href={`/m/${e.id}`}>
                <div className="year">{yearOf(e.date) || s(e, "date")}</div>
                <div className="vcard small">
                  <div className="dv" />
                  <div className="tx"><h3>{e.title}</h3><div className="vb" /><div className="inf"><b>{s(e, "evType") || "Событие"}</b></div></div>
                  <div className="im"><img src={img(e, ph(PH_CH, i), true)} alt="" style={imgPos(db, e)} /></div>
                </div>
              </a>
            ))}
          </div>
          <SectionLink href="/chrono" text="Все события" />
        </section>

        {/* ---- личности: фигура из 13 ячеек, личности в ней — случайно из выбранных в админке; ховер по 4 сценариям ---- */}
        <section id="persons" className="sec">
          <a href="/cat/person"><Lettering text="личности" /></a>
          <div className="feat">
            <div className="mosaic">
              {persons.map((p, i) => {
                const d = MOSAIC_D[i], t = MOSAIC_T[i], m = MOSAIC_M[i];
                const dir = hoverDir(MOSAIC_D, i, 12, 4);
                const sub = cap([s(p, "role"), s(p, "life")].filter(Boolean).join(", "));
                return (
                  <a className={"tile " + dir + (d[2] === 2 ? " big" : "")} key={p.id + i} href={`/m/${p.id}`}
                    style={{ "--dc": d[0], "--dr": d[1], "--ds": d[2], "--tc": t[0], "--tr": t[1], "--mc": m[0], "--mr": m[1], "--ms": m[2] } as React.CSSProperties}>
                    <img src={img(p, ph(PH_P, i), d[2] === 2)} alt={p.title} style={imgPos(db, p)} />
                    <span className="hc"><img src={img(p, ph(PH_P, i))} alt="" style={imgPos(db, p)} /><span className="hct"><b>{p.title}</b>{sub ? <small>{sub}</small> : null}</span></span>
                  </a>
                );
              })}
            </div>
            {/* планшет и мобайл: карточки «имя + фото» по своим сеткам (person-card) */}
            <div className="pcards t">
              {personsT.map((p, i) => { const [c, r, sz] = CARDS_T[i]; return (
                <a className={"pcard" + (sz === 2 ? " big" : "")} key={"t" + i} href={`/m/${p.id}`} style={{ gridColumn: `${c} / span ${sz}`, gridRow: `${r} / span ${sz}` }}>
                  <div className="nm"><div className="dv" />{p.title}</div><div className="im"><img src={img(p, ph(PH_P, i), sz === 2)} alt="" style={imgPos(db, p)} /></div>
                </a>); })}
            </div>
            <div className="pcards m">
              {personsM.map((p, i) => { const [c, r, sz] = CARDS_M[i]; return (
                <a className={"pcard" + (sz === 2 ? " big" : "")} key={"m" + i} href={`/m/${p.id}`} style={{ gridColumn: `${c} / span ${sz}`, gridRow: `${r} / span ${sz}` }}>
                  <div className="nm"><div className="dv" />{p.title}</div><div className="im"><img src={img(p, ph(PH_P, i), sz === 2)} alt="" style={imgPos(db, p)} /></div>
                </a>); })}
            </div>
          </div>
          <SectionLink href="/cat/person" text="Все личности" />
        </section>

        {/* ---- карта: коллаж из зданий (десктоп — слоями с ховером и переходом к месту; планшет/мобайл — иллюстрация) ---- */}
        <section id="map" className="sec">
          <a href="/map"><Lettering text="карта" /></a>
          <div className="lead">{mapL.map((t, i) => <span className={MAP_AL[i]} key={i}>{t}</span>)}</div>
          <MapCollage buildings={buildings} />
          <a className="canvas m" href="/map" aria-label="Карта"><img src={site.mapM || "/assets/map-m.jpg"} alt="" /></a>
          <SectionLink href="/map" text="Смотреть на карте" textM="Все места" />
        </section>

        {/* ---- коллекции: галерея хайлайтов (фото и подпись из привязки «материал в коллекции») ---- */}
        <section id="collections" className="sec">
          <a href="/cat/collection"><Lettering text="коллекции" /></a>
          <div className="feat cgrid">
            {colls.map((c, i) => {
              const items = (c.items || {}) as Record<string, { img?: string; caption?: string; hl?: boolean }>;
              const hl = linked(db, c, "material").filter((m) => items[m.id]?.hl).slice(0, 5);
              const slides: { src: string; title: string; pos?: string }[] = hl.map((m) => {
                const it = items[m.id] || {}; const med = it.img ? db[it.img] : undefined;
                const src = med && med.type === "media" ? String(med.big || med.med || "") : imgOf(db, m, true);
                return { src: src || ph(PH_C, i), title: it.caption || m.title, pos: med?.focus ? String(med.focus) : imgPos(db, m)?.objectPosition as string | undefined };
              });
              if (slides.length < 2) { // хайлайты не настроены — обложки материалов коллекции (до 5), иначе обложка
                const fromMats = linked(db, c, "material").filter((m) => imgOf(db, m, true)).slice(0, 5).map((m) => ({ src: imgOf(db, m, true), title: m.title, pos: imgPos(db, m)?.objectPosition as string | undefined }));
                slides.splice(0, slides.length, ...(fromMats.length >= 2 ? fromMats : [{ src: img(c, ph(PH_C, i), true), title: c.title, pos: imgPos(db, c)?.objectPosition as string | undefined }]));
              }
              return (
                <a className="vcard big coll" key={c.id} href={`/m/${c.id}`}>
                  <div className="dv" />
                  <div className="tx">
                    <h3>{c.title}</h3>
                    {s(c, "desc") ? <div className="sub">{s(c, "desc").split("\n")[0]}</div> : s(c, "period") ? <div className="sub">{s(c, "period")}</div> : null}
                    <div className="vb" />
                    <div className="inf">{s(c, "colType") ? <b>{s(c, "colType")}</b> : null}<span>{nMats(c)}</span></div>
                  </div>
                  <div className="im"><Gallery slides={slides} alt={c.title} /></div>
                </a>
              );
            })}
          </div>
          <SectionLink href="/cat/collection" text="Все коллекции" />
        </section>

        {/* ---- об архиве: фон из админки на высоту экрана, тексты прибиты к низу ---- */}
        <section id="about">
          <img className="bg" src={site.aboutBg || "/assets/about-bg.jpg"} alt="" />
          <div className="shade" />
          <Lettering text="об архиве" cream />
          <div className="lead">{aboutL.map((t, i) => <span className={ABOUT_AL[i]} key={i}>{t}</span>)}</div>
          <div className="lead-m">
            <p>{aboutL[0]}</p>
            {aboutL.length > 1 ? <p className="r">{aboutL.slice(1).join(" ")}</p> : null}
          </div>
          <div className="cols" id="about-cols">
            <div>{site.aboutCol1}</div>
            <div>{site.aboutCol2}</div>
            <div>{site.aboutCol3}</div>
            <div className="last"><span>{site.aboutCol4}</span><span>По вопросам сотрудничества:<br /><a href={`mailto:${site.aboutEmail}`}>{site.aboutEmail}</a></span></div>
          </div>
        </section>

        <Footer site={site} />
      </div>
    </div>
  );
}
