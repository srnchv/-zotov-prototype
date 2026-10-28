// Модель данных архива для админки: типы сущностей, ключи полей по типу, справочники, подписи.
// Принцип ТЗ: сущность создаётся один раз и выводится везде через двусторонние связи.
export type Entity = { id: string; type: string; title: string; status?: string; links: string[]; [k: string]: any };
export type Role = "admin" | "editor" | "moderator";

export const TYPES: Record<string, { l: string; pl: string }> = {
  material: { l: "Материал", pl: "Материалы" }, person: { l: "Личность", pl: "Личности" },
  place: { l: "Место", pl: "Места" }, event: { l: "Событие", pl: "События" },
  theme: { l: "Тема", pl: "Темы" }, project: { l: "Проект Центра", pl: "Проекты Центра" },
  org: { l: "Организация", pl: "Организации" }, collection: { l: "Коллекция / фонд", pl: "Коллекции" },
  source: { l: "Источник", pl: "Источники" }, media: { l: "Медиафайл", pl: "Медиафайлы" }, tag: { l: "Тег", pl: "Теги" },
};
export const CONTENT_TYPES = ["material", "person", "place", "event", "theme", "project", "org", "collection", "source"];
export const REL_ORDER = ["material", "event", "person", "place", "project", "collection", "theme", "org", "source", "tag"];
export const REL_HEAD: Record<string, string> = { material: "Материалы", person: "Связанные личности", place: "Связанные места", event: "Связанные события", project: "Проекты Центра", collection: "Коллекции и фонды", theme: "Темы", org: "Организации", source: "Источники", tag: "Теги" };
export const ACCESS: Record<string, string> = { open: "Открытый", request: "По запросу", restricted: "Ограниченный" };
export const ROLE_LABEL: Record<Role, string> = { admin: "администратор", editor: "редактор", moderator: "модератор" };
export const STATUS_LABEL: Record<string, string> = { draft: "Черновик", moderation: "На модерации", published: "Опубликовано" };
export const pubStat = (o: Entity) => STATUS_LABEL[o.status || ""] || "Опубликовано";

// ключи «Тип» (из справочника), «Подтип» и «Дата» — у каждой сущности своё поле
export const TYPEKEY: Record<string, string> = { material: "mtype", event: "evType", person: "group", collection: "colType", place: "placeType", org: "orgType", project: "prType", source: "srcType", theme: "themeType" };
export const SUBKEY: Record<string, string> = { person: "role" };
export const TYPELABEL: Record<string, string> = { person: "Группа", collection: "Тип коллекции" };
export const SUBLABEL: Record<string, string> = { person: "Роль (художник, архитектор…)", collection: "Родительская коллекция" };
export const DATEKEY: Record<string, string> = { person: "life", project: "dates", org: "period", collection: "period", source: "year" };
export const DATELABEL: Record<string, string> = { person: "Годы жизни", project: "Даты проведения", org: "Период деятельности", collection: "Период", source: "Год" };
// подсказки по ТЗ поиска: год или диапазон «с — по»; неточные даты — диапазоном («1920-е» → 1920–1929)
export const DATEPH: Record<string, string> = { person: "1891–1956 (рождение — смерть)", project: "12.05–30.09.1927 (начало — окончание)", org: "1920 — 1930", material: "1927 или 1920–1929", event: "1927 или 1927–1928", place: "1929 или 1927–1931", source: "1927 (год публикации)" };
export const typeKeyOf = (t: string) => TYPEKEY[t] || "subtype";
export const subKeyOf = (t: string) => SUBKEY[t] || "subtype";
export const dateKeyOf = (t: string) => DATEKEY[t] || "date";
// специфичные поля после общих
export const SPECIFIC: Record<string, [string, string, string?][]> = {
  place: [["city", "Город", "dict:city"], ["address", "Адрес"], ["placeStatus", "Состояние здания", "select:Существует|Утрачено"], ["okn", "Статус ОКН", "dictsel:okn"], ["functions", "Функция", "multi:func"], ["authors", "Автор", "multi:author"], ["customers", "Заказчик", "multi:customer"]],
  event: [["city", "Город", "dict:city"]], // для фильтра «Город» в хронографе; подставляется из привязанного места
  project: [["curators", "Кураторы"]],
  source: [["author", "Автор"], ["publisher", "Издательство"], ["pubplace", "Место издания"]],
  theme: [["def", "Краткое определение"]],
};
export const PAYLOAD_KEYS = ["lat", "lon", "placeStatus", "okn", "functions", "authors", "customers", "mtype", "subtype", "date", "desc", "evType", "placeType", "srcType", "group", "role", "city", "address", "colType", "orgType", "prType", "themeType", "life", "dates", "period", "year", "curators", "author", "publisher", "pubplace", "def"];
// источник: текстовый материал (полная карточка) или библиографическая запись (короткая)
export const SRCKIND: Record<string, string> = { text: "Текстовый материал", record: "Библиографическая запись" };
export const isRecord = (o: { type: string; srcKind?: string }) => o.type === "source" && o.srcKind === "record";
export const TYPELIST = ["Видео", "Аудио", "Изображение", "Текст", "Документ", "Печатная продукция", "Графика", "Живопись", "Макет", "Предмет / ДПИ", "Цифровой объект", "Сенсорный материал"];
export const A11Y = ["РЖЯ", "субтитры", "расшифровка", "аудиоописание"];
export const ACTL: Record<string, string> = { create: "создание", update: "правка", delete: "удаление", link: "связь", unlink: "связь снята", media: "файл" };

