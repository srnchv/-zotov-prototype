import "./search.css";
import type { Metadata } from "next";
import SearchView, { type SP } from "@/components/SearchView";
import { abs } from "@/lib/seo";
import { getSite } from "@/lib/site";

// Поиск по ТЗ DEV (Figma «Поиск», 50:3709): запрос + 8 категорий фильтров + типология + сортировка + пагинация.
// Всё состояние — в адресе: ?q=…&mat=…&mat=…&type=…&sort=…&page=… (ссылкой можно поделиться, «Назад» работает).
export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<SP> };

// в индекс идёт только чистый /search; варианты с запросом и фильтрами — noindex с canonical на базовый адрес
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const [raw, site] = await Promise.all([searchParams, getSite()]);
  const hasParams = Object.keys(raw).length > 0;
  return { title: "Поиск", description: site.catDesc_search || "Поиск по архиву Центра «Зотов»: материалы, личности, места, события, темы, коллекции и проекты.", alternates: { canonical: abs("/search") }, robots: hasParams ? { index: false, follow: true } : undefined };
}

export default async function SearchPage({ searchParams }: Props) {
  return <SearchView raw={await searchParams} />;
}
