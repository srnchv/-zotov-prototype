// Разделы-категории: адрес → фиксированная типология поиска + леттеринг заголовка
export const CATS: Record<string, { kind: string; lettering: string; title: string }> = {
  theme: { kind: "theme", lettering: "темы", title: "Темы" },
  project: { kind: "project", lettering: "проекты центра", title: "Проекты Центра" },
  person: { kind: "person", lettering: "личности", title: "Личности" },
  collection: { kind: "collection", lettering: "коллекции", title: "Коллекции" },
  material: { kind: "material", lettering: "материалы", title: "Материалы" },
  place: { kind: "place", lettering: "места", title: "Места" },
  event: { kind: "event", lettering: "события", title: "События" },
  text: { kind: "text", lettering: "тексты", title: "Тексты" },
};
export const CAT_PATHS: Record<string, string> = Object.fromEntries(Object.keys(CATS).map((k) => [k, k === "text" ? "/texts" : `/cat/${k}`]));
