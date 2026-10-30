// Импорт пачкой из Excel: один файл — несколько листов по типам сущностей; связи между сущностями — по названиям
// (через «;»), в том числе на строки того же файла; фото — по именам файлов из колонки «Файлы», сами файлы
// админка заливает папкой после создания сущностей. Шаблон генерируется здесь же (со списками справочников).
// Принцип: сначала предпросмотр (ничего не пишем), потом запуск по подтверждению.
import { readBook, writeBook } from "./xl.js";
import * as repo from "./repo.js";

type Row = Record<string, string>;
type Col = { key: string; label: string; hint: string; req?: boolean; dict?: string };
// общие колонки для всех листов (связи — по названиям, «;» между значениями)
const COMMON_HEAD: Col[] = [{ key: "title", label: "Название", hint: "обязательно; по названию ищется существующая карточка", req: true }];
const COMMON_TAIL: Col[] = [
  { key: "desc", label: "Описание", hint: "текст карточки; абзацы — с новой строки (Alt+Enter)" },
  { key: "access", label: "Доступ", hint: "открытый / по запросу / ограниченный (пусто = открытый)" },
  { key: "status", label: "Публикация", hint: "опубликовано / черновик (пусто = опубликовано)" },
  { key: "files", label: "Файлы", hint: "имена файлов через «;», у файла можно задать подпись через «|»: имя | название | автор | год. Пример: cover.jpg | Обложка книги | Александр Родченко | 1918; film.mp4. Можно указать код: m0004 подхватит из папки m0004-h.jpg, m0004-n1.jpg…" },
  { key: "tags", label: "Теги", hint: "служебные теги через «;»" },
];
const LINK_COLS: [string, string][] = [["person", "Личности"], ["place", "Места"], ["event", "События"], ["theme", "Темы"], ["project", "Проекты Центра"], ["collection", "Коллекции"], ["org", "Организации"], ["material", "Материалы"], ["source", "Тексты"]];
// лист → тип карточек; даты везде называются «Период» (смысл — в подсказке); links — какие колонки связей показывать в шаблоне
// (импорт принимает любые колонки связей на любом листе, это только состав шаблона)
const SHEETS: { type: string; sheet: string; cols: Col[]; dateKey: string; links: string[] }[] = [
  { type: "material", sheet: "Материалы", dateKey: "date", links: ["person", "place", "event", "theme", "collection", "project"], cols: [{ key: "mtype", label: "Тип", hint: "из справочника типов материалов", dict: "mtype" }, { key: "subtype", label: "Подтип", hint: "подтип выбранного типа" }, { key: "date", label: "Период", hint: "год или диапазон: 1927 или 1920–1929" }] },
  { type: "person", sheet: "Личности", dateKey: "life", links: ["event", "theme", "org", "material"], cols: [{ key: "group", label: "Тип личности", hint: "Деятели эпохи / Исследователи конструктивизма", dict: "group" }, { key: "spheres", label: "Сфера деятельности", hint: "одна или несколько через «;» из справочника: архитектура; дизайн; фотография…" }, { key: "life", label: "Период", hint: "годы жизни: 1891–1956" }, { key: "cities", label: "Город", hint: "города через «;» — где жил и работал (фильтр «Город»)" }] },
  { type: "place", sheet: "Места", dateKey: "date", links: ["place"], cols: [{ key: "fgroup", label: "Тип", hint: "группа функции из справочника: Жильё / Администрация / Культура / Транспорт…" }, { key: "fsubs", label: "Подтип", hint: "функции внутри группы, одна или несколько через «;»: Дом-коммуна; Гостиница" }, { key: "city", label: "Город", hint: "из справочника городов" }, { key: "address", label: "Адрес", hint: "" }, { key: "placeStatus", label: "Состояние здания", hint: "существует / утрачено" }, { key: "okn", label: "Статус ОКН", hint: "одно из: федерального значения / регионального значения / местного значения / выявленный / не является ОКН" }, { key: "date", label: "Период", hint: "год постройки или диапазон" }, { key: "lat", label: "Широта", hint: "55.7563; пусто — определится по адресу при загрузке" }, { key: "lon", label: "Долгота", hint: "37.6010" }, { key: "archs", label: "Архитекторы", hint: "имена через «;» — если есть карточка личности, связь проставится сама; если автор неизвестен — «Неизвестный архитектор» (пустая ячейка = неизвестный)" }, { key: "engs", label: "Инженеры", hint: "имена через «;»" }, { key: "dorgs", label: "Проектные организации", hint: "названия через «;»" }, { key: "customers", label: "Заказчики", hint: "один или несколько через «;»: правительство; ведомство; управление; муниципалитет; кооператив; профсоюз; общественная организация; неустановленный застройщик" }] },
  { type: "event", sheet: "События", dateKey: "date", links: ["person", "place", "theme", "org"], cols: [{ key: "evType", label: "Тип", hint: "из справочника типов событий", dict: "evType" }, { key: "subtype", label: "Подтип", hint: "подтип выбранного типа" }, { key: "date", label: "Период", hint: "1927, 12 марта 1927 или диапазон 1927–1928" }, { key: "city", label: "Город", hint: "из справочника городов; если пусто — подставится из привязанного места" }] },
  { type: "theme", sheet: "Темы", dateKey: "", links: ["person", "place", "event", "project", "collection", "org", "material", "source"], cols: [{ key: "def", label: "Краткое определение", hint: "одна-две фразы" }] },
  { type: "project", sheet: "Проекты Центра", dateKey: "dates", links: ["person", "place", "event", "theme", "collection", "org", "material", "source"], cols: [{ key: "prType", label: "Тип", hint: "выставочный проект…", dict: "prType" }, { key: "dates", label: "Период", hint: "даты проведения: 12.03–30.06.1927" }, { key: "curators", label: "Кураторы", hint: "" }] },
  { type: "collection", sheet: "Коллекции", dateKey: "period", links: ["person", "place", "event", "theme", "project", "org", "material", "source"], cols: [{ key: "colType", label: "Тип коллекции", hint: "Коллекция Центра «Зотов» / Музеи / Библиотеки / Архивы / Частные собрания", dict: "colType" }, { key: "period", label: "Период", hint: "1920-е" }] },
  { type: "org", sheet: "Организации", dateKey: "period", links: ["person", "place", "event", "theme", "project", "collection", "material", "source"], cols: [{ key: "orgType", label: "Тип", hint: "", dict: "orgType" }, { key: "period", label: "Период", hint: "период деятельности: 1920 — 1930" }] },
  { type: "source", sheet: "Тексты", dateKey: "year", links: ["person", "theme", "collection"], cols: [{ key: "srcType", label: "Тип текста", hint: "Тексты конструктивистов / Тексты о конструктивистах / Каталоги", dict: "srcType" }, { key: "year", label: "Период", hint: "год публикации" }, { key: "author", label: "Автор", hint: "" }, { key: "publisher", label: "Издательство", hint: "необязательно" }, { key: "pubplace", label: "Место издания", hint: "необязательно" }] },
];

