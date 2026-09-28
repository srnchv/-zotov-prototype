import "../material.css";
import "../media.css";
import Player from "@/components/Player";
import PdfReader from "@/components/PdfReader";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SectionTitle from "@/components/SectionTitle";
import Footer from "@/components/Footer";
import StageScale from "@/components/StageScale";
import ViewPing from "@/components/ViewPing";
import ScrollTo from "@/components/ScrollTo";
import { API, getEntity, loadArchive, linked, mediaKind, published, TYPES, type Entity } from "@/lib/api";
type Base = { id: string; type: string; title: string; status: string; [k: string]: unknown };

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = await getEntity((await params).id);
  return { title: e ? `${e.title} — ЗОТОВ. Архив` : "ЗОТОВ — Архив" };
}

const s = (e: { [k: string]: unknown }, k: string) => String(e[k] ?? "");
const REL_ORDER = ["theme", "person", "event", "place", "project", "collection", "org", "source", "material"];
const REL_HEAD: Record<string, string> = { theme: "Темы", person: "Личности", event: "События", place: "Места", project: "Проекты Центра", collection: "Коллекции", org: "Организации", source: "Источники", material: "Материалы" };
const ACCESS: Record<string, string> = { open: "Открытый доступ", request: "По запросу · просмотр", restricted: "Ограниченный доступ" };

// подпись под карточкой в связанных — по типу сущности
const meta = (x: Entity, db: Record<string, Entity>) => {
  if (x.type === "person") return s(x, "life") || s(x, "role");
  if (x.type === "event") return s(x, "date");
  if (x.type === "place") return [s(x, "city"), s(x, "date")].filter(Boolean).join(", ");
  if (x.type === "project") return s(x, "dates");
  if (x.type === "theme" || x.type === "collection") return `${linked(db, x, "material").length} материалов`;
  if (x.type === "material") return [s(x, "mtype"), s(x, "date")].filter(Boolean).join(", ");
  return s(x, "date") || s(x, "year") || s(x, "period");
};

// метабокс: строки подписей по типу сущности (принцип «единый шаблон, различия данными»)
function infoRows(e: Entity, db: Record<string, Entity>, coll?: Entity): [string, string][] {
  const t = TYPES[e.type]?.l || e.type;
  switch (e.type) {
    case "material": return [["Тип, подтип", [s(e, "mtype"), s(e, "subtype")].filter(Boolean).join(", ")], ["Авторы", linked(db, e, "person").map((p) => p.title).join(", ")], ["Дата/период", s(e, "date")], ["Коллекция", coll ? [coll.title, s(coll, "colType")].filter(Boolean).join(", ") : ""], ["Права и доступ", ACCESS[s(e, "access")] || "Открытый доступ"]];
    case "person": return [["Тип, подтип", `${t}, ${s(e, "group") || "—"}`], ["Роль", s(e, "role") || "—"], ["Годы жизни", s(e, "life") || "—"], ["Коллекция", coll ? `${coll.title}, ${s(coll, "colType")}` : "—"], ["Права и доступ", "Открытый доступ"]];
    case "event": return [["Тип, подтип", `${t}, ${s(e, "evType") || "—"}`], ["Участники", linked(db, e, "person").map((p) => p.title).join(", ") || "—"], ["Дата", s(e, "date") || "—"], ["Место", linked(db, e, "place").map((p) => p.title).join(", ") || "—"], ["Права и доступ", "Открытый доступ"]];
    case "place": return [["Тип, подтип", `${t}, ${s(e, "placeType") || "—"}`], ["Адрес", s(e, "address") || s(e, "city") || "—"], ["Дата/период", s(e, "date") || "—"], ["Статус", s(e, "status") === "published" ? "Существует" : s(e, "placeStatus") || "—"], ["Права и доступ", "Открытый доступ"]];
    case "project": return [["Тип, подтип", s(e, "prType") || t], ["Кураторы", s(e, "curators") || "—"], ["Даты проведения", s(e, "dates") || "—"], ["Площадка", linked(db, e, "place").map((p) => p.title).join(", ") || "—"], ["Права и доступ", "Открытый доступ"]];
    case "collection": return [["Тип, подтип", `${t}, ${s(e, "colType") || "—"}`], ["Период", s(e, "period") || "—"], ["Состав", `${linked(db, e, "material").length} материалов`], ["Хранение", "Центр «Зотов», Москва"], ["Права и доступ", "Открытый доступ"]];
    case "org": return [["Тип, подтип", `${t}, ${s(e, "orgType") || "—"}`], ["Период", s(e, "period") || "—"], ["Адрес", linked(db, e, "place").map((p) => p.title).join(", ") || "—"], ["Связано в архиве", `${(e.links || []).length} объектов`], ["Права и доступ", "Открытый доступ"]];
    default: return [["Тип", t], ["Дата/период", s(e, "date") || s(e, "year") || "—"], ["Права и доступ", "Открытый доступ"]];
  }
}

