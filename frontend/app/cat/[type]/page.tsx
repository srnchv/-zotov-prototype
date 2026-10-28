import "../../search/search.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SearchView, { type SP } from "@/components/SearchView";
import { CATS, CAT_PATHS } from "@/lib/cats";
import { abs } from "@/lib/seo";
import { getSite, type Site } from "@/lib/site";

// Разделы меню (темы, проекты, личности, коллекции…): та же выдача, что в поиске, с зафиксированной типологией
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ type: string }>; searchParams: Promise<SP> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { type } = await params; const c = CATS[type]; if (!c || type === "text") return {};
  const [sp, site] = await Promise.all([searchParams, getSite()]);
  const hasParams = Object.keys(sp).length > 0;
  const description = String(site[("catDesc_" + type) as keyof Site] || "") || `${c.title} в архиве Центра «Зотов».`;
  return { title: c.title, description, alternates: { canonical: abs(CAT_PATHS[type]) }, robots: hasParams ? { index: false, follow: true } : undefined };
}

export default async function CatPage({ params, searchParams }: Props) {
  const { type } = await params; const c = CATS[type];
  if (!c || type === "text") notFound();
  return <SearchView raw={await searchParams} path={CAT_PATHS[type]} fixed={c.kind} lettering={c.lettering} />;
}
