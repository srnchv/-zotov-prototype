import "./map.css";
import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import MobileMenu from "@/components/MobileMenu";
import { Lettering } from "@/components/Lettering";
import Footer from "@/components/Footer";
import HomeScale from "@/components/HomeScale";
import YMap, { type Pin } from "@/components/YMap";
import { getSite } from "@/lib/site";
import { loadArchive, ofType, linked, getConfig, coordsOf } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Карта — ЗОТОВ. Архив" };

// Карта: все места архива с координатами (задаются в админке в карточке места); клик по точке — в карточку
export default async function MapPage() {
  const [db, site, cfg] = await Promise.all([loadArchive(), getSite(), getConfig()]);
  const places = ofType(db, "place").map((p) => ({ p, c: coordsOf(p) })).filter((x) => x.c);
  const pins: Pin[] = places.map(({ p, c }) => ({ id: p.id, title: p.title, lat: c![0], lon: c![1] }));
  return (
    <div className="pg">
      <HomeScale />
      <div id="stage"><Sidebar variant="mat" active="/map" centerUrl={site.centerUrl} /></div>
      <div id="rest" className="mapp">
        <div id="mapp">
          <div className="mhead"><MobileMenu centerUrl={site.centerUrl} /></div>
          <Lettering text="карта" />
          <div id="intro">Географический слой архива: здания, города и адреса, связанные с материалами, событиями и людьми. Существующие и давно утраченные — на одной карте.</div>
          <div className="div8" />
          {pins.length ? <YMap apiKey={cfg.ymapsKey} pins={pins} className="big" /> : <div id="empty">Мест с координатами пока нет — они задаются в админке, в карточке места.</div>}
          <div id="plist">
            {places.map(({ p }) => (
              <a className="pl" key={p.id} href={`/m/${p.id}`}>
                <div className="dv" /><h3>{p.title}</h3>
                <div className="sub">{[String(p.city || ""), String(p.address || "")].filter(Boolean).join(", ")}</div>
                <div className="inf"><b>{String(p.placeType || "Место")}</b><span>{linked(db, p, "material").length} материалов</span></div>
              </a>
            ))}
          </div>
          <div className="div8 end" />
        </div>
        <Footer site={site} />
      </div>
    </div>
  );
}
