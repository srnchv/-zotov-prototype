import "../material.css";
import "../media.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MobileMenu from "@/components/MobileMenu";
import { Lettering } from "@/components/Lettering";
import Footer from "@/components/Footer";
import ViewPing from "@/components/ViewPing";
import YMap from "@/components/YMap";
import PdfReader from "@/components/PdfReader";
import Media, { type Slide } from "@/components/mat/Media";
import AvPlayer from "@/components/mat/AvPlayer";
import Description from "@/components/mat/Description";
import PageNav, { type NavItem } from "@/components/mat/PageNav";
import Cite from "@/components/mat/Cite";
import Related, { type RelCard } from "@/components/mat/Related";
import { getSite } from "@/lib/site";
import { abs, descOf } from "@/lib/seo";
import { toHtml, cleanHtml, cutHtml, textLength } from "@/lib/html";
import { API, getEntity, loadArchive, linked, mediaKind, imgPos, imgOf, mediaPos, published, TYPES, getConfig, coordsOf, spheresOf, funcLabel, funcGroupOf, listOf, projectStatus, projectDates, namesOf, findByName, type Entity } from "@/lib/api";
import type { ReactNode } from "react";
type Base = { id: string; type: string; title: string; status: string; [k: string]: unknown };

export async function generateStaticParams() { return []; } // карточки собираются по первому запросу и живут в кэше до правки в админке
export const revalidate = 3600; // страница из кэша; сброс — из админки при сохранении (/api/revalidate), страховка — раз в час
type Props = { params: Promise<{ id: string }> };

const s = (e: { [k: string]: unknown }, k: string) => String(e[k] ?? "");

// Свои title / description / canonical / картинка превью у каждой карточки
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [e, db] = await Promise.all([getEntity(id), loadArchive()]);
  if (!e || e.type === "dict" || e.type === "tag" || ["draft", "moderation"].includes(String(e.status || ""))) return { title: "Не найдено", robots: { index: false } };
  const kind = TYPES[e.type]?.l || "";
  const sub = [kind, s(e, "mtype") || s(e, "evType") || funcLabel(e) || s(e, "group") || spheresOf(e).join(", "), s(e, "date") || s(e, "dates") || s(e, "life") || s(e, "period")].filter(Boolean).join(", ");
  const description = s(e, "seoDesc") || descOf(toHtml(s(e, "desc")).replace(/<[^>]+>/g, " "), `${e.title}${sub ? " — " + sub : ""}. Архив Центра «Зотов».`);
  const img = imgOf(db, { ...e, links: (e.links || []).map((l) => l.id) } as unknown as Entity, true);
  const url = abs(`/m/${encodeURIComponent(e.id)}`);
  return {
    title: e.title, description,
    alternates: { canonical: url },
    openGraph: { type: "article", url, title: e.title, description, images: img ? [{ url: img }] : undefined },
    twitter: { card: img ? "summary_large_image" : "summary", title: e.title, description, images: img ? [img] : undefined },
  };
}

// ---- связанные: порядок групп и подписи по ТЗ; «Тексты» — после материалов (в таблице ТЗ не перечислены, но связь есть)
const REL_ORDER = ["material", "source", "theme", "person", "event", "place", "project", "collection", "org"];
const REL_HEAD: Record<string, string> = { material: "Материалы", source: "Тексты", theme: "Темы", person: "Личности", event: "События", place: "Места", project: "Проекты центра", collection: "Коллекции", org: "Организации" };
const nMat = (db: Record<string, Entity>, x: Entity) => { const n = linked(db, x, "material").length; return `${n} ${n % 10 === 1 && n % 100 !== 11 ? "материал" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "материала" : "материалов"}`; };
// подпись под карточкой в связанных — по типу сущности
const meta = (x: Entity, db: Record<string, Entity>) => {
  if (x.type === "person") return s(x, "life") || spheresOf(x).join(", ");
  if (x.type === "event") return s(x, "date");
  if (x.type === "place") return [s(x, "city"), s(x, "date")].filter(Boolean).join(", ");
  if (x.type === "project") return projectDates(x) || s(x, "dates");
  if (x.type === "theme" || x.type === "collection") return nMat(db, x);
  if (x.type === "material") return [s(x, "mtype"), s(x, "date")].filter(Boolean).join(", ");
  if (x.type === "source") return [s(x, "author"), s(x, "year")].filter(Boolean).join(", ");
  return s(x, "date") || s(x, "year") || s(x, "period");
};
// пропорция миниатюры в карточке связанного: личности 3:4, темы/коллекции/организации 1:1, остальное 3:2
const aspectOf = (t: string) => (t === "person" ? 3 / 4 : ["theme", "collection", "org"].includes(t) ? 1 : 3 / 2);