// вид файла по метаданным или расширению
export const kindOf = (f: Entity) => {
  if (["image", "video", "audio", "tour"].includes(f.kind)) return f.kind as string;
  const ext = String(f.format || f.title || "").toLowerCase().split(".").pop() || "";
  if (["mp3", "wav", "ogg", "flac", "m4a"].includes(ext)) return "audio";
  if (["mp4", "mov", "webm", "avi"].includes(ext)) return "video";
  if (["jpg", "jpeg", "png", "webp", "gif", "tif", "tiff"].includes(ext)) return "image";
  return "doc";
};
export const MEDIA_FLOORS: [string, string, string][] = [["image", "Фото", "image/*"], ["video", "Видео", "video/*"], ["audio", "Аудио", "audio/*"], ["tour", "3D-тур", ""], ["doc", "Документы", "application/pdf,.doc,.docx,.txt"]];

export const yearOf = (d?: unknown) => { const m = String(d || "").match(/\d{4}/); return m ? +m[0] : 0; };
export const plural = (n: number, f: [string, string, string]) => { const a = n % 10, b = n % 100; return f[b >= 11 && b <= 14 ? 2 : a === 1 ? 0 : a >= 2 && a <= 4 ? 1 : 2]; };
export const fmtAt = (s?: string | null) => (s ? String(s).slice(0, 16).replace("T", " ") : "");
export const fmtSize = (n?: unknown) => { if (n == null || n === "") return ""; if (typeof n !== "number") return String(n); return n > 1048576 ? (n / 1048576).toFixed(1) + " МБ" : n > 1024 ? Math.round(n / 1024) + " КБ" : n + " Б"; };
export const dateOf = (o: Entity) => String(o.date || o.dates || o.life || o.year || o.period || "");

