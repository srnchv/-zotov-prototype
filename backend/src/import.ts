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
  { key: "files", label: "Файлы", hint: "имена файлов из папки через «;», первый — обложка: rodchenko-01.jpg; rodchenko-02.jpg" },
  { key: "tags", label: "Теги", hint: "служебные теги через «;»" },
];
const LINK_COLS: [string, string][] = [["person", "Личности"], ["place", "Места"], ["event", "События"], ["theme", "Темы"], ["project", "Проекты Центра"], ["collection", "Коллекции"], ["org", "Организации"], ["material", "Материалы"], ["source", "Тексты"]];
const SHEETS: { type: string; sheet: string; cols: Col[]; dateKey: string }[] = [
  { type: "material", sheet: "Материалы", dateKey: "date", cols: [{ key: "mtype", label: "Тип", hint: "из справочника типов материалов", dict: "mtype" }, { key: "subtype", label: "Подтип", hint: "подтип выбранного типа" }, { key: "date", label: "Дата", hint: "год или диапазон: 1927 или 1920–1929" }] },
  { type: "person", sheet: "Личности", dateKey: "life", cols: [{ key: "group", label: "Тип личности", hint: "Конструктивисты / …", dict: "group" }, { key: "role", label: "Роль", hint: "художник, архитектор…" }, { key: "life", label: "Годы жизни", hint: "1891–1956" }] },
  { type: "place", sheet: "Места", dateKey: "date", cols: [{ key: "placeType", label: "Тип", hint: "из справочника типов мест", dict: "placeType" }, { key: "subtype", label: "Подтип", hint: "" }, { key: "city", label: "Город", hint: "" }, { key: "address", label: "Адрес", hint: "" }, { key: "placeStatus", label: "Состояние здания", hint: "существует / утрачено / реконструировано" }, { key: "date", label: "Дата", hint: "год постройки или диапазон" }, { key: "lat", label: "Широта", hint: "55.7563" }, { key: "lon", label: "Долгота", hint: "37.6010" }] },
  { type: "event", sheet: "События", dateKey: "date", cols: [{ key: "evType", label: "Тип", hint: "из справочника типов событий", dict: "evType" }, { key: "subtype", label: "Подтип", hint: "" }, { key: "date", label: "Дата", hint: "1927 или 12 марта 1927" }] },
  { type: "theme", sheet: "Темы", dateKey: "", cols: [{ key: "def", label: "Краткое определение", hint: "одна-две фразы" }] },
  { type: "project", sheet: "Проекты Центра", dateKey: "dates", cols: [{ key: "prType", label: "Тип", hint: "выставочный проект…", dict: "prType" }, { key: "dates", label: "Даты проведения", hint: "12.03–30.06.1927" }, { key: "curators", label: "Кураторы", hint: "" }] },
  { type: "collection", sheet: "Коллекции", dateKey: "period", cols: [{ key: "colType", label: "Тип коллекции", hint: "Открытое хранение / Личная коллекция", dict: "colType" }, { key: "period", label: "Период", hint: "1920-е" }] },
  { type: "org", sheet: "Организации", dateKey: "period", cols: [{ key: "orgType", label: "Тип", hint: "", dict: "orgType" }, { key: "period", label: "Период деятельности", hint: "1920 — 1930" }] },
  { type: "source", sheet: "Тексты", dateKey: "year", cols: [{ key: "srcType", label: "Тип текста", hint: "статья, рецензия, каталог…", dict: "srcType" }, { key: "year", label: "Год", hint: "год публикации" }, { key: "author", label: "Автор", hint: "" }, { key: "publisher", label: "Издательство", hint: "" }, { key: "pubplace", label: "Место издания", hint: "" }] },
];
const colsOf = (s: (typeof SHEETS)[number]): Col[] => [...COMMON_HEAD, ...s.cols, ...LINK_COLS.filter(([t]) => t !== s.type).map(([t, l]) => ({ key: "link:" + t, label: l, hint: "названия через «;» — карточки из архива или строки этого файла" })), ...COMMON_TAIL];
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
    ["6. «Файлы» — имена файлов из папки с фото через «;», первый файл станет обложкой. Папка выбирается в админке на втором шаге; из неё берутся только файлы, упомянутые в таблице."],
    ["   Требования к файлам: JPG/PNG/WebP/TIFF; имена — латиницей, без пробелов (rodchenko-01.jpg); одна папка без вложенных; имя уникально в папке; до 100 МБ на файл."],
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
    material: { title: "ПРИМЕР Афиша выставки «1927»", mtype: "Печатная продукция", subtype: "Афиша", date: "1927", "link:person": "Александр Родченко", "link:event": "Открытие выставки «1927»", "link:theme": "Конструктивизм", files: "afisha-1927.jpg", desc: "Афиша к открытию выставки." },
    person: { title: "ПРИМЕР Александр Родченко", group: "Конструктивисты", role: "художник, фотограф, дизайнер", life: "1891–1956", "link:place": "Дом Моссельпрома", files: "rodchenko.jpg" },
    place: { title: "ПРИМЕР Дом Моссельпрома", placeType: "Здание", subtype: "административное", city: "Москва", address: "Калашный пер., 2/10", placeStatus: "существует", date: "1923–1925", lat: "55.7563", lon: "37.6010" },
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
type Parsed = { type: string; sheet: string; row: number; title: string; fields: Record<string, string>; links: Record<string, string[]>; files: string[]; tags: string[]; access?: string; status?: string; dictKey?: string };
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
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]; const get = (label: string) => { const i = idx(label); return i < 0 ? "" : norm(row[i]); };
      const title = get("Название");
      if (!title) continue;
      if (r === 1 && title === cols[0].hint) continue; // строка подсказок
      if (title.toUpperCase().startsWith(EXAMPLE)) continue;
      const p: Parsed = { type: s.type, sheet: s.sheet, row: r + 1, title, fields: {}, links: {}, files: split(get("Файлы")), tags: split(get("Теги")) };
      for (const c of s.cols) { const v = get(c.label); if (v) p.fields[c.key] = v; if (c.dict) p.dictKey = c.key; }
      const d = get("Описание"); if (d) p.fields.desc = d;
      const acc = key(get("Доступ")); if (acc) { if (ACCESS[acc]) p.access = ACCESS[acc]; else problems.push(`${s.sheet}, строка ${r + 1}: неизвестный доступ «${get("Доступ")}»`); }
      const st = key(get("Публикация")); if (st) { if (STATUS[st]) p.status = STATUS[st]; else problems.push(`${s.sheet}, строка ${r + 1}: неизвестная публикация «${get("Публикация")}»`); }
      for (const [t, l] of LINK_COLS) if (t !== s.type) { const v = split(get(l)); if (v.length) p.links[t] = v; }
      out.push(p);
    }
  }
  return { items: out, problems };
}