// ---- поля шапки по таблице ТЗ «Сущности»; значение-сущность кликабельно
type Row = [string, ReactNode];
const link = (x?: Entity, text?: string) => (x ? <a key={x.id} href={`/m/${x.id}`}>{text || x.title}</a> : text || "");
const names = (db: Record<string, Entity>, v: unknown, type = "person") => namesOf(v).map((n, i) => <span key={i}>{i ? ", " : ""}{link(findByName(db, type, n), n)}</span>);
const group = (e: Entity, g: string) => listOf(e, "authors").filter((v) => v.startsWith(g + " › ")).map((v) => v.split(" › ")[1]);
function infoRows(e: Entity, db: Record<string, Entity>, coll?: Entity): Row[] {
  const t = TYPES[e.type]?.l || e.type;
  const collRow: Row = ["Коллекция", coll ? link(coll) : ""];
  switch (e.type) {
    case "material": return [["Тип, подтип", [s(e, "mtype"), s(e, "subtype")].filter(Boolean).join(", ")], ["Авторы", names(db, e.authors)], ["Период", s(e, "date")], collRow];
    case "source": return [["Тип текста", s(e, "srcType")], ["Автор", names(db, e.author)], ["Период", s(e, "year") || s(e, "date")], collRow];
    case "event": return [["Тип, подтип", [s(e, "evType"), s(e, "subtype")].filter(Boolean).join(", ")], ["Период", s(e, "date")], ["Город", s(e, "city")]];
    case "person": return [["Тип личности", s(e, "group")], ["Сфера деятельности", spheresOf(e).join(", ")], ["Период", s(e, "life")], ["Город", listOf(e, "cities").join(", ")]];
    case "place": return [["Тип, подтип", [funcGroupOf(e), funcLabel(e)].filter(Boolean).join(", ")], ["Адрес", s(e, "address")], ["Город", s(e, "city")], ["Состояние", s(e, "placeStatus")], ["Статус ОКН", s(e, "okn")], ["Период", s(e, "date")],
      ["Архитекторы", names(db, group(e, "Архитекторы").join("; "))], ["Инженеры", names(db, group(e, "Инженеры").join("; "))], ["Проектные организации", names(db, group(e, "Проектные организации").join("; "), "org")], ["Заказчик", listOf(e, "customers").join(", ")]];
    case "org": return [["Тип", s(e, "orgType")], ["Период деятельности", s(e, "period")]];
    case "collection": return [["Тип коллекции", s(e, "colType")], ["Период", s(e, "period")], ["Количество материалов", nMat(db, e)]];
    case "theme": return [["Краткое определение", s(e, "def")], ["Количество материалов", nMat(db, e)]];
    case "project": return [["Тип проекта", s(e, "prType")], ["Даты", projectDates(e)], ["Статус", projectStatus(e)], ["Место проведения", names(db, e.venue, "place")], ["Кураторы", names(db, e.curators)]];
    default: return [["Тип", t], ["Период", s(e, "date") || s(e, "year")]];
  }
}
const rowEmpty = (v: ReactNode) => v == null || v === "" || (Array.isArray(v) && !v.length);

