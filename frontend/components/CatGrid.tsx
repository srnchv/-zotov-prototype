import MobileMenu from "@/components/MobileMenu";
import { Lettering } from "@/components/Lettering";
import Footer from "@/components/Footer";
import { getSite } from "@/lib/site";
import { loadArchive, ofType, linked, imgOf, imgPos, type Entity } from "@/lib/api";
import { fmt } from "@/lib/search";

// Разделы-витрины без поиска и фильтров по макетам DEV: «Коллекции» (612:54229) — 2 колонки, карточка с типом и «N экспонатов», картинка 3:2;
// «Темы» (612:50434) — 4/3/2/1 колонки, карточка с «N материалов», картинка квадрат. Полоса сверху, название капсом, вертикальная линия.
const plural = (n: number, f: [string, string, string]) => { const a = n % 10, b = n % 100; return f[b >= 11 && b <= 14 ? 2 : a === 1 ? 0 : a >= 2 && a <= 4 ? 1 : 2]; };
const key = (e: Entity) => e.title.replace(/^[\s«»"„“”'(\[]+/, "");
const KINDS = {
  collection: { lettering: "коллекции", cls: "colls", intro: "collIntro" as const, words: ["экспонат", "экспоната", "экспонатов"] as [string, string, string], showType: true },
  theme: { lettering: "темы", cls: "themes", intro: "themeIntro" as const, words: ["материал", "материала", "материалов"] as [string, string, string], showType: false },
};

export default async function CatGrid({ kind }: { kind: keyof typeof KINDS }) {
  const k = KINDS[kind];
  const [db, site] = await Promise.all([loadArchive(), getSite()]);
  const list = ofType(db, kind).sort((a, b) => key(a).localeCompare(key(b), "ru"));
  return (
    <>
      <div id="rest" className={"cgv " + k.cls}>
        <div id="clls">
          <div className="mhead"><MobileMenu centerUrl={site.centerUrl} /></div>
          <Lettering text={k.lettering} h1 />
          <div id="intro">{site[k.intro]}</div>
          <div className="div8" />
          <div id="cgrid">
            {list.map((c) => {
              const n = linked(db, c, "material").length;
              const img = imgOf(db, c, true);
              return (
                <a className="cc" key={c.id} href={`/m/${c.id}`}>
                  <div className="tx">
                    <h2>{c.title}</h2>
                    <div className="vb" />
                    <div className="k">{k.showType ? <b>{String(c.colType || "Коллекция")}</b> : null}<span>{fmt(n)} {plural(n, k.words)}</span></div>
                  </div>
                  <div className="im">{img ? <img src={img} alt="" loading="lazy" style={imgPos(db, c)} /> : null}</div>
                </a>
              );
            })}
          </div>
          <div className="div8 end" />
        </div>
        <Footer site={site} />
      </div>
    </>
  );
}
