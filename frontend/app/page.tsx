import "./home.css";
import Sidebar from "@/components/Sidebar";
import SectionTitle from "@/components/SectionTitle";
import Footer from "@/components/Footer";
import HomeChoreo from "@/components/HomeChoreo";
import { loadArchive, ofType, linked, yearOf, type Entity } from "@/lib/api";

export const dynamic = "force-dynamic";

const LETTERS = ["a", "r", "h", "i", "v"];
const s = (e: Entity, k: string) => String(e[k] ?? "");
const cnt = (e: Entity) => `(${(e.links || []).length} связей)`;
// пока фото не загружено в архив — заглушки из вёрстки, чтобы сетка держала форму
const ph = (list: string[], i: number) => `/assets/${list[i % list.length]}`;
const PH_TH = ["th1.jpg", "th2.jpg", "th3.jpg", "th4.jpg", "th5.jpg"];
const PH_PR = ["proj-interior.jpg", "proj-mayak.jpg", "proj-kino.jpg"];
const PH_CH = ["ch1910.jpg", "ch1933.jpg", "ch1947.jpg", "ch1960.jpg"];
const PH_P = Array.from({ length: 13 }, (_, i) => `p${i + 1}.jpg`);
const PH_C = ["coll1.jpg", "coll2.jpg"];
const img = (e: Entity, fb: string, big = false) => String((big ? e.imgBig : e.img) || e.img || fb);

// мозаика личностей — раскладка из вёрстки (12 колонок × 4 ряда)
const MOSAIC = [[3, 2, 1, 2], [5, 1, 1, 1], [9, 1, 1, 1], [1, 1, 2, 1], [8, 1, 2, 1], [10, 2, 2, 2], [2, 1, 3, 1], [5, 1, 3, 1], [6, 2, 3, 2], [9, 1, 3, 1], [12, 1, 3, 1], [1, 1, 4, 1], [10, 1, 4, 1]];

