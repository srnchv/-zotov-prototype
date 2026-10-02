import "./home.css";
import Sidebar from "@/components/Sidebar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";
import HomeScale from "@/components/HomeScale";
import MiniOnScroll from "@/components/MiniOnScroll";
import Gallery from "@/components/Gallery";
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


// мозаика личностей: [колонка, ряд, размер] — desktop 12×4, tablet 8×5, mobile 4×8 (из макетов Section 5)
const MOSAIC_D: [number, number, number][] = [[1, 1, 1], [3, 1, 2], [5, 1, 1], [9, 1, 1], [8, 2, 1], [2, 3, 1], [5, 3, 1], [6, 3, 2], [9, 3, 1], [10, 2, 2], [12, 3, 1], [1, 4, 1], [10, 4, 1]];
const MOSAIC_T: [number, number, number][] = [[1, 1, 1], [2, 1, 2], [5, 1, 1], [8, 1, 1], [4, 2, 1], [1, 3, 1], [3, 3, 1], [6, 2, 2], [8, 3, 1], [4, 4, 2], [7, 4, 1], [2, 5, 1], [6, 5, 1]];
const MOSAIC_M: [number, number, number][] = [[1, 1, 1], [2, 1, 2], [4, 2, 1], [1, 3, 1], [3, 3, 1], [2, 4, 1], [3, 4, 2], [1, 5, 1], [2, 6, 1], [3, 6, 1], [1, 7, 2], [4, 7, 1], [3, 8, 1]];