// ---- план: что создастся, что обновится, какие связи найдены ----
export type PlanRow = { sheet: string; row: number; type: string; title: string; action: "create" | "update" | "error"; id?: string; links: number; files: string[]; notes: string[] };
export type Plan = { rows: PlanRow[]; problems: string[]; creates: number; updates: number; errors: number; links: number; files: string[]; newDict: string[] };
async function buildPlan(buf: Buffer): Promise<{ plan: Plan; items: Parsed[]; byKey: Map<string, string>; dicts: Record<string, string[]> }> {
  const { items, problems } = parse(buf);
  const { entities } = await repo.exportAll();
  const byKey = new Map<string, string>(); // type|title → id существующей карточки
  for (const e of entities) if (e.type !== "media" && e.type !== "dict") byKey.set(e.type + "|" + key(e.title), e.id);
  const inFile = new Set(items.map((p) => p.type + "|" + key(p.title)));
  const dicts = await dictValues();
  const newDict = new Set<string>();
  const rows: PlanRow[] = []; const files = new Set<string>(); let links = 0;
  const seen = new Set<string>();
  for (const p of items) {
    const k = p.type + "|" + key(p.title);
    const notes: string[] = [];
    let action: PlanRow["action"] = byKey.has(k) ? "update" : "create";
    if (seen.has(k)) { action = "error"; notes.push("дубль: такое название уже есть выше в файле"); }
    seen.add(k);
    for (const [t, names] of Object.entries(p.links)) for (const n of names) {
      const lk = t + "|" + key(n);
      if (byKey.has(lk) || inFile.has(lk)) links++;
      else { action = "error"; notes.push(`не найдено: ${LINK_COLS.find(([x]) => x === t)?.[1]} → «${n}» (нет ни в архиве, ни в файле)`); }
    }
    if (p.dictKey && p.fields[p.dictKey]) { const v = p.fields[p.dictKey]; const have = (dicts[p.dictKey] || []).some((x) => key(x) === key(v)); if (!have) { newDict.add(`${p.dictKey}:${v}`); notes.push(`новое значение справочника «${v}» — добавится`); } }
    for (const f of p.files) files.add(f);
    rows.push({ sheet: p.sheet, row: p.row, type: p.type, title: p.title, action, id: byKey.get(k), links: Object.values(p.links).flat().length, files: p.files, notes });
  }
  const plan: Plan = { rows, problems, creates: rows.filter((r) => r.action === "create").length, updates: rows.filter((r) => r.action === "update").length, errors: rows.filter((r) => r.action === "error").length, links, files: [...files], newDict: [...newDict] };
  return { plan, items, byKey, dicts };
}
export const preview = async (buf: Buffer) => (await buildPlan(buf)).plan;

// ---- запуск: сущности → справочники → связи; возвращает id по строкам (для заливки файлов из админки) ----
export async function run(buf: Buffer, actor: string) {
  const { plan, items, byKey, dicts } = await buildPlan(buf);
  const okRows = plan.rows.filter((r) => r.action !== "error");
  const ids = new Map<string, string>(byKey);
  const result: { sheet: string; row: number; title: string; id: string; action: string; files: string[] }[] = [];
  // 1. карточки
  for (const r of okRows) {
    const p = items.find((x) => x.sheet === r.sheet && x.row === r.row)!;
    const k = p.type + "|" + key(p.title);
    const payload: Record<string, unknown> = { ...p.fields };
    if (p.access) payload.access = p.access;
    if (p.type === "place" && p.fields.placeType && p.fields.subtype && !String(p.fields.placeType).includes(" · ")) payload.placeType = p.fields.placeType + " · " + p.fields.subtype;
    let id = ids.get(k);
    if (id) { await repo.updateEntity(id, { payload, ...(p.status ? { status: p.status } : {}) }); await repo.logAct("update", id, p.title, actor + " · импорт"); }
    else { const e = await repo.createEntity({ type: p.type, title: p.title, status: p.status || "published", payload }); id = e.id; ids.set(k, id); await repo.logAct("create", id, p.title, actor + " · импорт"); }
    result.push({ sheet: r.sheet, row: r.row, title: p.title, id, action: r.action, files: p.files });
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
  return { created: okRows.filter((r) => r.action === "create").length, updated: okRows.filter((r) => r.action === "update").length, skipped: plan.errors, linked, rows: result };
}
