import "../search/search.css";
import type { Metadata } from "next";
import SearchView, { type SP } from "@/components/SearchView";
import { CATS } from "@/lib/cats";
import { PAGE_CATS } from "@/lib/search";
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
  const site = await getSite(); // по макету DEV (550:75129): фильтры Период, Тип текста, Личность, Тема, Коллекция; поиск по названиям
  return <SearchView raw={await searchParams} path="/texts" fixed={CATS.text.kind} lettering={CATS.text.lettering} section={{ catKeys: PAGE_CATS.text, intro: site.textsIntro, ph: site.textsPh, cls: "texts", cardsOf: "text" }} />;
}