export default async function Home() {
  const [db, site] = await Promise.all([loadArchive(), getSite()]);
  const nMats = (e: Entity) => { const n = linked(db, e, "material").length; return `${n} ${plural(n, ["материал", "материала", "материалов"])}`; };
  const img = (e: Entity, fb: string, big = false) => imgOf(db, e, big) || fb;
  const themes = ofType(db, "theme");
  const projects = ofType(db, "project").sort((a, b) => yearOf(b.dates) - yearOf(a.dates)).slice(0, 3);
  const chrono = ofType(db, "event").filter((e) => e.inChrono).sort((a, b) => yearOf(a.date) - yearOf(b.date));
  const persons = ofType(db, "person").slice(0, 13);
  const colls = ofType(db, "collection").slice(0, 2);

  const card = (e: Entity, cls: string, i: number, fb: string[], meta: string) => (
    <a className={"vcard " + cls} key={e.id} href={`/m/${e.id}`}>
      <div className="dv" />
      <div className="tx"><h3>{e.title}</h3>{meta ? <div className="sub">{meta}</div> : null}<div className="vb" /></div>
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
        <section id="hero">
          <div className="mhead"><MobileMenu centerUrl={site.centerUrl} /></div>
          <div id="word">{LETTERS.map((l) => <img key={l} src={`/assets/letter-${l}.svg`} alt="" />)}</div>
          <div id="lede">
            <span className="l">{site.hero1}</span>
            <span className="l">{site.hero2}</span>
            <span className="r">{site.hero3}</span>
            <span className="c">{site.hero4}</span>
          </div>
          <div id="lede-m">
            <p>{site.hero1} {site.hero2}</p>
            <p className="r">{site.hero3} {site.hero4}</p>
          </div>
          <form id="search" action="/search" method="get">
            <label className="lbl" htmlFor="home-q">Поиск в каталоге</label>
            <div className="box">
              <input id="home-q" name="q" placeholder={site.searchPh} autoComplete="off" />
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

        {/* ---- проекты центра: сетка 4 колонки (большая 2 + две средние) ---- */}
        <section id="projects" className="sec">
          <Lettering text="проекты центра" />
          <div className="feat pgrid">
            {projects.map((p, i) => card(p, i === 0 ? "big" : "med", i, PH_PR, s(p, "dates")))}
          </div>
          <SectionLink href="/cat/project" text="Все проекты" />
        </section>

        {/* ---- хронограф: горизонтальная лента ---- */}
        <section id="chrono" className="sec">
          <Lettering text="хронограф" />
          <div className="feat hrow">
            {chrono.map((e, i) => (
              <div className="ditem" key={e.id}>
                <div className="year">{yearOf(e.date) || s(e, "date")}</div>
                {card(e, "small", i, PH_CH, s(e, "evType"))}
              </div>
            ))}
          </div>
          <SectionLink href="/chrono" text="Весь хронограф" />
        </section>

        {/* ---- личности: мозаика; на десктопе при наведении — красная карточка с именем и ролью ---- */}
        <section id="persons" className="sec">
          <Lettering text="личности" />
          <div className="feat">
            <div className="mosaic">
              {persons.map((p, i) => {
                const d = MOSAIC_D[i], t = MOSAIC_T[i], m = MOSAIC_M[i];
                const flip = d[0] + d[2] > 10; // у правого края карточка раскрывается влево
                const sub = [s(p, "role"), s(p, "life")].filter(Boolean).join(", ");
                return (
                  <a className={"tile" + (d[2] === 2 ? " big" : "") + (flip ? " fl" : "")} key={p.id} href={`/m/${p.id}`}
                    style={{ "--dc": d[0], "--dr": d[1], "--ds": d[2], "--tc": t[0], "--tr": t[1], "--mc": m[0], "--mr": m[1], "--ms": m[2] } as React.CSSProperties}>
                    <img src={img(p, ph(PH_P, i), d[2] === 2)} alt={p.title} style={imgPos(db, p)} />
                    <span className="hc"><img src={img(p, ph(PH_P, i))} alt="" style={imgPos(db, p)} /><span className="hct"><b>{p.title}</b>{sub ? <small>{sub}</small> : null}</span></span>
                  </a>
                );
              })}
            </div>
          </div>
          <SectionLink href="/cat/person" text="Все личности" />
        </section>

        {/* ---- карта: коллаж из макета, пока раздел карты не собран ---- */}
        <section id="map" className="sec">
          <Lettering text="карта" />
          <a className="canvas" href="/map" aria-label="Карта">
            <picture>
              <source media="(max-width:1023px)" srcSet="/assets/map-m.jpg" />
              <img src="/assets/map-d.jpg" alt="" />
            </picture>
          </a>
          <SectionLink href="/map" text="Вся карта" />
        </section>

        {/* ---- коллекции ---- */}
        <section id="collections" className="sec">
          <Lettering text="коллекции" />
          <div className="feat cgrid">
            {colls.map((c, i) => {
              // листалка: фото, прикреплённые к коллекции в админке (в порядке загрузки), затем обложки её материалов — до 5
              const own = (c.links || []).map((id) => db[id]).filter((m) => m && m.type === "media" && mediaKind(m) === "image" && m.med)
                .map((m) => ({ src: String(m.med), title: c.title, pos: m.focus ? String(m.focus) : undefined }));
              const fromMats = linked(db, c, "material").filter((m) => imgOf(db, m, true))
                .map((m) => ({ src: imgOf(db, m, true), title: m.title, pos: imgPos(db, m)?.objectPosition as string | undefined }));
              const slides: { src: string; title: string; pos?: string }[] = [...own, ...fromMats].slice(0, 5);
              if (!slides.length) slides.push({ src: ph(PH_C, i), title: c.title });
              return (
                <a className="vcard big coll" key={c.id} href={`/m/${c.id}`}>
                  <div className="dv" />
                  <div className="tx">
                    <h3>{c.title}</h3>
                    {s(c, "period") ? <div className="sub">{s(c, "period")}</div> : null}
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

        {/* ---- об архиве ---- */}
        <section id="about">
          <img className="bg" src="/assets/about-bg.jpg" alt="" />
          <div className="shade" />
          <Lettering text="об архиве" cream />
          <div className="lead">
            <span className="l">{site.about1}</span>
            <span className="r">{site.about2}</span>
            <span className="c">{site.about3}</span>
          </div>
          <div className="lead-m">
            <p>{site.about1}</p>
            <p className="r">{site.about2} {site.about3}</p>
          </div>
          <div className="cols">
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
