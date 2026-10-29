// Импорт пачкой из Excel: один файл — несколько листов по типам сущностей; связи между сущностями — по названиям
// (через «;»), в том числе на строки того же файла; фото — по именам файлов из колонки «Файлы», сами файлы
// админка заливает папкой после создания сущностей. Шаблон генерируется здесь же (со списками справочников).
// Принцип: сначала предпросмотр (ничего не пишем), потом запуск по подтверждению.
import * as XLSX from "xlsx";
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
const SHEETS: { type: string; sheet: string; cols: Col[]; dateKey: string }[] = [
  { type: "material", sheet: "Материалы", dateKey: "date", cols: [{ key: "mtype", label: "Тип", hint: "из справочника типов материалов", dict: "mtype" }, { key: "subtype", label: "Подтип", hint: "подтип выбранного типа" }, { key: "date", label: "Дата", hint: "год или диапазон: 1927 или 1920–1929" }] },
  { type: "person", sheet: "Личности", dateKey: "life", cols: [{ key: "group", label: "Тип личности", hint: "Деятели эпохи / Исследователи конструктивизма", dict: "group" }, { key: "role", label: "Роль", hint: "художник, архитектор…" }, { key: "life", label: "Годы жизни", hint: "1891–1956" }] },
  { type: "place", sheet: "Места", dateKey: "date", cols: [{ key: "placeType", label: "Тип", hint: "из справочника типов мест", dict: "placeType" }, { key: "subtype", label: "Подтип", hint: "" }, { key: "city", label: "Город", hint: "" }, { key: "address", label: "Адрес", hint: "" }, { key: "placeStatus", label: "Состояние здания", hint: "существует / утрачено" }, { key: "date", label: "Дата", hint: "год постройки или диапазон" }, { key: "okn", label: "Статус ОКН", hint: "федерального значения / регионального значения / выявленный / не является ОКН…" }, { key: "functions", label: "Функции", hint: "через «;»: жильё; клуб" }, { key: "authors", label: "Авторы", hint: "архитекторы через «;» или «,»: Мельников К.С.; Шухов В.Г." }, { key: "customers", label: "Заказчики", hint: "через «;»" }, { key: "lat", label: "Широта", hint: "55.7563; пусто — определится по адресу при загрузке" }, { key: "lon", label: "Долгота", hint: "37.6010" }] },
  { type: "event", sheet: "События", dateKey: "date", cols: [{ key: "evType", label: "Тип", hint: "из справочника типов событий", dict: "evType" }, { key: "subtype", label: "Подтип", hint: "" }, { key: "date", label: "Дата", hint: "1927 или 12 марта 1927" }] },
  { type: "theme", sheet: "Темы", dateKey: "", cols: [{ key: "def", label: "Краткое определение", hint: "одна-две фразы" }] },
  { type: "project", sheet: "Проекты Центра", dateKey: "dates", cols: [{ key: "prType", label: "Тип", hint: "выставочный проект…", dict: "prType" }, { key: "dates", label: "Даты проведения", hint: "12.03–30.06.1927" }, { key: "curators", label: "Кураторы", hint: "" }] },
  { type: "collection", sheet: "Коллекции", dateKey: "period", cols: [{ key: "colType", label: "Тип коллекции", hint: "Открытое хранение / Личная коллекция", dict: "colType" }, { key: "period", label: "Период", hint: "1920-е" }] },
  { type: "org", sheet: "Организации", dateKey: "period", cols: [{ key: "orgType", label: "Тип", hint: "", dict: "orgType" }, { key: "period", label: "Период деятельности", hint: "1920 — 1930" }] },
  { type: "source", sheet: "Тексты", dateKey: "year", cols: [{ key: "srcType", label: "Тип текста", hint: "статья, рецензия, каталог…", dict: "srcType" }, { key: "year", label: "Год", hint: "год публикации" }, { key: "author", label: "Автор", hint: "" }, { key: "publisher", label: "Издательство", hint: "" }, { key: "pubplace", label: "Место издания", hint: "" }] },
];
// связи со своим же типом — колонка «Связанные места» / «Связанные личности» и т. д.
const linkLabel = (t: string, l: string, own: string) => (t === own ? "Связанные " + l.toLowerCase() : l);
const colsOf = (s: (typeof SHEETS)[number]): Col[] => [...COMMON_HEAD, ...s.cols, ...LINK_COLS.map(([t, l]) => ({ key: "link:" + t, label: linkLabel(t, l, s.type), hint: "названия через «;» — карточки из архива или строки этого файла" })), ...COMMON_TAIL];
const ACCESS: Record<string, string> = { "открытый": "open", "по запросу": "request", "ограниченный": "restricted" };
const STATUS: Record<string, string> = { "опубликовано": "published", "черновик": "draft", "на модерации": "moderation" };
// значения справочников как в админке: из карточек + добавленные − убранные (сущности dict-<ключ>)
const DICT_TYPE: Record<string, string> = { mtype: "material", group: "person", placeType: "place", evType: "event", prType: "project", colType: "collection", orgType: "org", srcType: "source" };
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