// связи со своим же типом — колонка «Связанные места» / «Связанные личности» и т. д.
const linkLabel = (t: string, l: string, own: string) => (t === own ? "Связанные " + l.toLowerCase() : l);
const linkHint = (t: string, own: string) => (own === "person" && t === "material" ? "обычно заполняется со стороны материала (колонка «Личности»); здесь — для списков работ" : own === "source" && t === "collection" ? "названия через «;» — коллекции, где хранится текст" : "названия через «;» — карточки из архива или строки этого файла");
// колонки листа в шаблоне: общие + свои + связи из списка links (остальные связи импорт тоже примет, если добавить колонку)
const colsOf = (s: (typeof SHEETS)[number]): Col[] => [...COMMON_HEAD, ...s.cols, ...LINK_COLS.filter(([t]) => s.links.includes(t)).map(([t, l]) => ({ key: "link:" + t, label: linkLabel(t, l, s.type), hint: linkHint(t, s.type) })), ...COMMON_TAIL];
// все возможные колонки листа (для сопоставления и разбора): связи — любые
const allColsOf = (s: (typeof SHEETS)[number]): Col[] => [...COMMON_HEAD, ...s.cols, ...LINK_COLS.map(([t, l]) => ({ key: "link:" + t, label: linkLabel(t, l, s.type), hint: "" })), ...COMMON_TAIL];
const ACCESS: Record<string, string> = { "открытый": "open", "по запросу": "request", "ограниченный": "restricted" };
const STATUS: Record<string, string> = { "опубликовано": "published", "черновик": "draft", "на модерации": "moderation" };
// значения справочников как в админке: из карточек + добавленные − убранные (сущности dict-<ключ>)
const DICT_TYPE: Record<string, string> = { mtype: "material", group: "person", evType: "event", prType: "project", colType: "collection", orgType: "org", srcType: "source" };
const FUNC_GROUPS_DEF = ["Жильё", "Администрация", "Промышленность", "Культура", "Наука", "Здравоохранение", "Воспитание и образование", "Спорт", "Связь", "Коммунальное хозяйство", "Торговля", "Транспорт"];
// функции мест: группы (справочник func + стартовые + из карточек) и функции «Группа › функция»
async function funcDict() {
  const { entities } = await repo.exportAll();
  const fromPlaces = entities.filter((e) => e.type === "place").flatMap((e: any) => (Array.isArray(e.functions) ? e.functions as string[] : []));
  const d = entities.find((e) => e.id === "dict-func") as any, rem = new Set<string>(d?.removed || []);
  const groups = [...new Set([...FUNC_GROUPS_DEF, ...fromPlaces.map((v) => v.split(" › ")[0]), ...((d?.added as string[]) || [])])].filter((v) => v && !rem.has(v));
  return { groups, subs: [...new Set(fromPlaces.filter((v) => v.includes(" › ")))] };
}
async function sphereDict() {
  const { entities } = await repo.exportAll();
  const d = entities.find((e) => e.id === "dict-sphere") as any, rem = new Set<string>(d?.removed || []);
  const vals = entities.filter((e) => e.type === "person").flatMap((e: any) => (Array.isArray(e.spheres) ? e.spheres as string[] : String(e.role || "").split(/[,;]/).map((x: string) => x.trim().toLowerCase()).filter(Boolean)));
  return [...new Set([...vals, ...((d?.added as string[]) || [])])].filter((v) => v && !rem.has(v)).sort((a, b) => a.localeCompare(b, "ru"));
}
async function dictValues(): Promise<Record<string, string[]>> {
  const { entities } = await repo.exportAll();
  const out: Record<string, string[]> = {};
  for (const [dk, t] of Object.entries(DICT_TYPE)) {
    const base = entities.filter((e) => e.type === t).map((e) => String((e as any)[dk] || "").split(" · ")[0].trim()).filter(Boolean);
    const d = entities.find((e) => e.id === "dict-" + dk) as any;
    const rem = new Set<string>((d?.removed as string[]) || []);
    out[dk] = [...new Set([...base, ...((d?.added as string[]) || [])])].filter((v) => !rem.has(v)).sort((a, b) => a.localeCompare(b, "ru"));
  }
  return out;
}
const norm = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const key = (s: string) => norm(s).toLowerCase().replace(/ё/g, "е").normalize("NFC");
const split = (s: string) => norm(s).split(/\s*;\s*/).filter(Boolean);
export const EXAMPLE = "ПРИМЕР";
// старые названия колонок → новые (шаблоны прошлых версий продолжают загружаться)
const ALIAS: Record<string, string> = { "дата": "Период", "годы жизни": "Период", "даты проведения": "Период", "год": "Период", "период деятельности": "Период", "роль": "Сфера деятельности", "функции": "Подтип", "авторы": "Архитекторы", "заказчик": "Заказчики", "города": "Город" };