// главная: единые данные «показывать на главной» (у события — существующее inChrono)
export const HOME_KEY = (t: string) => (t === "event" ? "inChrono" : "onHome");
export const onHome = (o: Entity) => !!o[HOME_KEY(o.type)];
export const HOME_TYPES = ["theme", "project", "event", "person", "collection"];
// тексты главной по умолчанию (совпадают с фронтом)
export const HOME_DEF: Record<string, string> = {
  heroText: "Уникальный архив о конструктивизме,\nмедиа и городской истории:\nматериалы, личности, события, места и проекты,\nобъединённые в единую систему связей",
  aboutText: "Первый в мире цифровой архив,\nобъединяющий источники и исследования,\nпосвященные конструктивизму",
  aboutCol1: "Зотов. Архив объединит материалы и исследования, посвященные эпохе 1920-1930-х гг. в России. Здесь начинается систематизация и каталогизация данных, распределенных по разным городам, организациям и изданиям.",
  aboutCol2: "Главные задачи архива Центра «Зотов»: найти, объединить, систематизировать исторические источники периода развития конструктивизма; ввести в научный оборот ранее неисследованные источники; сохранить информацию о выставочных проектах и событиях в сфере изучения и популяризации наследия конструктивизма.",
  aboutCol3: "Цифровой архив — это новый подход к сохранению и популяризации культурного наследия, создание централизованного «адреса» по теме конструктивизма для институций, специалистов и студентов.",
  aboutCol4: "Зотов. Архив приглашает к сотрудничеству исследователей, проекты и институции, цели работы которых связаны с цифровизацией и сохранением наследия конструктивизма.",
  aboutEmail: "archive@centrezotov.ru", aboutBg: "", mapM: "",
  searchPh: "Ищите по ключевым словам, именам, местам и событиям", searchPhM: "Имена, места, события",
  mapText: "Конструктивистские адреса на карте:\nздания, клубы, инженерные сооружения,\nпосвященные конструктивизму",
};
// остальные тексты сайта (раздел «Тексты сайта»)
export const SITE_DEF: [string, [string, string, string, boolean?][]][] = [
  ["Карта", [["mapIntro", "Вводный текст на странице карты", "Архив Центра «Зотов» — это связанная система материалов, людей, мест\nи событий. Ищите по ключевым словам, уточняйте фильтрами и переходите по связям: каждый объект ведёт к другим.", true], ["mapSearchPh", "Плейсхолдер поиска по карте", "Название или адрес"]]],
  ["Хронограф", [["chronoIntro", "Вводный текст на странице хронографа", "История конструктивизма и Центра «Зотов» на шкале времени: выставки, премьеры, публикации и дискуссии по годам.", true]]],
  ["Поиск", [["searchIntro", "Вводный текст на странице поиска (перенос строки — как в макете)", "Архив Центра «Зотов» — это связанная система материалов, людей, мест\nи событий. Ищите по ключевым словам, уточняйте фильтрами и переходите по связям: каждый объект ведёт к другим.", true]]],
  ["Ссылки", [["centerUrl", "Сайт Центра «Зотов» (ссылка «Зотов Центр»)", "https://zotov.center"], ["privacyUrl", "Политика конфиденциальности (ссылка)", ""], ["personalUrl", "Обработка персональных данных (ссылка)", ""], ["offerUrl", "Публичная оферта (ссылка)", ""], ["copyright", "Копирайт в футере", "© Центр Зотов, 2022–2026"]]],
  ["Соцсети", [["vk", "ВКонтакте (ссылка)", ""], ["tg", "Telegram (ссылка)", ""], ["yt", "YouTube (ссылка)", ""], ["dzen", "Дзен (ссылка)", ""]]],
  ["Описания разделов", [["catDesc_theme", "Темы — описание раздела (для поисковиков и превью ссылок)", "", true], ["catDesc_project", "Проекты Центра — описание раздела", "", true], ["catDesc_person", "Личности — описание раздела", "", true], ["catDesc_collection", "Коллекции — описание раздела", "", true], ["catDesc_text", "Тексты — описание раздела", "", true], ["catDesc_search", "Поиск — описание страницы", "", true], ["catDesc_chrono", "Хронограф — описание страницы", "", true], ["catDesc_map", "Карта — описание страницы", "", true]]],
  ["SEO", [["seoTitle", "Заголовок сайта по умолчанию (вкладка браузера, главная)", "ЗОТОВ — Архив"], ["seoDesc", "Описание сайта по умолчанию — до 160 знаков; главная и страницы без своего описания", "Цифровой архив Центра «Зотов»: материалы, личности, события, места и проекты, объединённые в единую систему связей", true], ["gscCode", "Google Search Console — код подтверждения (содержимое content из мета-тега google-site-verification)", ""], ["ywCode", "Яндекс Вебмастер — код подтверждения (content из мета-тега yandex-verification)", ""], ["metrikaId", "Яндекс Метрика — номер счётчика (только цифры)", ""]]],
];