// ---- шаблон: лист «Инструкция» + лист на каждый тип с подсказками и строкой-примером ----
export async function template(): Promise<Buffer> {
  const dicts = await dictValues();
  const wb = XLSX.utils.book_new();
  const instr = [
    ["Импорт в архив «Зотов» — как заполнять"],
    [""],
    ["1. Каждый лист — один тип карточек. Строка 1 — названия колонок (не менять), строка 2 — подсказки, строка 3 — пример (начинается с «ПРИМЕР», при загрузке пропускается). Свои данные — с 4-й строки."],
    ["2. «Название» обязательно. Если карточка с таким названием и типом уже есть в архиве, она обновится: заполненные ячейки перезапишут поля, пустые ничего не тронут."],
    ["3. Связи («Личности», «Места», «Темы»…) — названия через «;». Можно ссылаться на карточки архива и на строки этого же файла (на любом листе). Связи двусторонние: достаточно указать с одной стороны."],
    ["4. Типы и подтипы — из справочников (списки ниже). Новое значение добавится в справочник, в отчёте будет предупреждение."],
    ["5. Даты: год или диапазон «с–по» (1920–1929). Неточные даты задаются диапазоном: «1920-е» → 1920–1929. У личности — годы жизни, у проекта — даты проведения."],
    ["6. «Файлы» — имена файлов из папки через «;»: фото (JPG/PNG/WebP/TIFF), видео (MP4/WebM), аудио (MP3/M4A/WAV), документы (PDF). Первое фото строки станет обложкой. Папка выбирается в админке на втором шаге; из неё берутся только файлы, упомянутые в таблице."],
    ["   Подпись к файлу на сайте (название, автор, год) — через «|» после имени: cover.jpg | Обложка книги «Маяковский улыбается» | Александр Родченко | 1918. Все части необязательны; без названия файл подписывается названием карточки."],
    ["   Субтитры к видео и аудио — файлом рядом с тем же именем: film.mp4 → film.ru.srt, film.en.vtt (без языка = русский). В таблицу субтитры писать не нужно, они подхватятся сами."],
    ["   Требования: имена латиницей, без пробелов (rodchenko-01.jpg); одна папка без вложенных; имя уникально в папке; до 100 МБ на файл (длинное видео лучше сжать)."],
    ["7. «Доступ»: открытый (по умолчанию), по запросу, ограниченный. «Публикация»: опубликовано (по умолчанию) или черновик."],
    ["8. Перед записью админка показывает предпросмотр: что создастся, что обновится, какие связи не найдены. Ошибочные строки не загружаются, остальные — загружаются."],
    [""],
    ["Справочники (текущие значения):"],
  ];
  const DL: Record<string, string> = { mtype: "Типы материалов", group: "Типы личностей", placeType: "Типы мест", evType: "Типы событий", prType: "Типы проектов", colType: "Типы коллекций", orgType: "Типы организаций", srcType: "Типы текстов" };
  for (const [k, l] of Object.entries(DL)) instr.push([l + ": " + ((dicts[k] || []).join("; ") || "—")]);
  const ws0 = XLSX.utils.aoa_to_sheet(instr); ws0["!cols"] = [{ wch: 160 }];
  XLSX.utils.book_append_sheet(wb, ws0, "Инструкция");
  const EX: Record<string, Row> = {
    material: { title: "ПРИМЕР Афиша выставки «1927»", mtype: "Печатная продукция", subtype: "Афиша", date: "1927", "link:person": "Александр Родченко", "link:event": "Открытие выставки «1927»", "link:theme": "Конструктивизм", files: "afisha-1927.jpg | Афиша выставки | Александр Родченко | 1927; afisha-1927-back.jpg | Оборот афиши", desc: "Афиша к открытию выставки." },
    person: { title: "ПРИМЕР Александр Родченко", group: "Деятели эпохи", role: "художник, фотограф, дизайнер", life: "1891–1956", "link:place": "Дом Моссельпрома", files: "rodchenko.jpg" },
    place: { title: "ПРИМЕР Дом Моссельпрома", placeType: "Здание", subtype: "административное", city: "Москва", address: "Калашный пер., 2/10", placeStatus: "Существует", date: "1923–1925", lat: "55.7563", lon: "37.6010" },
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
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = cols.map((c) => ({ wch: c.key === "title" || c.key === "desc" ? 40 : c.key.startsWith("link:") ? 28 : 18 }));
    ws["!freeze"] = { xSplit: 1, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, ws, s.sheet);
  }
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

// ---- разбор файла ----
export type FileSpec = { name: string; caption?: string; author?: string; year?: string };
type Parsed = { type: string; sheet: string; row: number; title: string; fields: Record<string, string>; links: Record<string, string[]>; files: FileSpec[]; tags: string[]; access?: string; status?: string; dictKey?: string };
// «имя | название | автор | год» → спецификация файла
// «нет фото», «—» и прочие пометки кириллицей — не имена файлов
const parseFile = (v: string): FileSpec => { const [name0, caption, author, year] = v.split("|").map((x) => norm(x)); const name = /[а-яё]/i.test(name0) || name0 === "-" || name0 === "—" ? "" : name0; return { name, ...(caption ? { caption } : {}), ...(author ? { author } : {}), ...(year ? { year } : {}) }; };
// место: «да/yes/существует» → Существует, «снесён/нет/утрачен» → Утрачено; город из адреса «Москва, …» / «г. Москва, …»;
// авторы/функции/заказчики — списки (через «;», у авторов допускается «,»)
const CITY_RE = /^(?:г\.\s*)?([А-ЯЁ][а-яё\-]+(?:[ -][А-ЯЁ][а-яё\-]+)?)\s*[,.]\s*(.+)$/;
export function normalizePlace(p: { fields: Record<string, string>; title: string }) {
  const f = p.fields;
  if (f.placeStatus) { const k2 = key(f.placeStatus); f.placeStatus = /^(да|yes|существует|сохранил|есть)/.test(k2) ? "Существует" : /^(нет|no|снес|утрач|разруш|не сущ|уничтож)/.test(k2) ? "Утрачено" : f.placeStatus; }
  if (!f.city && f.address) { const m = f.address.match(CITY_RE); if (m) { f.city = m[1]; f.address = m[2].trim(); } }
  if (f.city && f.address) { const pre = new RegExp("^(?:г\\.\\s*)?" + f.city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*,\\s*", "i"); f.address = f.address.replace(pre, ""); }
  for (const k of ["functions", "authors", "customers"] as const) if (f[k]) (f as any)[k] = (k === "authors" ? f[k].split(/\s*[;,]\s*(?![^()]*\))/) : split(f[k])).map((x) => x.trim()).filter(Boolean);
  if (f.date) f.date = f.date.replace(/\.0$/, "").replace(/^(\d{4})\s*[-–—;,]\s*(\d{4})$/, "$1–$2");
  if (f.okn) { const k2 = key(f.okn); f.okn = k2.includes("федерал") ? "федерального значения" : k2.includes("регион") ? "регионального значения" : k2.includes("местн") ? "местного значения" : k2.includes("выявлен") ? "выявленный" : /лиш|исключ/.test(k2) ? "лишён статуса" : /без статуса|не является|нет/.test(k2) ? "не является ОКН" : f.okn; }
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
  authors: ["автор", "авторы", "архитектор", "архитекторы", "architects", "architect", "author", "authors"],
  customers: ["заказчик", "заказчики", "organisation", "организация-заказчик", "customer"],
  functions: ["функция", "функции", "назначение", "function"],
  placeType: ["тип", "type", "типология", "тип объекта", "тип места"], mtype: ["тип материала"], evType: ["тип события"], srcType: ["тип текста"], orgType: ["тип организации"], prType: ["тип проекта"], colType: ["тип коллекции"],
  subtype: ["подтип", "subtype"], group: ["тип личности", "группа"], role: ["роль", "сфера", "профессия", "деятельность"],
  author: ["автор текста"], publisher: ["издательство", "издатель"], pubplace: ["место издания"], curators: ["кураторы", "куратор"], def: ["определение", "краткое определение"],
  lat: ["широта", "lat", "latitude"], lon: ["долгота", "lon", "lng", "longitude"],
  files: ["файлы", "фото", "photo", "photos", "файл", "изображения", "images", "photo now", "photo hist", "id", "код", "индекс", "code"],
  tags: ["теги", "tags"], access: ["доступ"], status: ["публикация", "статус публикации"],
  "link:person": ["личности", "персоны", "люди", "persons", "people", "участники", "связанные личности"], "link:place": ["места", "связанные места", "связанные объекты", "id connections", "connections", "объекты"],
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
  return colsOf(sdef).map((c) => ({ key: c.key, label: c.label }));
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
export function inspect(buf: Buffer): Inspect {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheets: Inspect["sheets"] = [];
  for (const name of wb.SheetNames) {
    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" });
    const body = rows.filter((r) => r.some((c) => norm(c)));
    if (body.length < 2) continue;
    const headers = body[0].map((h) => norm(h));
    const sdef = SHEETS.find((x) => x.sheet === name);
    const template = !!sdef && headers.some((h) => key(h) === "название");
    const type = sdef ? sdef.type : guessType(name, headers);
    const sample = body.slice(1, 6).map((r) => headers.map((_, i) => norm(r[i]).slice(0, 80)));
    sheets.push({ name, headers, sample, rows: body.length - 1, template, guess: { type, cols: template ? {} : guessCols(type, headers) } });
  }
  const targets: Record<string, { key: string; label: string }[]> = {};
  for (const sdef of SHEETS) targets[sdef.type] = targetsOf(sdef.type);
  return { sheets, targets };
}
// перекладываем листы произвольной книги в книгу формата шаблона: несколько колонок в одно поле — дата склеивается «1926–1927», остальное через «; »
export function applyMapping(buf: Buffer, mapping: Mapping): Buffer {
  const wb = XLSX.read(buf, { type: "buffer" });
  const out = XLSX.utils.book_new();
  const byType: Record<string, string[][]> = {};
  for (const [name, m] of Object.entries(mapping)) {
    const ws = wb.Sheets[name]; const sdef = SHEETS.find((x) => x.type === m.type); if (!ws || !sdef) continue;
    const cols = colsOf(sdef);
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    const body = rows.filter((r) => r.some((c) => norm(c)));
    if (body.length < 2) continue;
    const headers = body[0].map((h) => norm(h));
    const tgt = byType[m.type] ||= [cols.map((c) => c.label)];
    // строки-подсказки под шапкой: пропускаем те, где нет ни одного «данного» значения (все ячейки — длинные пояснения) — проще: пропускаем строки, где название пустое
    for (const r of body.slice(1)) {
      const vals: Record<string, string[]> = {};
      headers.forEach((h, i) => { const k = m.cols[h]; const v = norm(r[i]); if (k && v) (vals[k] ||= []).push(v); });
      if (!vals.title?.length) continue;
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
  for (const [t, aoa] of Object.entries(byType)) { const sdef = SHEETS.find((x) => x.type === t)!; XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet(aoa), sdef.sheet); }
  return XLSX.write(out, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function parse(buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer" });
  const out: Parsed[] = []; const problems: string[] = [];
  for (const s of SHEETS) {
    const ws = wb.Sheets[s.sheet]; if (!ws) continue;
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    if (!rows.length) continue;
    const head = rows[0].map((h) => key(String(h)));
    const cols = colsOf(s);
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
      const p: Parsed = { type: s.type, sheet: s.sheet, row: r + 1, title, fields: {}, links: {}, files: split(get("Файлы")).map(parseFile).filter((f) => f.name), tags: split(get("Теги")) };
      for (const c of s.cols) { const v = get(c.label); if (v) p.fields[c.key] = v; if (c.dict) p.dictKey = c.key; }
      if (p.type === "place") normalizePlace(p);
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
export type PlanRow = { sheet: string; row: number; type: string; title: string; action: "create" | "update" | "error"; id?: string; links: number; files: FileSpec[]; notes: string[] };
// ненайденная связь: тип + название из таблицы, где встречается; решается в админке (выбрать карточку / создать / пропустить)
export type Unresolved = { key: string; type: string; name: string; rows: string[]; similar: { id: string; title: string }[] };
export type Plan = { rows: PlanRow[]; problems: string[]; creates: number; updates: number; errors: number; links: number; files: string[]; newDict: string[]; unresolved: Unresolved[] };
// решения по ненайденным: key → id карточки | "new" (создать карточку этого типа) | "" (пропустить связь)
export type Resolve = Record<string, string>;
async function buildPlan(buf: Buffer, resolve: Resolve = {}): Promise<{ plan: Plan; items: Parsed[]; byKey: Map<string, string>; dicts: Record<string, string[]> }> {
  const { items, problems } = parse(buf);
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
  for (const p of items) {
    const k = p.type + "|" + key(p.title);
    const notes: string[] = [];
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
    rows.push({ sheet: p.sheet, row: p.row, type: p.type, title: p.title, action, id: byKey.get(k), links: Object.values(p.links).flat().length, files: p.files, notes });
  }
  const plan: Plan = { rows, problems, creates: rows.filter((r) => r.action === "create").length, updates: rows.filter((r) => r.action === "update").length, errors: rows.filter((r) => r.action === "error").length, links, files: [...files], newDict: [...newDict], unresolved: [...unres.values()] };
  return { plan, items, byKey, dicts };
}
const withMap = (buf: Buffer, mapping?: Mapping | null) => (mapping && Object.keys(mapping).length ? applyMapping(buf, mapping) : buf);
export const preview = async (buf: Buffer, resolve: Resolve = {}, mapping?: Mapping | null) => (await buildPlan(withMap(buf, mapping), resolve)).plan;

// ---- запуск: сущности → справочники → связи; возвращает id по строкам (для заливки файлов из админки) ----
export async function run(buf: Buffer, actor: string, resolve: Resolve = {}, mapping?: Mapping | null, geocode?: (q: string) => Promise<{ lat: number; lon: number } | null>) {
  const { plan, items, byKey, dicts } = await buildPlan(withMap(buf, mapping), resolve);
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