// ---- шаблон: лист «Инструкция» + лист на каждый тип с подсказками и строкой-примером ----
export async function template(): Promise<Buffer> {
  const dicts = await dictValues();
  const out: { name: string; aoa: string[][]; widths?: number[] }[] = [];
  const instr = [
    ["Импорт в архив «Зотов» — как заполнять"],
    [""],
    ["1. Каждый лист — один тип карточек. Строка 1 — названия колонок (не менять), строка 2 — подсказки, строка 3 — пример (начинается с «ПРИМЕР», при загрузке пропускается). Свои данные — с 4-й строки."],
    ["2. «Название» обязательно. Если карточка с таким названием и типом уже есть в архиве, она обновится: заполненные ячейки перезапишут поля, пустые ничего не тронут."],
    ["3. Связи («Личности», «Места», «Темы»…) — названия через «;». Можно ссылаться на карточки архива и на строки этого же файла (на любом листе). Связи двусторонние: достаточно указать с одной стороны."],
    ["4. Типы и подтипы — из справочников (списки ниже). Новое значение добавится в справочник, в отчёте будет предупреждение."],
    ["5. «Период»: год или диапазон «с–по» (1920–1929). Неточные даты задаются диапазоном: «1920-е» → 1920–1929. У личности — годы жизни, у проекта — даты проведения."],
    ["6. «Файлы» — имена файлов из папки через «;»: фото (JPG/PNG/WebP/TIFF), видео (MP4/WebM), аудио (MP3/M4A/WAV), документы (PDF). Первое фото строки станет обложкой. Папка выбирается в админке на втором шаге; из неё берутся только файлы, упомянутые в таблице."],
    ["   Подпись к файлу на сайте (название, автор, год) — через «|» после имени: cover.jpg | Обложка книги «Маяковский улыбается» | Александр Родченко | 1918. Все части необязательны; без названия файл подписывается названием карточки."],
    ["   Субтитры к видео и аудио — файлом рядом с тем же именем: film.mp4 → film.ru.srt, film.en.vtt (без языка = русский). В таблицу субтитры писать не нужно, они подхватятся сами."],
    ["   Требования: имена латиницей, без пробелов (rodchenko-01.jpg); одна папка без вложенных; имя уникально в папке; до 100 МБ на файл (длинное видео лучше сжать)."],
    ["7. «Доступ»: открытый (по умолчанию), по запросу, ограниченный. «Публикация»: опубликовано (по умолчанию) или черновик."],
    ["8. Перед записью админка показывает предпросмотр: что создастся, что обновится, какие связи не найдены. Ошибочные строки не загружаются, остальные — загружаются."],
    [""],
    ["Справочники (текущие значения):"],
  ];
  const DL: Record<string, string> = { mtype: "Типы материалов", group: "Типы личностей", evType: "Типы событий", prType: "Типы проектов", colType: "Типы коллекций", orgType: "Типы организаций", srcType: "Типы текстов" };
  for (const [k, l] of Object.entries(DL)) instr.push([l + ": " + ((dicts[k] || []).join("; ") || "—")]);
  const funcs = await funcDict();
  instr.push(["Типы мест (группы функций; функции внутри групп — подтипы, полный список в админке): " + (funcs.groups.join("; ") || "—")]);
  instr.push(["Статус ОКН: " + OKN_LIST.join("; ")]);
  instr.push(["Заказчики: " + CUSTOMER_LIST.join("; ")]);
  instr.push(["Сферы деятельности личностей: " + ((await sphereDict()).join("; ") || "архитектура; дизайн; фотография…") + " (полный список — в админке)"]);
  out.push({ name: "Инструкция", aoa: instr, widths: [160] });
  const EX: Record<string, Row> = {
    material: { title: "ПРИМЕР Афиша выставки «1927»", mtype: "Печатная продукция", subtype: "Афиша", date: "1927", "link:person": "Александр Родченко", "link:event": "Открытие выставки «1927»", "link:theme": "Конструктивизм", files: "afisha-1927.jpg | Афиша выставки | Александр Родченко | 1927; afisha-1927-back.jpg | Оборот афиши", desc: "Афиша к открытию выставки." },
    person: { title: "ПРИМЕР Александр Родченко", group: "Деятели эпохи", role: "художник, фотограф, дизайнер", life: "1891–1956", "link:place": "Дом Моссельпрома", files: "rodchenko.jpg" },
    place: { title: "ПРИМЕР Дом Моссельпрома", fgroup: "Администрация", fsubs: "Контора; Универмаг", city: "Москва", address: "Калашный пер., 2/10", placeStatus: "Существует", date: "1923–1925", okn: "регионального значения", archs: "Струков Д.М.; Коган А.С.", engs: "Лолейт А.Ф.", customers: "кооператив", lat: "55.7563", lon: "37.6010" },
    event: { title: "ПРИМЕР Открытие выставки «1927»", evType: "Открытие выставки", date: "12 марта 1927", "link:place": "Дом Моссельпрома" },
    theme: { title: "ПРИМЕР Фотомонтаж", def: "Техника соединения фотографий в одно изображение." },
    project: { title: "ПРИМЕР Выставка «1927»", prType: "Выставочный проект", dates: "12.03–30.06.1927", curators: "Иван Иванов" },
    collection: { title: "ПРИМЕР Архив Стригалёва", colType: "Личная коллекция", period: "1920-е" },
    org: { title: "ПРИМЕР ВХУТЕМАС", orgType: "Учебное заведение", period: "1920 — 1930" },
    source: { title: "ПРИМЕР Интервью с Александром Родченко", srcType: "Интервью", year: "1924", author: "А. Родченко", "link:person": "Александр Родченко" },
  };
  for (const s of SHEETS) {
    const cols = colsOf(s);
    const aoa = [cols.map((c) => c.label), cols.map((c) => c.hint), cols.map((c) => EX[s.type]?.[c.key] || "")];

    out.push({ name: s.sheet, aoa, widths: cols.map((c) => (c.key === "title" || c.key === "desc" ? 40 : c.key.startsWith("link:") ? 28 : 18)) });
  }
  return writeBook(out);
}

