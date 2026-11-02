import type { Metadata } from "next";
import "../search/search.css";
import "./collections.css";
import CatGrid from "@/components/CatGrid";
import { CATS, CAT_PATHS } from "@/lib/cats";
import { abs } from "@/lib/seo";
import { getSite, type Site } from "@/lib/site";

// Витрины (коллекции, темы, проекты) по макетам DEV 612:54229 / 612:50434 / 612:52873: без поиска и фильтров,
// поэтому у каждой свой статический адрес (app/cat/<kind>/page.tsx) — страница целиком живёт в кэше (ISR),
// в отличие от /cat/[type], где есть параметры поиска. Литеральный сегмент имеет приоритет над [type].
export type GridKind = "collection" | "theme" | "project";
export async function gridMetadata(kind: GridKind): Promise<Metadata> {
  const c = CATS[kind], site = await getSite();
  const description = String(site[("catDesc_" + kind) as keyof Site] || "") || `${c.title} в архиве Центра «Зотов».`;
  return { title: c.title, description, alternates: { canonical: abs(CAT_PATHS[kind]) } };
}
export const GridPage = ({ kind }: { kind: GridKind }) => <CatGrid kind={kind} />;