export default async function EntityPage({ params }: Props) {
  const { id } = await params;
  const [e, db, site, cfg] = await Promise.all([getEntity(id), loadArchive(), getSite(), getConfig()]);
  if (!e || e.type === "dict" || e.type === "tag" || ["draft", "moderation"].includes(String(e.status || ""))) notFound();
  const ent: Entity = db[e.id] || { ...(e as Base), links: (e.links || []).map((l) => l.id) };
  const rel = linked(db, ent).filter((x) => x.type !== "media" && x.type !== "tag");
  const media: Entity[] = (e.links || []).filter((x) => x.type === "media");
  const isOpen = process.env.ACCESS_LEVELS === "1" ? (s(e, "access") || "open") === "open" : true; // уровни доступа в MVP выключены
  const fileUrl = (m: Entity) => `${API}/media/${m.id}/file`;
  const tracks = (m: Entity) => ((m.subtitles as { lang: string; label: string; url: string }[]) || []).map((t) => ({ ...t, url: `/subs/${m.id}/${t.lang}.vtt` }));
  const metaOf = (m: Entity) => [s(m, "author"), s(m, "year")].filter(Boolean).join(", ");
  const hlsOpen = (m: Entity) => String(m.access || "open") === "open" && isOpen;
  const hlsUrl = (m: Entity) => (m.hls && m.hlsStatus === "done" ? (cfg.hlsDirect && cfg.mediaUrl && hlsOpen(m) ? `${cfg.mediaUrl}/${m.hls}` : `${API}/hls/${m.id}/master.m3u8`) : undefined);

  // ---- медиа-блок (ТЗ, состояния 1–9): фото и видео — одна галерея в порядке файлов; аудио — виджет; место — карта
  const images = media.filter((m) => mediaKind(m) === "image" && (m.big || m.med));
  const videos = media.filter((m) => mediaKind(m) === "video"), audios = media.filter((m) => mediaKind(m) === "audio"), pdfs = media.filter((m) => mediaKind(m) === "pdf");
  const tours = media.filter((m) => mediaKind(m) === "tour" && m.embed);
  const docs = media.filter((m) => !["image", "tour", "video", "audio"].includes(mediaKind(m)));
  // фото, видео и 3D-туры — одна галерея в порядке файлов карточки; постер видео — его собственная картинка, если есть
  const slides: Slide[] = isOpen ? media.flatMap((m): Slide[] => {
    const k = mediaKind(m);
    if (k === "image" && (m.big || m.med)) return [{ kind: "image", src: String(m.med || m.big), big: String(m.big || m.med), w: Number(m.width) || undefined, h: Number(m.height) || undefined, caption: s(m, "caption") || e.title, credit: metaOf(m), pos: mediaPos(m) }];
    if (k === "video") return [{ kind: "video", src: fileUrl(m), mediaId: m.id, hls: hlsUrl(m), poster: m.med ? String(m.med) : undefined, thumb: m.thumb ? String(m.thumb) : undefined, tracks: tracks(m), caption: s(m, "caption") || e.title, credit: metaOf(m) }];
    if (k === "tour" && m.embed) return [{ kind: "tour", src: String(m.embed), caption: s(m, "caption") || `3D-тур: ${e.title}`, credit: metaOf(m) }];
    return [];
  }) : [];
  const coords = e.type === "place" ? coordsOf(ent) : null;
  const audio = audios[0];
  const coverIsAudio = !slides.length && audio && isOpen; // состояние 9
  const coverIsMap = !slides.length && !!coords; // состояние 5

  // ---- описание: HTML из админки, сноски, свёртка после 2000 знаков
  const html = cleanHtml(toHtml(s(e, "desc")));
  const notes = ((e.notes as string[]) || []).map(String);
  const { head, cut } = textLength(html) > 2000 ? cutHtml(html, 2000) : { head: html, cut: false };

  // ---- связанные по группам, источники, похожее
  const sources = ((e.sources as string[]) || []).map(String).filter(Boolean);
  const coll = rel.find((x) => x.type === "collection");
  const groups = REL_ORDER.map((t) => [t, rel.filter((x) => x.type === t)] as const).filter(([, arr]) => arr.length);
  const relCount = groups.reduce((a, [, arr]) => a + arr.length, 0);
  const roles = (ent.roles || {}) as Record<string, string>;
  const card = (x: Entity): RelCard => ({ id: x.id, title: x.title, sub: meta(x, db), role: roles[x.id], img: imgOf(db, x) || undefined, pos: imgPos(db, x), aspect: aspectOf(x.type) });
  // у проекта центра личности — «Кураторы и участники», первыми
  const relGroups = e.type === "project" ? [...groups.filter(([t]) => t === "person"), ...groups.filter(([t]) => t !== "person")] : groups;
  const headOf = (t: string) => (e.type === "project" && t === "person" ? "Кураторы и участники" : REL_HEAD[t]);
  // «Похожее»: закреплённые в админке первыми, затем того же типа по общим связям (темы и прочие)
  const pinned = ((e.pinned as string[]) || []).map((pid) => db[pid]).filter((x) => x && published(x) && x.id !== e.id);
  let similar: Entity[] = [...pinned];
  if (similar.length < 3) {
    const mine = new Set(ent.links || []);
    const taken = new Set([e.id, ...similar.map((x) => x.id)]);
    const scored = Object.values(db).filter((x) => x.type === e.type && published(x) && !taken.has(x.id))
      .map((x) => ({ x, n: (x.links || []).filter((lid) => mine.has(lid)).length })).filter((c) => c.n > 0)
      .sort((a, b) => b.n - a.n || a.x.title.localeCompare(b.x.title, "ru"));
    similar = [...similar, ...scored.slice(0, 3 - similar.length).map((c) => c.x)];
  }
  similar = similar.slice(0, 3);
  const rows = infoRows(ent, db, coll).filter(([, v]) => !rowEmpty(v));
  const gid = (t: string) => "g-" + t;

  // ---- навигация по странице: только разделы, которые есть
  const nav: NavItem[] = [{ id: "a-desc", label: "Описание" }];
  if (docs.length || pdfs.length) nav.push({ id: "a-docs", label: "Документы", count: docs.length });
  if (sources.length) nav.push({ id: "a-src", label: "Источники", count: sources.length });
  if (relCount) nav.push({ id: "a-rel", label: "Связанные материалы", count: relCount, sub: relGroups.map(([t, arr]) => ({ id: gid(t), label: headOf(t), count: arr.length })) });
  if (similar.length) nav.push({ id: "a-sim", label: "Похожее" });

  // ---- заходная группа: «Поиск → Материал», у места «Карта → Место», у проекта «Проекты центра → <тип>»
  const crumb = e.type === "place" ? { href: `/map?place=${encodeURIComponent(e.id)}`, a: "Карта", b: "Место" }
    : e.type === "project" ? { href: "/cat/project", a: "Проекты центра", b: s(e, "prType") || "Проект" }
    : { href: `/search?type=${e.type === "source" ? "text" : e.type}`, a: "Поиск", b: TYPES[e.type]?.l || e.type };
  const authorsForCite = e.type === "material" ? namesOf(e.authors) : e.type === "source" ? namesOf(e.author) : e.type === "project" ? namesOf(e.curators) : [];
  const cite = { authors: authorsForCite, title: e.title, year: (s(e, "date") || s(e, "year") || s(e, "life") || s(e, "period") || projectDates(e)).match(/\d{4}/)?.[0] || "", url: abs(`/m/${e.id}`) };
  const Arr = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 7.2h9.25L7.54 3.5H9.5L14 8l-4.5 4.5H7.54l3.71-3.7H2V7.2Z" fill="#262626" /></svg>;

  return (
    <>
      <ViewPing id={e.id} />
      <div id="rest" className="mat">
        <div className="mhead"><MobileMenu centerUrl={site.centerUrl} /></div>
        <div id="matgrid">
          {/* левая колонка: липкая — заходная группа, заголовок, поля шапки; внизу «Цитировать» и навигация по странице */}
          <section id="cover">
            <div className="top">
              <div className="div8" />
              <div className="crumbs"><a href={crumb.href}>{crumb.a}</a><Arr /><span>{crumb.b}</span></div>
              <h1>{e.title}</h1>
              {rows.length ? <div className="info">{rows.map(([k, v]) => <div className="row" key={k}><div className="h">{k}</div><div className="v">{v}</div></div>)}</div> : null}
            </div>
            <div className="actions"><Cite data={cite} /></div>
            <PageNav items={nav} cite={<Cite data={cite} icon />} />
          </section>

          {/* правая колонка: медиа, описание, (карта / аудио), документы, источники, «Напишите нам», связанные */}
          <div id="rightcol">
            {slides.length ? <Media slides={slides} />
              : coverIsAudio ? <div className="mblock audio"><AvPlayer kind="audio" src={fileUrl(audio!)} mediaId={audio!.id} tracks={tracks(audio!)} title={s(audio!, "caption") || e.title} /></div>
              : coverIsMap ? <div className="mblock map"><YMap apiKey={cfg.ymapsKey} v3={cfg.ymapsV3} pins={[{ id: e.id, title: e.title, lat: coords![0], lon: coords![1] }]} link={false} /><a className="maplink" href={`/map?place=${encodeURIComponent(e.id)}`}>Открыть на карте</a></div>
              : !isOpen ? <div className="mblock closed"><div className="mframe"><div className="ph">Материал доступен по запросу</div></div></div>
              : null}

            <div className="div8" id="a-desc" />
            <div className="tsm">Описание</div>
            {html ? <Description html={html} head={head} cut={cut} notes={notes} /> : <div className="desc"><div className="rich"><p className="grey">Описание готовится к публикации.</p></div></div>}

            {coords && !coverIsMap ? <div className="mblock map after"><YMap apiKey={cfg.ymapsKey} v3={cfg.ymapsV3} pins={[{ id: e.id, title: e.title, lat: coords[0], lon: coords[1] }]} link={false} /><a className="maplink" href={`/map?place=${encodeURIComponent(e.id)}`}>Открыть на карте</a></div> : null}
            {slides.length && audio && isOpen ? <div className="mblock audio after"><AvPlayer kind="audio" src={fileUrl(audio)} mediaId={audio.id} tracks={tracks(audio)} title={s(audio, "caption") || e.title} /></div> : null}
            {audios.slice(1).map((a) => isOpen ? <div className="mblock audio after" key={a.id}><AvPlayer kind="audio" src={fileUrl(a)} mediaId={a.id} tracks={tracks(a)} title={s(a, "caption") || e.title} /></div> : null)}

            {docs.length || pdfs.length ? <><div className="div8" id="a-docs" />
              <div className="tsm">Документы</div>
              <div className="msec docs">
                {docs.map((d) => (
                  <a className="doc" key={d.id} href={fileUrl(d)} target="_blank" rel="noreferrer">
                    <div className="t">{s(d, "caption") || d.title}{metaOf(d) ? <span className="grey"> · {metaOf(d)}</span> : null}</div><div>.{String(d.format || "").toLowerCase()}</div>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M7.2 2h1.6v7l2.6-2.6 1.1 1.1L8 12 3.5 7.5l1.1-1.1 2.6 2.6V2ZM2 13h12v1.5H2V13Z" fill="currentColor" /></svg>
                  </a>
                ))}
                {isOpen && pdfs[0] ? <div className="pdfwrap"><PdfReader src={fileUrl(pdfs[0])} title={String(pdfs[0].title)} /></div> : null}
              </div></> : null}

            {sources.length ? <><div className="div8" id="a-src" />
              <div className="tsm">Источники</div>
              <div className="msec srcs">{sources.map((x, i) => <div className="src" key={i}><div className="n">{String(i + 1).padStart(2, "0")}.</div><div>{x}</div></div>)}</div></> : null}


            {relCount ? <div className="relwrap" id="a-rel"><div className="div8" />
              <div className="tsm"><span>Связанные материалы</span> <span className="grey">({relCount})</span></div>
              <div id="relmats">{relGroups.map(([t, arr]) => <Related key={t} id={gid(t)} label={headOf(t)} items={arr.map(card)} />)}</div></div> : null}
          </div>
        </div>

        {/* «Похожее»: леттеринг + большая карточка и две средние (как на главной) */}
        {similar.length ? <section id="similar">
          <div id="a-sim"><Lettering text="похожее" /></div>
          <div className="feat pgrid">
            {similar.map((x, i) => (
              <a className={"vcard " + (i === 0 ? "big" : "med")} key={x.id} href={`/m/${x.id}`}>
                <div className="dv" />
                <div className="tx">
                  <h3>{x.title}</h3>{meta(x, db) ? <div className="sub">{meta(x, db)}</div> : null}
                  <div className="vb" />
                  <div className="inf"><b>{TYPES[x.type]?.l}</b>{s(x, "mtype") || s(x, "colType") || s(x, "prType") ? <span>{s(x, "mtype") || s(x, "colType") || s(x, "prType")}</span> : null}</div>
                </div>
                {x.imgBig || x.img || imgOf(db, x, true) ? <div className="im"><img src={String(x.imgBig || x.img || imgOf(db, x, true))} alt="" style={imgPos(db, x)} loading="lazy" /></div> : <div className="im" />}
              </a>
            ))}
          </div>
        </section> : null}

        <Footer site={site} />
      </div>
    </>
  );
}
