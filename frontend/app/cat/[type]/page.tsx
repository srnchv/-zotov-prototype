import "../../search/search.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SearchView, { type SP } from "@/components/SearchView";
import { PAGE_CATS } from "@/lib/search";
import { CATS, CAT_PATHS } from "@/lib/cats";
import { abs } from "@/lib/seo";
import { getSite, type Site } from "@/lib/site";

// Разделы меню с поиском и фильтрами (личности, места, события, материалы): та же выдача, что в поиске, с зафиксированной типологией.
// Страница динамическая (параметры адреса), но считается на кэшированных ответах API (/api/q/search).
// Витрины без параметров (коллекции, темы, проекты) — отдельные статические адреса, см. ../grid.tsx.
type Props = { params: Promise<{ type: string }>; searchParams: Promise<SP> };
const GRID = new Set(["collection", "theme", "project"]);
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { type } = await params; const c = CATS[type]; if (!c || type === "text" || GRID.has(type)) return {};
  const site = await getSite();
  const hasParams = Object.keys(await searchParams).length > 0;
  const description = String(site[("catDesc_" + type) as keyof Site] || "") || `${c.title} в архиве Центра «Зотов».`;
  return { title: c.title, description, alternates: { canonical: abs(CAT_PATHS[type]) }, robots: hasParams ? { index: false, follow: true } : undefined };
}

export default async function CatPage({ params, searchParams }: Props) {
  const { type } = await params; const c = CATS[type];
  if (!c || type === "text" || GRID.has(type)) notFound();
  // «Личности» — по макету DEV (550:75129): свой набор фильтров, поиск только по именам
  const site = type === "person" ? await getSite() : null;
  const section = site ? { catKeys: PAGE_CATS.person, intro: site.personIntro, ph: site.personPh, cls: "persons", cardsOf: "person" as const } : undefined;
  return <SearchView raw={await searchParams} path={CAT_PATHS[type]} fixed={c.kind} lettering={c.lettering} section={section} />;
}