// ---- разбор файла ----
export type FileSpec = { name: string; caption?: string; author?: string; year?: string };
type Parsed = { type: string; sheet: string; row: number; title: string; fields: Record<string, string>; links: Record<string, string[]>; files: FileSpec[]; tags: string[]; access?: string; status?: string; dictKey?: string };
// «имя | название | автор | год» → спецификация файла
// «нет фото», «—» и прочие пометки кириллицей — не имена файлов
// имена файлов — через «;»; если подписей «|» нет, то и через запятую (m0002, m0003)
const splitFiles = (v: string) => (v.includes("|") ? split(v) : norm(v).split(/\s*[;,]\s*/).filter(Boolean));
const parseFile = (v: string): FileSpec => { const [name0, caption, author, year] = v.split("|").map((x) => norm(x)); const name = /[а-яё]/i.test(name0) || name0 === "-" || name0 === "—" ? "" : name0; return { name, ...(caption ? { caption } : {}), ...(author ? { author } : {}), ...(year ? { year } : {}) }; };
// место: «да/yes/существует» → Существует, «снесён/нет/утрачен» → Утрачено; город из адреса «Москва, …» / «г. Москва, …»;
// авторы/функции/заказчики — списки (через «;», у авторов допускается «,»)
const CITY_RE = /^(?:г\.\s*)?([А-ЯЁ][а-яё\-]+(?:[ -][А-ЯЁ][а-яё\-]+)?)\s*[,.]\s*(.+)$/;
export function normalizePlace(p: { fields: Record<string, string>; title: string }) {
  const f = p.fields;
  if (f.placeStatus) { const k2 = key(f.placeStatus); f.placeStatus = /^(да|yes|существует|сохранил|есть)/.test(k2) ? "Существует" : /^(нет|no|снес|утрач|разруш|не сущ|уничтож)/.test(k2) ? "Утрачено" : f.placeStatus; }
  if (!f.city && f.address) { const m = f.address.match(CITY_RE); if (m) { f.city = m[1]; f.address = m[2].trim(); } }
  if (f.city && f.address) { const pre = new RegExp("^(?:г\\.\\s*)?" + f.city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*,\\s*", "i"); f.address = f.address.replace(pre, ""); }
  const names = (v: string) => v.split(/\s*[;,]\s*(?![^()]*\))/).map((x) => x.trim()).filter(Boolean);
  // авторы — три группы из трёх колонок → один список «Группа › имя» (так хранит админка и фильтр карты)
  const authors: string[] = [];
  for (const [k, g] of [["archs", "Архитекторы"], ["engs", "Инженеры"], ["dorgs", "Проектные организации"]] as const) {
    for (const n of names(f[k] || "")) authors.push(n.includes(" › ") ? n : g + " › " + n.replace(/^неизвестный архитектор$/i, "Неизвестный архитектор"));
    delete (f as any)[k];
  }
  if (f.authors) { for (const n of names(f.authors)) authors.push(n.includes(" › ") ? n : "Архитекторы › " + n); } // старая общая колонка «Авторы» — как архитекторы
  if (authors.length) (f as any).authors = [...new Set(authors)]; else delete (f as any).authors;
  // типология места: «Тип» = группа функции, «Подтип» = функции внутри группы → functions ["Группа › функция"]; значение уже с «›» — как есть
  const fg = (f as any).fgroup ? String((f as any).fgroup).trim() : "";
  const fs = split(String((f as any).fsubs || "")).map((x) => x.replace(/\s*(?:›|\/|>|→)\s*/, " › ").trim()).filter(Boolean);
  delete (f as any).fgroup; delete (f as any).fsubs;
  const funcs = fs.map((x) => (x.includes(" › ") ? x : fg ? fg + " › " + x : x));
  if (!funcs.length && fg) funcs.push(fg + " › " + fg); // группа без функции — сама группа как функция
  if (funcs.length) (f as any).functions = [...new Set(funcs)];
  if (f.customers) (f as any).customers = split(f.customers).map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (f.date) f.date = f.date.replace(/\.0$/, "").replace(/^(\d{4})\s*[-–—;,]\s*(\d{4})$/, "$1–$2");
  if (f.okn) { const k2 = key(f.okn); f.okn = k2.includes("федерал") ? "федерального значения" : k2.includes("регион") ? "регионального значения" : k2.includes("местн") ? "местного значения" : k2.includes("выявлен") ? "выявленный" : /лиш|исключ/.test(k2) ? "лишён статуса" : /без статуса|не является|нет/.test(k2) ? "не является ОКН" : f.okn; }
}

export const OKN_LIST = ["федерального значения", "регионального значения", "местного значения", "выявленный", "не является ОКН"];
export const CUSTOMER_LIST = ["правительство", "ведомство", "управление", "муниципалитет", "кооператив", "профсоюз", "общественная организация", "неустановленный застройщик"];
// ---- автор места ↔ карточка личности ----
// «Мельников К.С.», «К.С. Мельников», «инж.-арх. В.Г. Шухов», «Константин Мельников» ↔ «Константин Мельников»:
// совпадает фамилия и, если есть, первый инициал с именем; при нескольких кандидатах без инициала — не связываем
const ROLE_PREFIX = /^(?:при\s+уч(?:астии)?\.?|совм(?:естно)?\.?\s+с|инж\.?-?арх\.?|инж\.?-?стр\.?|инж\.?|арх\.?|конст(?:р)?\.?|худ\.?|скульпт\.?|архитектор[ы]?|инженер[ы]?)\s+/i;
export function matchPerson(author: string, persons: string[]): string {
  let a = norm(author).replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 3; i++) a = a.replace(ROLE_PREFIX, "").trim();
  if (!a) return "";
  const toks = a.split(" ").filter(Boolean);
  const isInit = (t: string) => /^(?:[А-ЯЁ]\.){1,2}$|^[А-ЯЁ]\.[А-ЯЁ]\.?$|^[А-ЯЁ]$/.test(t);
  const initials = toks.filter(isInit).join("").replace(/\./g, "");
  const words = toks.filter((t) => !isInit(t));
  if (!words.length) return "";
  const kw = (x: string) => key(x).replace(/-/g, "");
  // фамилия: при инициалах — единственное «слово»; при полном имени «Константин Мельников» — последнее слово
  const surname = kw(initials ? words[words.length - 1] : words[words.length - 1]);
  const firstName = !initials && words.length > 1 ? kw(words[0]) : "";
  const cands = persons.filter((t) => { const w = key(t).split(" ").map(kw); return w.length > 0 && (w[w.length - 1] === surname || w.includes(surname)); });
  if (!cands.length) return "";
  const byInit = cands.filter((t) => { const w = key(t).split(" ").map(kw).filter((x) => x !== surname); if (!w.length) return !initials && !firstName; if (firstName) return w[0] === firstName; if (initials) return w[0][0] === initials[0].toLowerCase(); return true; });
  if (byInit.length === 1) return byInit[0];
  if (byInit.length > 1 && (initials || firstName)) return byInit[0];
  return "";
}