export default async function Home() {
  const db = await loadArchive();
  const themes = ofType(db, "theme");
  const projects = ofType(db, "project").sort((a, b) => yearOf(b.dates) - yearOf(a.dates)).slice(0, 3);
  const chrono = ofType(db, "event").filter((e) => e.inChrono).sort((a, b) => yearOf(a.date) - yearOf(b.date)).slice(0, 6);
  const persons = ofType(db, "person").slice(0, 13);
  const colls = ofType(db, "collection").slice(0, 2);
  const themesRow = [...themes, ...themes].slice(0, 6);
  const projClass = ["p-big", "p-mid", "p-tall"];

  return (
    <>
      <HomeChoreo />
      <div id="stage">
        <Sidebar active="/" />
        <section id="hero">
          <div id="word">{LETTERS.map((l) => <img key={l} src={`/assets/letter-${l}.svg`} alt="" />)}</div>
          <div id="barcode"><img src="/assets/union.svg" alt="" /></div>
          <p id="lede">Уникальный архив о&nbsp;конструктивизме, медиа и&nbsp;городской истории: материалы, личности, события, места и&nbsp;проекты, объединённые в&nbsp;единую систему связей</p>
          <a id="search" href="/search">
            <div className="box" />
            <div className="ph">Поиск в архиве: события, люди, места и т.д.</div>
            <svg className="ic" viewBox="0 0 24 24" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M11 2a9 9 0 1 1-5.6 16.05l-3.28 3.27-1.44-1.44 3.27-3.28A9 9 0 0 1 11 2Zm0 2.3a6.7 6.7 0 1 0 0 13.4 6.7 6.7 0 0 0 0-13.4Z" fill="#262626" /></svg>
          </a>
          <div id="themes">
            <div className="t-title" />
            <div className="row">
              {themesRow.map((t, i) => (
                <a className="theme" key={t.id + i} href={`/m/${t.id}`}>
                  <div className="tx"><h4>{t.title}</h4><div className="cnt">{cnt(t)}</div></div>
                  <div className="im"><img src={img(t, ph(PH_TH, i))} alt="" /></div>
                </a>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div id="scrollspace" />

      <div id="restWrap">
        <div id="rest" className="home">
          <section id="projects">
            <SectionTitle text="проекты центра" href="/cat/project" />
            <div className="grid">
              {projects.map((p, i) => (
                <a className={"project " + projClass[i]} key={p.id} href={`/m/${p.id}`}>
                  <div className="topline" />
                  <div className="text">
                    <div className="type">{s(p, "prType") || "выставка"}</div>
                    <h3>{p.title}</h3>
                    <div className="dates">{s(p, "dates")}</div>
                    <div className="desc">{s(p, "desc") || `Кураторы: ${s(p, "curators") || "—"}`}</div>
                  </div>
                  <div className="vline" />
                  <div className="cnt">{cnt(p)}</div>
                  <div className="im"><img src={img(p, ph(PH_PR, i), true)} alt="" /></div>
                </a>
              ))}
            </div>
          </section>

          <section id="chrono">
            <SectionTitle text="хронограф" href="/chrono" />
            <div className="grid">
              {chrono.map((e, i) => (
                <a className="ch-item" key={e.id} href={`/m/${e.id}`}>
                  <div className="rule" />
                  <div className="year">{yearOf(e.date) || s(e, "date")}</div>
                  <div className="d">{e.title}</div>
                  <div className="bar" style={{ height: [204, 80, 80, 220, 112, 80][i] }} />
                  <div className="cnt">{cnt(e)}</div>
                  {(e.img || i % 3 !== 1) && <div className="im"><img src={img(e, ph(PH_CH, i))} alt="" /></div>}
                </a>
              ))}
            </div>
          </section>

          <section id="persons">
            <SectionTitle text="личности" href="/cat/person" />
            <div className="mosaic">
              {MOSAIC.map(([c, cs, r, rs], i) => {
                const p = persons[i % Math.max(persons.length, 1)];
                return (
                  <a className="mtile" key={i} href={p ? `/m/${p.id}` : "/cat/person"} title={p?.title}
                     style={{ gridColumn: `${c}/span ${cs}`, gridRow: `${r}/span ${rs}` }}>
                    <img src={p ? img(p, ph(PH_P, i)) : ph(PH_P, i)} alt={p?.title || ""} />
                  </a>
                );
              })}
            </div>
          </section>

          <section id="colls">
            <SectionTitle text="коллекции" href="/cat/collection" />
            <div className="row">
              {colls.map((c, i) => (
                <a className="coll" key={c.id} href={`/m/${c.id}`}>
                  <div className="topline" />
                  <div className="text">
                    <div className="type">{s(c, "colType")}</div>
                    <h3>{c.title}</h3>
                    <div className="desc">{s(c, "desc") || `${s(c, "period")} · ${linked(db, c, "material").length} материалов`}</div>
                  </div>
                  <div className="vline" />
                  <div className="cnt">{cnt(c)}</div>
                  <div className="im">
                    <img src={img(c, ph(PH_C, i), true)} alt="" />
                    <div className="slider">
                      {(Array.isArray(c.sub) ? (c.sub as string[]) : []).slice(0, 5).map((t, j) => <div className="s" key={j}>{j + 1}{j === 0 && <>&nbsp;&nbsp;{t}</>}</div>)}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>

          <a id="mapb" href="/map"><img src="/assets/map-banner.png" alt="Карта" /></a>

          <section id="about">
            <SectionTitle text="об архиве" />
            <div className="lead">Зотов. Архив объединит материалы и исследования, посвящённые эпохе 1920–1930-х гг. в России</div>
            <div className="cols">
              <div>Зотов. Архив объединит материалы и исследования, посвящённые эпохе 1920–1930-х гг. в России. Здесь начинается систематизация и каталогизация данных, распределённых по разным городам, организациям и изданиям.</div>
              <div>Главные задачи архива Центра «Зотов»: найти, объединить, систематизировать исторические источники периода развития конструктивизма; ввести в научный оборот ранее неиспользованные источники.</div>
              <div>Цифровой архив — это новый подход к сохранению и популяризации культурного наследия, создание централизованного «адреса» по теме конструктивизма для институций, специалистов и студентов.</div>
              <div>Зотов. Архив приглашает к сотрудничеству исследователей, проекты и институции, цели работы которых связаны с оцифровкой и сохранением наследия конструктивизма.<br /><br />По вопросам сотрудничества: <a href="mailto:archive@centrezotov.ru">archive@centrezotov.ru</a></div>
            </div>
          </section>

          <div id="foot"><Footer /></div>
        </div>
      </div>
    </>
  );
}