export default async function EntityPage({ params }: Props) {
  const { id } = await params;
  const [e, db] = await Promise.all([getEntity(id), loadArchive()]);
  if (!e || e.type === "dict" || e.type === "tag" || (e.status && e.status !== "published")) notFound();
  const ent: Entity = db[e.id] || { ...(e as Base), links: e.links.map((l) => l.id) };
  const rel = linked(db, ent).filter((x) => x.type !== "media" && x.type !== "tag");
  const media: Entity[] = (e.links || []).filter((x) => x.type === "media");
  const coverMedia = media.find((m) => mediaKind(m) === "image");
  const cover: { src: string; title: string } | null = coverMedia
    ? { src: String(coverMedia.big || coverMedia.med), title: String(coverMedia.title) }
    : e.imgBig ? { src: String(e.imgBig), title: String(e.title) } : null;
  const docs = media.filter((m) => mediaKind(m) !== "image");
  // встроенный просмотр: видео/аудио — плеер с субтитрами, PDF — читалка; файл идёт через бэкенд
  const fileUrl = (m: Entity) => `${API}/media/${m.id}/file`;
  const video = media.find((m) => mediaKind(m) === "video"), audio = media.find((m) => mediaKind(m) === "audio"), pdf = media.find((m) => mediaKind(m) === "pdf");
  // субтитры — через свой роут /subs (тот же origin, поэтому <video> не нужен crossorigin и CORS хранилища)
  const tracks = (m?: Entity) => ((m?.subtitles as { lang: string; label: string; url: string }[]) || []).map((t) => ({ ...t, url: `/subs/${m!.id}/${t.lang}.vtt` }));
  // видео и аудио играют напрямую из хранилища по подписанной ссылке (без прокси — иначе подтормаживает); срок — 6 часов
  const playUrl = async (m?: Entity) => {
    if (!m) return "";
    try { const r = await fetch(`${API}/media/${m.id}/original?ttl=21600`, { cache: "no-store" }); if (r.ok) return String((await r.json()).url || ""); } catch {}
    return fileUrl(m);
  };
  const [videoSrc, audioSrc] = await Promise.all([playUrl(video), playUrl(audio)]);
  const isOpen = (s(e, "access") || "open") === "open";
  const sources = rel.filter((x) => x.type === "source");
  const coll = rel.find((x) => x.type === "collection");
  const groups = REL_ORDER.filter((t) => t !== "source").map((t) => [t, rel.filter((x) => x.type === t)] as const).filter(([, arr]) => arr.length);
  const relCount = groups.reduce((a, [, arr]) => a + arr.length, 0);
  // «Похожее»: прямые связи с проектами/коллекциями/темами/материалами; если их мало — ближайшие по общим связям
  const SIM_TYPES = ["project", "collection", "theme", "material", "event", "person", "place"];
  let similar = rel.filter((x) => ["project", "collection", "theme", "material"].includes(x.type)).slice(0, 3);
  if (similar.length < 3) {
    const mine = new Set(ent.links || []);
    const taken = new Set([e.id, ...similar.map((x) => x.id)]);
    const scored = Object.values(db)
      .filter((x) => SIM_TYPES.includes(x.type) && published(x) && !taken.has(x.id))
      .map((x) => ({ x, n: (x.links || []).filter((id) => mine.has(id)).length }))
      .filter((c) => c.n > 0).sort((a, b) => b.n - a.n || a.x.title.localeCompare(b.x.title, "ru"));
    similar = [...similar, ...scored.slice(0, 3 - similar.length).map((c) => c.x)];
  }
  const paras = s(e, "desc").split(/\n\s*\n/).filter(Boolean);
  const rows = infoRows(ent, db, coll).filter(([, v]) => v && v !== "—"); // пустые поля не показываем
  const gid = (t: string) => "g-" + t;

  return (
    <>
      <StageScale shift={180} />
      <ViewPing id={e.id} />
      <div id="stage">
        <Sidebar variant="mat" />
        <section id="cover">
          <div className="top">
            <div className="div8" />
            <div className="crumbs">
              <a href="/">Архив</a>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 7.2h9.25L7.54 3.5H9.5L14 8l-4.5 4.5H7.54l3.71-3.7H2V7.2Z" fill="#262626" /></svg>
              <a href={`/cat/${e.type}`}>{TYPES[e.type]?.pl || e.type}</a>
            </div>
            <h1>{e.title}</h1>
            <div className="info">{rows.map(([k, v]) => <div className="row" key={k}><div className="h">{k}</div><div>{v}</div></div>)}</div>
          </div>
          <nav id="secmenu">
            <ScrollTo to="a-desc">Описание</ScrollTo>
            <ScrollTo to="a-docs">Документы <span className="num">({docs.length})</span></ScrollTo>
            <ScrollTo to="a-src">Источники <span className="num">({sources.length})</span></ScrollTo>
            <ScrollTo to="a-rel"><span>Связанные материалы</span><span className="num">({relCount})</span><span className="sp" /></ScrollTo>
            <ScrollTo to="a-sim">Похожее</ScrollTo>
          </nav>
          <button id="saveBtn" type="button">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 2h8a1 1 0 0 1 1 1v11l-5-3-5 3V3a1 1 0 0 1 1-1Z" stroke="#262626" strokeWidth="1.6" fill="none" /></svg>
            <span>Сохранить</span>
          </button>
        </section>
      </div>

      <div id="restWrap">
        <div id="rest" className="mat">
          <div id="rightcol">
            <div className="embed">
              {video && isOpen ? <Player kind="video" src={videoSrc} poster={cover?.src} tracks={tracks(video)} title={String(video.title)} />
                : <div className="imgbox">{cover ? <img src={cover.src} alt={e.title} /> : <span className="ph">{isOpen ? "Изображение материала" : "Материал доступен по запросу"}</span>}</div>}
              {audio && isOpen ? <Player kind="audio" src={audioSrc} tracks={tracks(audio)} title={String(audio.title)} /> : null}
              {pdf && isOpen && !video ? <PdfReader src={fileUrl(pdf)} title={String(pdf.title)} /> : null}
              <div>{e.title}</div>
              <div className="grey">{e.type === "material" ? [linked(db, ent, "person")[0]?.title, s(e, "date")].filter(Boolean).join(", ") : rows[1]?.[1] || ""}</div>
            </div>

            <div className="div8" id="a-desc" />
            <div className="tsm">Описание</div>
            <div className="sec">
              {paras.length ? paras.map((p, i) => <div className="para" key={i}>{p}</div>) : <div className="empty">Описание готовится к публикации.</div>}
            </div>

            <div className="div8" id="a-docs" />
            <div className="tsm">Документы</div>
            <div className="sec">
              {docs.length ? docs.map((d) => (
                <a className="doc" key={d.id} href={fileUrl(d)} target="_blank" rel="noreferrer">
                  <div className="t">{d.title}</div><div>{String(d.format || "").toUpperCase()}.</div>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M7.2 2h1.6v7l2.6-2.6 1.1 1.1L8 12 3.5 7.5l1.1-1.1 2.6 2.6V2ZM2 13h12v1.5H2V13Z" fill="#262626" /></svg>
                </a>
              )) : <div className="empty">—</div>}
            </div>

            <div className="div8" id="a-src" />
            <div className="tsm">Источники</div>
            <div className="sec">
              {sources.length ? sources.map((x, i) => <div className="src" key={x.id}><div className="n">{String(i + 1).padStart(2, "0")}.</div><a href={`/m/${x.id}`}>{x.title}{s(x, "year") ? `, ${s(x, "year")}` : ""}</a></div>) : <div className="empty">—</div>}
            </div>

            <div className="div8" id="a-rel" />
            <div className="tsm"><span>Связанные материалы</span> <span className="grey">({relCount})</span></div>
            <div id="relmats">
              {groups.map(([t, arr]) => (
                <div key={t}>
                  <div className="subhead"><span className="tsm" id={gid(t)}>{REL_HEAD[t]}</span><span className="tsm grey">({arr.length})</span></div>
                  {arr.map((x) => (
                    <a className="rel-item" key={x.id} href={`/m/${x.id}`}>
                      <h3>{x.title}</h3><div className="sub">{meta(x, db)}</div>
                      {x.img ? <div className="im"><img src={String(x.img)} alt="" /></div> : null}
                    </a>
                  ))}
                </div>
              ))}
              {!groups.length && <div className="empty grey" style={{ padding: "12px 0" }}>Связи ещё не добавлены.</div>}
            </div>
          </div>

          <section id="similar">
            <div id="a-sim"><SectionTitle text="похожее" small /></div>
            <div className="cards">
              {similar.map((x, i) => (
                <a className={"sim " + (i === 0 ? "big" : "small")} key={x.id} href={`/m/${x.id}`}>
                  <h3>{x.title}</h3><div className="year">{meta(x, db)}</div>
                  <div className="vbar" />
                  <div className="type">{TYPES[x.type]?.l}</div><div className="cat">{s(x, "mtype") || s(x, "colType") || s(x, "prType") || ""}</div>
                  {x.imgBig || x.img ? <div className="im"><img src={String(x.imgBig || x.img)} alt="" /></div> : null}
                </a>
              ))}
            </div>
          </section>

          <div id="matfoot"><Footer /></div>
        </div>
      </div>
    </>
  );
}
