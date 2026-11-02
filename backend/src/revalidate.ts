// Сброс кэша страниц сайта после изменений: фронт кэширует страницы (ISR), API после любого сохранения дёргает
// POST {FRONT_URL}/api/revalidate с секретом. Вызовы схлопываются (не чаще раза в 2 секунды), ошибки не мешают работе админки.
const FRONT_URL = (process.env.FRONT_URL || "").replace(/\/+$/, "");
const SECRET = process.env.REVALIDATE_SECRET || "";
let timer: NodeJS.Timeout | null = null, pending = false, lastOk = 0, lastErr = "";
export const revalidateState = () => ({ configured: !!(FRONT_URL && SECRET), lastOk, lastErr });
async function send() {
  pending = false;
  try {
    const r = await fetch(FRONT_URL + "/api/revalidate", { method: "POST", headers: { "x-revalidate-secret": SECRET }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    lastOk = Date.now(); lastErr = "";
  } catch (e: any) { lastErr = String(e?.message || e); console.warn("[revalidate] не удалось сбросить кэш сайта:", lastErr); }
}
export function notifyFront() {
  if (!FRONT_URL || !SECRET) return;
  pending = true;
  if (timer) return;
  timer = setTimeout(() => { timer = null; if (pending) void send(); }, 2000);
}