// ---- сопоставление колонок произвольной таблицы с полями шаблона ----
export type Mapping = Record<string, { type: string; cols: Record<string, string> }>; // лист → тип карточек и «заголовок в файле → ключ поля» ("" — пропустить)
export type Inspect = { sheets: { name: string; headers: string[]; sample: string[][]; rows: number; template: boolean; guess: { type: string; cols: Record<string, string> } }[]; targets: Record<string, { key: string; label: string }[]> };
// синонимы заголовков (ключ поля → слова; сравнение по нормализованному заголовку, без регистра)
const SYN: Record<string, string[]> = {
  title: ["название", "наименование", "имя", "name", "title", "объект", "фио", "заголовок"],
  desc: ["описание", "description", "текст", "аннотация", "биография", "об объекте", "описание объекта"],
  address: ["адрес", "adress", "address", "местоположение"], city: ["город", "city", "населенный пункт"],
  date: ["дата", "год", "годы", "year", "date", "период", "годы постройки", "год постройки", "year 1", "year 2", "даты"],
  life: ["годы жизни", "life", "жизнь"], dates: ["даты проведения"], year: ["год публикации", "год издания"], period: ["период деятельности"],
  placeStatus: ["состояние", "существует", "existance", "existence", "сохранность", "статус здания", "состояние здания"],
  okn: ["окн", "okn", "статус окн", "охранный статус", "памятник"],
  archs: ["автор", "авторы", "архитектор", "архитекторы", "architects", "architect", "author", "authors"], engs: ["инженер", "инженеры", "engineers", "engineer", "конструктор"], dorgs: ["проектная организация", "проектные организации", "мастерская", "бюро"],
  customers: ["заказчик", "заказчики", "organisation", "организация-заказчик", "customer"],
  fgroup: ["тип", "type", "типология", "тип объекта", "тип места", "группа функции", "функция группа"], fsubs: ["подтип", "подтип места", "функции", "функция", "назначение", "function"],
  spheres: ["сфера деятельности", "сфера", "сферы", "роль", "профессия", "деятельность"], cities: ["города", "город деятельности"], mtype: ["тип материала"], evType: ["тип события"], srcType: ["тип текста"], orgType: ["тип организации"], prType: ["тип проекта"], colType: ["тип коллекции"],
  subtype: ["подтип", "subtype"], group: ["тип личности", "группа"],
  author: ["автор текста"], publisher: ["издательство", "издатель"], pubplace: ["место издания"], curators: ["кураторы", "куратор"], def: ["определение", "краткое определение"],
  lat: ["широта", "lat", "latitude"], lon: ["долгота", "lon", "lng", "longitude"],
  files: ["файлы", "фото", "photo", "photos", "файл", "изображения", "images", "id", "код", "индекс", "code", "id connections", "connections"],
  tags: ["теги", "tags"], access: ["доступ"], status: ["публикация", "статус публикации"],
  "link:person": ["личности", "персоны", "люди", "persons", "people", "участники", "связанные личности"], "link:place": ["места", "связанные места", "связанные объекты", "объекты"],
  "link:event": ["события", "events"], "link:theme": ["темы", "themes", "topics"], "link:project": ["проекты", "проекты центра"], "link:collection": ["коллекции", "коллекция", "collections"],
  "link:org": ["организации", "организация", "organisations", "organizations", "org"], "link:material": ["материалы", "materials"], "link:source": ["тексты", "источники", "sources", "texts"],
};
const TYPE_SYN: Record<string, string[]> = {
  place: ["место", "места", "объект", "объекты", "здания", "карта", "адрес", "place", "places", "map", "building"], person: ["личност", "персон", "люди", "герои", "person", "people", "авторы"],
  event: ["событ", "хронограф", "event"], material: ["материал", "material", "фото", "работы", "произведения"], source: ["текст", "источник", "библиограф", "книги", "статьи", "text", "source"],
  org: ["организац", "org", "институц", "объединен"], theme: ["тем", "theme", "topic"], project: ["проект", "выставк", "project"], collection: ["коллекц", "collection", "фонд"],
};
const hkey = (h: string) => key(h).replace(/[«»"()]/g, "").replace(/\s+/g, " ").trim();
function guessType(name: string, headers: string[]): string {
  const n = key(name) + " " + headers.map(hkey).join(" ");
  const score: Record<string, number> = {};
  for (const [t, words] of Object.entries(TYPE_SYN)) for (const w of words) if (n.includes(w)) score[t] = (score[t] || 0) + (key(name).includes(w) ? 3 : 1);
  if (headers.some((h) => /adress|address|адрес|окн|архитект|existance/.test(hkey(h)))) score.place = (score.place || 0) + 4;
  if (headers.some((h) => /годы жизни|роль|life/.test(hkey(h)))) score.person = (score.person || 0) + 3;
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : "material";
}
export function targetsOf(type: string): { key: string; label: string }[] {
  const sdef = SHEETS.find((x) => x.type === type); if (!sdef) return [];
  return allColsOf(sdef).map((c) => ({ key: c.key, label: c.label }));
}
function guessCols(type: string, headers: string[]): Record<string, string> {
  const allowed = new Set(targetsOf(type).map((t) => t.key));
  const out: Record<string, string> = {};
  const used = new Set<string>();
  for (const h of headers) {
    const hk = hkey(h); if (!hk) continue;
    let best = "";
    for (const [k, words] of Object.entries(SYN)) { if (!allowed.has(k)) continue; if (words.some((w) => hk === w)) { best = k; break; } }
    if (!best) for (const [k, words] of Object.entries(SYN)) { if (!allowed.has(k) || k === "files" || k === "tags") continue; if (words.some((w) => w.length > 3 && hk.includes(w))) { best = k; break; } }
    if (best && best !== "date" && best !== "files" && used.has(best)) best = ""; // одинаковые цели — только для даты (год 1 + год 2) и файлов
    out[h] = best; if (best) used.add(best);
  }
  return out;
}
export async function inspect(buf: Buffer): Promise<Inspect> {
  const wb = await readBook(buf);
  const sheets: Inspect["sheets"] = [];
  for (const name of wb.names) {
    const rows: unknown[][] = wb.sheets[name];
    const body = rows.filter((r) => r.some((c) => norm(c)));
    if (body.length < 2) continue;
    const headers = body[0].map((h) => norm(h));
    if (headers.filter(Boolean).length < 2) continue; // «Инструкция», «О файле» и прочие листы без таблицы
    const sdef = SHEETS.find((x) => x.sheet === name);
    const template = !!sdef && headers.some((h) => key(h) === "название");
    const type = sdef ? sdef.type : guessType(name, headers);
    // примеры значений — без строки пояснений под шапкой (в ней длинные тексты вместо данных)
    const isHint = (r: unknown[]) => r.filter((c) => norm(c).length > 60).length >= 3;
    const sample = body.slice(1).filter((r) => !isHint(r)).slice(0, 5).map((r) => headers.map((_, i) => norm(r[i]).slice(0, 80)));
    sheets.push({ name, headers, sample, rows: body.length - 1, template, guess: { type, cols: template ? {} : guessCols(type, headers) } });
  }
  const targets: Record<string, { key: string; label: string }[]> = {};
  for (const sdef of SHEETS) targets[sdef.type] = targetsOf(sdef.type);
  return { sheets, targets };
}
// перекладываем листы произвольной книги в книгу формата шаблона: несколько колонок в одно поле — дата склеивается «1926–1927», остальное через «; »
export async function applyMapping(buf: Buffer, mapping: Mapping): Promise<Buffer> {
  const wb = await readBook(buf);
  const byType: Record<string, string[][]> = {};
  for (const [name, m] of Object.entries(mapping)) {
    const ws = wb.sheets[name]; const sdef = SHEETS.find((x) => x.type === m.type); if (!ws || !sdef) continue;
    const cols = allColsOf(sdef);
    const rows: unknown[][] = ws;
    const body = rows.filter((r) => r.some((c) => norm(c)));
    if (body.length < 2) continue;
    const headers = body[0].map((h) => norm(h));
    const tgt = byType[m.type] ||= [cols.map((c) => c.label)];
    // строки-подсказки под шапкой: пропускаем те, где нет ни одного «данного» значения (все ячейки — длинные пояснения) — проще: пропускаем строки, где название пустое
    for (const r of body.slice(1)) {
      const vals: Record<string, string[]> = {};
      headers.forEach((h, i) => { const k = m.cols[h]; const v = norm(r[i]); if (k && v) (vals[k] ||= []).push(v); });
      if (!vals.title?.length || vals.title[0].toUpperCase().startsWith(EXAMPLE)) continue; // пусто или строка-пример шаблона
      // строка-подсказка под шапкой (пояснения вместо значений): дата без года и длиннее 30 знаков — пропускаем
      if (Object.values(vals).flat().filter((x) => x.length > 60).length >= 3 && !/^\d{4}/.test(vals.date?.[0] || "")) continue;
      const line = cols.map((c) => {
        const v = vals[c.key] || [];
        if (!v.length) return "";
        if (c.key === "date") { const ys = v.map((x) => x.replace(/\.0$/, "")); return ys.length === 2 && /^\d{4}$/.test(ys[0]) && /^\d{4}$/.test(ys[1]) ? (ys[0] === ys[1] ? ys[0] : `${ys[0]}–${ys[1]}`) : ys.join(", "); }
        if (c.key === "title") return v[0];
        if (c.key === "desc") return v.join("\n\n");
        return v.join("; ");
      });
      tgt.push(line);
    }
  }
  return writeBook(Object.entries(byType).map(([t, aoa]) => ({ name: SHEETS.find((x) => x.type === t)!.sheet, aoa })));
}

async function parse(buf: Buffer) {
  const wb = await readBook(buf);
  const out: Parsed[] = []; const problems: string[] = [];
  for (const s of SHEETS) {
    const ws = wb.sheets[s.sheet]; if (!ws) continue;
    const rows: unknown[][] = ws;
    if (!rows.length) continue;
    const head = rows[0].map((h) => key(ALIAS[key(String(h))] || String(h)));
    const cols = allColsOf(s);
    const idx = (label: string) => head.indexOf(key(label));
    if (idx("Название") < 0) { problems.push(`Лист «${s.sheet}»: нет колонки «Название» — лист пропущен`); continue; }
    const known = new Set(cols.map((c) => key(c.label)));
    const unknown = head.map((h, i) => [h, i] as const).filter(([h]) => h && !known.has(h));
    const dataRows = rows.slice(1).filter((r) => norm(r[idx("Название")]) && !String(r[idx("Название")]).toUpperCase().startsWith(EXAMPLE));
    for (const [h, i] of unknown) if (dataRows.some((r) => norm(r[i]))) problems.push(`Лист «${s.sheet}»: колонка «${rows[0][i]}» не из шаблона — её значения не загружаются`);
    for (const c of cols) if (c.key === "files" && idx(c.label) < 0) problems.push(`Лист «${s.sheet}»: нет колонки «Файлы» — фото к этим карточкам не привяжутся`);
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]; const get = (label: string) => { const i = idx(label); return i < 0 ? "" : norm(row[i]); };
      const title = get("Название");
      if (!title) continue;
      if (r === 1 && title === cols[0].hint) continue; // строка подсказок
      if (r === 2 && title.toUpperCase().startsWith(EXAMPLE)) continue; // строка-пример шаблона
      const p: Parsed = { type: s.type, sheet: s.sheet, row: r + 1, title, fields: {}, links: {}, files: splitFiles(get("Файлы")).map(parseFile).filter((f) => f.name), tags: split(get("Теги")) };
      for (const c of s.cols) { const v = get(c.label); if (v) p.fields[c.key] = v; if (c.dict) p.dictKey = c.key; }
      if (p.type === "place") normalizePlace(p);
      if (p.type === "person") { const f: any = p.fields; for (const k of ["spheres", "cities"]) if (f[k]) f[k] = split(String(f[k])).map((x) => (k === "spheres" ? x.toLowerCase() : x)).filter(Boolean); }
      const d = get("Описание"); if (d) p.fields.desc = d;
      const acc = key(get("Доступ")); if (acc) { if (ACCESS[acc]) p.access = ACCESS[acc]; else problems.push(`${s.sheet}, строка ${r + 1}: неизвестный доступ «${get("Доступ")}»`); }
      const st = key(get("Публикация")); if (st) { if (STATUS[st]) p.status = STATUS[st]; else problems.push(`${s.sheet}, строка ${r + 1}: неизвестная публикация «${get("Публикация")}»`); }
      for (const [t, l] of LINK_COLS) { const v = split(get(linkLabel(t, l, s.type))); if (v.length) p.links[t] = v; }
      out.push(p);
    }
  }
  return { items: out, problems };
}

