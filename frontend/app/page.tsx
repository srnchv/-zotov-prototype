import "./home.css";
import Sidebar from "@/components/Sidebar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";
import StageScale from "@/components/StageScale";
import MiniOnScroll from "@/components/MiniOnScroll";
import { loadArchive, ofType, linked, yearOf, imgOf, type Entity } from "@/lib/api";
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
const PH_C = ["coll1.jpg", "coll2.jpg"];

// леттеринг секции (title-section/big): буквы Zotov Bold, разнесены по ширине; пробел — отдельный слот
const Lettering = ({ text, cream }: { text: string; cream?: boolean }) => (
  <div className={"lt" + (cream ? " cream" : "")}>{[...text].map((c, i) => <span key={i} className={c === " " ? "sp" : undefined}>{c}</span>)}</div>
);
// ссылка «Все …» под секцией (section-link): линия сверху 8, текст справа, кружок со стрелкой
const SectionLink = ({ href, text }: { href: string; text: string }) => (
  <a className="slink" href={href}><span>{text}</span><i><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 7.2h9.25L7.54 3.5H9.5L14 8l-4.5 4.5H7.54l3.71-3.7H2V7.2Z" fill="#fff" /></svg></i></a>
);

// мозаика личностей: [колонка, ряд, размер] — desktop 12×4 (132×165) и mobile 4×8 (75×96), из макетов HOME
const MOSAIC_D: [number, number, number][] = [[1, 1, 1], [3, 1, 2], [5, 1, 1], [9, 1, 1], [8, 2, 1], [2, 3, 1], [5, 3, 1], [6, 3, 2], [9, 3, 1], [10, 2, 2], [12, 3, 1], [1, 4, 1], [10, 4, 1]];
const MOSAIC_M: [number, number, number][] = [[1, 1, 1], [2, 1, 2], [4, 2, 1], [1, 3, 1], [3, 3, 1], [2, 4, 1], [3, 4, 2], [1, 5, 1], [2, 6, 1], [3, 6, 1], [1, 7, 2], [4, 7, 1], [3, 8, 1]];

export default async function Home() {
  const [db, site] = await Promise.all([loadArchive(), getSite()]);
  const mats = (e: Entity) => { const n = linked(db, e, "material").length; return `${n} ${plural(n, ["материал", "материала", "материалов"])}`; };
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
      <div className="im"><img src={img(e, ph(fb, i), true)} alt="" /></div>
    </a>
  );

  return (
    <>
      <StageScale shift={180} />
      <MiniOnScroll />
      <div id="stage"><Sidebar centerUrl={site.centerUrl} /></div>

      <div id="restWrap">
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
            <a id="search" href="/search">
              <div className="lbl">Поиск в каталоге</div>
              <div className="box">
                <div className="ph">{site.searchPh}</div>
                <svg className="ic" viewBox="0 0 24 24" fill="none"><circle cx="10.5" cy="10.5" r="6.5" stroke="#262626" strokeWidth="2" /><path d="M15.5 15.5 21 21" stroke="#262626" strokeWidth="2" /></svg>
              </div>
            </a>
          </section>

          {/* ---- темы: горизонтальная лента ---- */}
          <section id="themes">
            <div className="hrow">
              {themes.map((t, i) => (
                <a className="theme" key={t.id} href={`/m/${t.id}`}>
                  <div className="dv" />
                  <div className="row">
                    <div className="tx"><h4>{t.title}</h4><div className="vb" /><div className="cnt">{mats(t)}</div></div>
                    <div className="im"><img src={img(t, ph(PH_TH, i))} alt="" /></div>
                  </div>
                </a>
              ))}
            </div>
            <SectionLink href="/cat/theme" text="Все темы" />
          </section>

          {/* ---- проекты центра ---- */}
          <section id="projects" className="sec">
            <Lettering text="проекты центра" />
            <div className="feat">
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

          {/* ---- личности: мозаика ---- */}
          <section id="persons" className="sec">
            <Lettering text="личности" />
            <div className="feat">
              <div className="mosaic">
                {persons.map((p, i) => {
                  const d = MOSAIC_D[i], m = MOSAIC_M[i];
                  return (
                    <a className={"tile" + (d[2] === 2 ? " big" : "")} key={p.id} href={`/m/${p.id}`} title={p.title}
                      style={{ "--dc": d[0], "--dr": d[1], "--ds": d[2], "--mc": m[0], "--mr": m[1], "--ms": m[2] } as React.CSSProperties}>
                      <img src={img(p, ph(PH_P, i), d[2] === 2)} alt={p.title} />
                    </a>
                  );
                })}
              </div>
            </div>
            <SectionLink href="/cat/person" text="Все личности" />
          </section>

          {/* ---- коллекции ---- */}
          <section id="collections" className="sec">
            <Lettering text="коллекции" />
            <div className="feat">
              {colls.map((c, i) => card(c, "big tall", i, PH_C, s(c, "period")))}
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
              <span className="r">{site.about3}</span>
            </div>
            <div className="lead-m">
              <p>{site.about1}</p>
              <p className="r">{site.about2} {site.about3}</p>
            </div>
            <div className="cols hrow">
              <div>{site.aboutCol1}</div>
              <div>{site.aboutCol2}</div>
              <div>{site.aboutCol3}</div>
              <div className="last"><span>{site.aboutCol4}</span><span>По вопросам сотрудничества:<br /><a href={`mailto:${site.aboutEmail}`}>{site.aboutEmail}</a></span></div>
            </div>
          </section>

          <div id="foot"><Footer site={site} /></div>
        </div>
      </div>
    </>
  );
}
