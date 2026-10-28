import "../search/search.css";
import type { Metadata } from "next";
import SearchView, { type SP } from "@/components/SearchView";
import { CATS } from "@/lib/cats";
import { abs } from "@/lib/seo";
import { getSite } from "@/lib/site";

// «Тексты» — источники-тексты архива: выдача поиска с типологией «текст»
export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<SP> };
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const [sp, site] = await Promise.all([searchParams, getSite()]);
  const hasParams = Object.keys(sp).length > 0;
  return { title: "Тексты", description: site.catDesc_text || "Тексты и публикации о конструктивизме в архиве Центра «Зотов».", alternates: { canonical: abs("/texts") }, robots: hasParams ? { index: false, follow: true } : undefined };
}
export default async function TextsPage({ searchParams }: Props) {
  return <SearchView raw={await searchParams} path="/texts" fixed={CATS.text.kind} lettering={CATS.text.lettering} />;
}