// ---- план: что создастся, что обновится, какие связи найдены ----
export type PlanRow = { sheet: string; row: number; type: string; title: string; action: "create" | "update" | "error"; id?: string; links: number; files: FileSpec[]; notes: string[]; fields: string[] };
// ненайденная связь: тип + название из таблицы, где встречается; решается в админке (выбрать карточку / создать / пропустить)
export type Unresolved = { key: string; type: string; name: string; rows: string[]; similar: { id: string; title: string }[] };
export type Plan = { rows: PlanRow[]; problems: string[]; creates: number; updates: number; errors: number; links: number; files: string[]; newDict: string[]; unresolved: Unresolved[] };
// решения по ненайденным: key → id карточки | "new" (создать карточку этого типа) | "" (пропустить связь)
export type Resolve = Record<string, string>;
async function buildPlan(buf: Buffer, resolve: Resolve = {}): Promise<{ plan: Plan; items: Parsed[]; byKey: Map<string, string>; dicts: Record<string, string[]> }> {
  const { items, problems } = await parse(buf);
  const { entities } = await repo.exportAll();
  const byKey = new Map<string, string>(); // type|title → id существующей карточки
  for (const e of entities) if (e.type !== "media" && e.type !== "dict") byKey.set(e.type + "|" + key(e.title), e.id);
  const inFile = new Set(items.map((p) => p.type + "|" + key(p.title)));
  const dicts = await dictValues();
  const newDict = new Set<string>();
  const rows: PlanRow[] = []; const files = new Set<string>(); let links = 0;
  const seen = new Set<string>();
  const unres = new Map<string, Unresolved>();
  const titles = entities.filter((e) => e.type !== "media" && e.type !== "dict" && e.type !== "tag");
  // личности для сопоставления авторов мест: из архива и из этого же файла
  const persons: string[] = [...entities.filter((e) => e.type === "person").map((e) => e.title), ...items.filter((p) => p.type === "person").map((p) => p.title)];
  for (const p of items) {
    const k = p.type + "|" + key(p.title);
    const notes: string[] = [];
    // авторы места («Мельников К.С.») → связь с карточкой личности, если такая есть; без карточки остаются просто текстом в «Авторах»
    if (p.type === "place") {
      const f: any = p.fields;
      if (f.okn && !OKN_LIST.includes(f.okn)) notes.push(`статус ОКН «${f.okn}» не из списка (${OKN_LIST.join(", ")})`);
      for (const c of (f.customers || []) as string[]) if (!CUSTOMER_LIST.includes(c)) notes.push(`заказчик «${c}» не из списка (${CUSTOMER_LIST.join(", ")})`);
      for (const fn of (f.functions || []) as string[]) if (!fn.includes(" › ")) notes.push(`функция «${fn}» без группы — укажите «Тип» (группу), например Жильё`);
    }
    if (p.type === "place" && Array.isArray((p.fields as any).authors)) {
      const found: string[] = [];
      for (const a of (p.fields as any).authors as string[]) { if (a.startsWith("Проектные организации › ")) continue; const t = matchPerson(a.replace(/^[^›]+›\s*/, ""), persons); if (t && !found.includes(t)) found.push(t); }
      if (found.length) { const cur = p.links.person || []; for (const t of found) if (!cur.some((x) => key(x) === key(t))) cur.push(t); p.links.person = cur; notes.push(`авторы → личности: ${found.join(", ")}`); }
    }
    let action: PlanRow["action"] = byKey.has(k) ? "update" : "create";
    if (seen.has(k)) { action = "error"; notes.push("дубль: такое название уже есть выше в файле"); }
    seen.add(k);
    for (const [t, names] of Object.entries(p.links)) for (const n of names) {
      const lk = t + "|" + key(n);
      if (byKey.has(lk) || inFile.has(lk)) { links++; continue; }
      const rs = resolve[lk];
      const chosen = rs && rs !== "new" ? entities.find((e) => e.id === rs && e.type === t) : null;
      if (rs === "new" || chosen) { links++; notes.push(`${n} → ${rs === "new" ? "новая карточка" : "«" + chosen!.title + "»"}`); continue; }
      if (rs === "") { notes.push(`связь «${n}» пропущена`); continue; }
      const u = unres.get(lk) || { key: lk, type: t, name: n, rows: [], similar: titles.filter((e) => e.type === t && (key(e.title).includes(key(n).split(" ")[0]) || key(n).includes(key(e.title).split(" ")[0]))).slice(0, 5).map((e) => ({ id: e.id, title: e.title })) };
      u.rows.push(`${p.sheet} ${p.row}`); unres.set(lk, u);
      notes.push(`не найдено: ${LINK_COLS.find(([x]) => x === t)?.[1]} → «${n}»`);
    }
    if (p.dictKey && p.fields[p.dictKey]) { const v = p.fields[p.dictKey]; const have = (dicts[p.dictKey] || []).some((x) => key(x) === key(v)); if (!have) { newDict.add(`${p.dictKey}:${v}`); notes.push(`новое значение справочника «${v}» — добавится`); } }
    for (const f of p.files) files.add(f.name);
    // что заполнено в строке — подписи полей (списки со счётчиком), чтобы в предпросмотре было видно, что подхватилось
    const sdef = SHEETS.find((x) => x.type === p.type)!;
    const fields = [...sdef.cols, ...COMMON_TAIL.filter((c) => c.key === "desc")].filter((c) => { const v = (p.fields as any)[c.key]; return Array.isArray(v) ? v.length : !!v; }).map((c) => { const v = (p.fields as any)[c.key]; return Array.isArray(v) ? `${c.label.toLowerCase()} (${v.length})` : c.label.toLowerCase(); });
    if (Array.isArray((p.fields as any).authors)) fields.push(`авторы (${(p.fields as any).authors.length})`);
    if (Array.isArray((p.fields as any).functions)) fields.unshift(`тип и функции (${(p.fields as any).functions.length})`);
    rows.push({ sheet: p.sheet, row: p.row, type: p.type, title: p.title, action, id: byKey.get(k), links: Object.values(p.links).flat().length, files: p.files, notes, fields });
  }
  const plan: Plan = { rows, problems, creates: rows.filter((r) => r.action === "create").length, updates: rows.filter((r) => r.action === "update").length, errors: rows.filter((r) => r.action === "error").length, links, files: [...files], newDict: [...newDict], unresolved: [...unres.values()] };
  return { plan, items, byKey, dicts };
}
const withMap = async (buf: Buffer, mapping?: Mapping | null) => (mapping && Object.keys(mapping).length ? applyMapping(buf, mapping) : buf);
export const preview = async (buf: Buffer, resolve: Resolve = {}, mapping?: Mapping | null) => (await buildPlan(await withMap(buf, mapping), resolve)).plan;

