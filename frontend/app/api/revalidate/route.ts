import { revalidateTag, revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
// Сброс кэша страниц по сигналу из API (после любого сохранения в админке). Секрет — REVALIDATE_SECRET, одинаковый у API и фронта.
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return NextResponse.json({ error: "REVALIDATE_SECRET not set" }, { status: 503 });
  if (req.headers.get("x-revalidate-secret") !== secret) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  revalidateTag("archive");
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
