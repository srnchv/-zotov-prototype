import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import type { Server } from "node:http";

let server: Server, base: string;
const TOKEN = process.env.ADMIN_TOKEN || "dev-token";
const authed = { "content-type": "application/json", authorization: `Bearer ${TOKEN}` };

before(async () => {
  server = createApp().listen(0);
  const addr = server.address() as any;
  base = `http://127.0.0.1:${addr.port}`;
});
after(() => server.close());

test("health", async () => {
  const r = await fetch(`${base}/api/health`);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
});

test("list + filter by type", async () => {
  const r = await (await fetch(`${base}/api/entities?type=person`)).json();
  assert.ok(r.total >= 7);
  assert.ok(r.items.every((e: any) => e.type === "person"));
});

test("entity with bidirectional links", async () => {
  const rod = await (await fetch(`${base}/api/entities/p1`)).json();
  assert.equal(rod.title, "Александр Родченко");
  assert.ok(rod.links.length > 5);
  // обратная сторона: у события, ссылающегося на p1, в links есть p1
  const ev = await (await fetch(`${base}/api/entities/ev11`)).json();
  assert.ok(ev.links.some((l: any) => l.id === "p1"));
});

test("search finds direct and related (ТЗ 18)", async () => {
  const r = await (await fetch(`${base}/api/search?q=` + encodeURIComponent("Киноглаз"))).json();
  assert.ok(r.directCount >= 1);
  assert.ok(r.totalCount > r.directCount, "связанные объекты добавлены к выдаче");
  assert.ok(r.groups.person?.some((p: any) => p.title.includes("Вертов")), "Вертов найден через связь");
});

test("login: верные креды дают токен, неверные — 401", async () => {
  const ok = await fetch(`${base}/api/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ login: "admin", password: "zotov2026" }),
  });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).token, TOKEN);
  const bad = await fetch(`${base}/api/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ login: "admin", password: "нет" }),
  });
  assert.equal(bad.status, 401);
});

test("mutations require token", async () => {
  const r = await fetch(`${base}/api/entities`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "tag", title: "x" }),
  });
  assert.equal(r.status, 401);
});

test("create → link → visible from both sides → delete", async () => {
  const created = await (await fetch(`${base}/api/entities`, {
    method: "POST", headers: authed,
    body: JSON.stringify({ type: "event", title: "Тестовое событие", payload: { date: "1931", evType: "Тест" } }),
  })).json();
  assert.equal(created.type, "event");

  const linked = await fetch(`${base}/api/entities/${created.id}/links`, {
    method: "POST", headers: authed, body: JSON.stringify({ targetId: "p1" }),
  });
  assert.equal(linked.status, 201);

  const rod = await (await fetch(`${base}/api/entities/p1`)).json();
  assert.ok(rod.links.some((l: any) => l.id === created.id), "создано один раз — видно с обеих сторон");

  const del = await fetch(`${base}/api/entities/${created.id}`, { method: "DELETE", headers: authed });
  assert.equal(del.status, 204);
  const rod2 = await (await fetch(`${base}/api/entities/p1`)).json();
  assert.ok(!rod2.links.some((l: any) => l.id === created.id), "связи удалены каскадно");
});

test("media: сжатие фото в три производных webp", async () => {
  const sharp = (await import("sharp")).default;
  const { processImage } = await import("../src/media.js");
  const src = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 200, g: 40, b: 40 } } })
    .jpeg().toBuffer();
  const { renditions, width } = await processImage(src);
  assert.equal(width, 3000);
  const w = async (b: Buffer) => (await sharp(b).metadata()).width;
  assert.equal(await w(renditions.thumb), 400);
  assert.equal(await w(renditions.med), 1200);
  assert.equal(await w(renditions.big), 2560);
  assert.ok(renditions.big.length < src.length, "производная легче исходника");
});

test("media: без настроенного S3 загрузка отвечает 503", async () => {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }), "x.jpg");
  const r = await fetch(`${base}/api/media`, { method: "POST", headers: { authorization: `Bearer ${TOKEN}` }, body: form });
  assert.equal(r.status, 503);
});

test("dicts and stats", async () => {
  const d = await (await fetch(`${base}/api/dicts`)).json();
  assert.ok(d.materialTypes.includes("Видео"));
  assert.ok(d.eventTypes.includes("Премьера"));
  const s = await (await fetch(`${base}/api/stats`)).json();
  assert.ok(s.byType.event >= 50);
});