// ---- запуск: сущности → справочники → связи; возвращает id по строкам (для заливки файлов из админки) ----
export async function run(buf: Buffer, actor: string, resolve: Resolve = {}, mapping?: Mapping | null, geocode?: (q: string) => Promise<{ lat: number; lon: number } | null>) {
  const { plan, items, byKey, dicts } = await buildPlan(await withMap(buf, mapping), resolve);
  let geocoded = 0;
  const okRows = plan.rows.filter((r) => r.action !== "error");
  const ids = new Map<string, string>(byKey);
  const result: { sheet: string; row: number; title: string; id: string; action: string; files: FileSpec[] }[] = [];
  // 1. карточки
  for (const r of okRows) {
    const p = items.find((x) => x.sheet === r.sheet && x.row === r.row)!;
    const k = p.type + "|" + key(p.title);
    const payload: Record<string, unknown> = { ...p.fields };
    if (p.access) payload.access = p.access;
    // место без координат — по адресу через геокодер (если настроен); ошибка геокодера карточку не останавливает
    if (p.type === "place" && geocode && !p.fields.lat && p.fields.address) {
      const cur = ids.get(k) ? await repo.getEntity(ids.get(k)!) : null;
      if (!(cur as any)?.lat) { try { const g = await geocode([p.fields.city, p.fields.address].filter(Boolean).join(", ")); if (g) { payload.lat = g.lat; payload.lon = g.lon; geocoded++; } } catch {} }
    }
    if (p.type === "place" && p.fields.placeType && p.fields.subtype && !String(p.fields.placeType).includes(" · ")) payload.placeType = p.fields.placeType + " · " + p.fields.subtype;
    if (p.type === "place" && !ids.get(k) && !(payload.authors as string[] | undefined)?.length) payload.authors = ["Архитекторы › Неизвестный архитектор"]; // правило: архитектор неизвестен — так и пишем
    let id = ids.get(k);
    if (id) { await repo.updateEntity(id, { payload, ...(p.status ? { status: p.status } : {}) }); await repo.logAct("update", id, p.title, actor + " · импорт"); }
    else { const e = await repo.createEntity({ type: p.type, title: p.title, status: p.status || "published", payload }); id = e.id; ids.set(k, id); await repo.logAct("create", id, p.title, actor + " · импорт"); }
    result.push({ sheet: r.sheet, row: r.row, title: p.title, id, action: r.action, files: p.files });
  }
  // 1б. решения по ненайденным связям: выбранная карточка или новая минимальная карточка нужного типа
  for (const [lk, rs] of Object.entries(resolve)) {
    if (ids.has(lk)) continue;
    const [t, nm] = [lk.slice(0, lk.indexOf("|")), lk.slice(lk.indexOf("|") + 1)];
    if (rs === "new") { const title = items.flatMap((p) => p.links[t] || []).find((n) => key(n) === nm) || nm; const e = await repo.createEntity({ type: t, title, status: "draft" }); ids.set(lk, e.id); await repo.logAct("create", e.id, title, actor + " · импорт (из связи)"); }
    else if (rs) ids.set(lk, rs);
  }
  // 2. справочники: новые значения типов
  const byDict: Record<string, string[]> = {};
  for (const nd of plan.newDict) { const [dk, v] = [nd.slice(0, nd.indexOf(":")), nd.slice(nd.indexOf(":") + 1)]; (byDict[dk] ||= []).push(v); }
  for (const [dk, vals] of Object.entries(byDict)) {
    const cur = await repo.getEntity("dict-" + dk);
    const added = [...new Set([...(((cur as any)?.added as string[]) || []), ...vals])];
    const removed = ((((cur as any)?.removed as string[]) || [])).filter((x) => !vals.includes(x));
    if (cur) await repo.updateEntity("dict-" + dk, { payload: { added, removed } });
    else await repo.createEntity({ id: "dict-" + dk, type: "dict", title: "Справочник: " + dk, payload: { added, removed: [] } });
  }
  // 3. связи и теги
  let linked = 0;
  const tagIds = new Map<string, string>();
  for (const e of (await repo.exportAll()).entities) if (e.type === "tag") tagIds.set(key(e.title), e.id);
  for (const r of okRows) {
    const p = items.find((x) => x.sheet === r.sheet && x.row === r.row)!;
    const id = ids.get(p.type + "|" + key(p.title))!;
    for (const [t, names] of Object.entries(p.links)) for (const n of names) {
      const tid = ids.get(t + "|" + key(n)); if (!tid || tid === id) continue;
      try { await repo.addLink(id, tid); linked++; } catch { /* уже связаны */ }
    }
    for (const tg of p.tags) {
      let tid = tagIds.get(key(tg));
      if (!tid) { tid = (await repo.createEntity({ type: "tag", title: tg })).id; tagIds.set(key(tg), tid); }
      try { await repo.addLink(id, tid); } catch {}
    }
  }
  void dicts;
  return { created: okRows.filter((r) => r.action === "create").length, updated: okRows.filter((r) => r.action === "update").length, skipped: plan.errors, linked, geocoded, rows: result };
}
