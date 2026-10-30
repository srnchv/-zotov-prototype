import MobileMenu from "@/components/MobileMenu";
import { Lettering } from "@/components/Lettering";
import Footer from "@/components/Footer";
import { getSite } from "@/lib/site";
import { loadArchive, ofType, linked, imgOf, imgPos, type Entity } from "@/lib/api";
import { fmt } from "@/lib/search";

// Раздел «Коллекции» по макету DEV (612:54229): леттеринг, вводный текст, сетка больших карточек 2 колонки (1 на планшете и мобайле):
// полоса сверху, название H2 капсом, вертикальная линия, тип коллекции, «N экспонатов», картинка 3:2. Фильтров, поиска и пагинации нет.
const plural = (n: number, f: [string, string, string]) => { const a = n % 10, b = n % 100; return f[b >= 11 && b <= 14 ? 2 : a === 1 ? 0 : a >= 2 && a <= 4 ? 1 : 2]; };
const items = (n: number) => `${fmt(n)} ${plural(n, ["экспонат", "экспоната", "экспонатов"])}`;
const key = (e: Entity) => e.title.replace(/^[\s«»"„“”'(\[]+/, "");

export default async function CollectionsView() {
  const [db, site] = await Promise.all([loadArchive(), getSite()]);
  const colls = ofType(db, "collection").sort((a, b) => key(a).localeCompare(key(b), "ru"));
  return (
    <>
      <div id="rest" className="colls">
        <div id="clls">
          <div className="mhead"><MobileMenu centerUrl={site.centerUrl} /></div>
          <Lettering text="коллекции" h1 />
          <div id="intro">{site.collIntro}</div>
          <div className="div8" />
          <div id="cgrid">
            {colls.map((c) => {
              const n = linked(db, c, "material").length;
              const img = imgOf(db, c, true);
              return (
                <a className="cc" key={c.id} href={`/m/${c.id}`}>
                  <div className="tx">
                    <h2>{c.title}</h2>
                    <div className="vb" />
                    <div className="k"><b>{String(c.colType || "Коллекция")}</b><span>{items(n)}</span></div>
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
