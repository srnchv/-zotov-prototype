// Чтение и запись .xlsx через exceljs (вместо xlsx/SheetJS 0.18 с незакрытыми уязвимостями).
// Наружу — только то, что нужно импорту: книга как список листов со строками строк и запись книги из массивов.
import ExcelJS from "exceljs";

export type Book = { names: string[]; sheets: Record<string, string[][]> };

// значение ячейки → строка: формулы — результат, ссылки — текст, rich text — склейка, даты — ISO-дата, числа — без хвоста .0
function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === "boolean") return v ? "да" : "нет";
  if (v instanceof Date) return isNaN(+v) ? "" : v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as any;
    if (Array.isArray(o.richText)) return o.richText.map((r: any) => r.text || "").join("");
    if ("result" in o) return cellText(o.result);
    if ("text" in o) return cellText(o.text);
    if ("error" in o) return "";
  }
  return String(v);
}

export async function readBook(buf: Buffer): Promise<Book> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const names: string[] = []; const sheets: Record<string, string[][]> = {};
  wb.eachSheet((ws) => {
    const rows: string[][] = [];
    const maxCol = ws.columnCount || 0;
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const line: string[] = [];
      for (let c = 1; c <= Math.max(maxCol, row.cellCount); c++) line.push(cellText(row.getCell(c).value));
      rows[n - 1] = line;
    });
    for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
    names.push(ws.name); sheets[ws.name] = rows;
  });
  return { names, sheets };
}

export async function writeBook(sheets: { name: string; aoa: string[][]; widths?: number[] }[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31));
    for (const r of s.aoa) ws.addRow(r);
    if (s.widths) s.widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    ws.getRow(1).font = { bold: true };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
