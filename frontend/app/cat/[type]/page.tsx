import "../../search/search.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SearchView, { type SP } from "@/components/SearchView";
import { CATS, CAT_PATHS } from "@/lib/cats";
import { abs } from "@/lib/seo";

// Разделы меню (темы, проекты, личности, коллекции…): та же выдача, что в поиске, с зафиксированной типологией
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ type: string }>; searchParams: Promise<SP> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { type } = await params; const c = CATS[type]; if (!c || type === "text") return {};
  const hasParams = Object.keys(await searchParams).length > 0;
  return { title: c.title, description: `${c.title} в архиве Центра «Зотов».`, alternates: { canonical: abs(CAT_PATHS[type]) }, robots: hasParams ? { index: false, follow: true } : undefined };
}

export default async function CatPage({ params, searchParams }: Props) {
  const { type } = await params; const c = CATS[type];
  if (!c || type === "text") notFound();
  return <SearchView raw={await searchParams} path={CAT_PATHS[type]} fixed={c.kind} lettering={c.lettering} />;
}
