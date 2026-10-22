import express from "express";
import cors from "cors";
import multer from "multer";
import { z } from "zod";
import * as repo from "./repo.js";
import * as media from "./media.js";
import * as users from "./users.js";
import path from "node:path";
import os from "node:os";
import { unlink } from "node:fs/promises";
import { existsSync } from "node:fs";

// Express 4 не ловит исключения из async-обработчиков — оборачиваем
const ah = (fn: (req: express.Request, res: express.Response) => Promise<unknown>): express.RequestHandler =>
  (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  // Авторизация: сессионный токен пользователя (роли admin / editor / moderator) либо служебный ADMIN_TOKEN (скрипты, интеграции).
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "dev-token";
  type Who = { uid: string; role: users.Role; name: string };
  const whoIs = (req: express.Request): Who | null => {
    const h = String(req.headers.authorization || "");
    if (!h.startsWith("Bearer ")) return null;
    const t = h.slice(7);
    if (t === ADMIN_TOKEN) return { uid: "api", role: "admin", name: "API" };
    return users.verifyToken(t);
  };
  const auth: express.RequestHandler = (req, res, next) => {
    const w = whoIs(req);
    if (!w) return res.status(401).json({ error: "unauthorized" });
    (req as any).who = w;
    // модератор меняет только статус публикации, остальное — чтение
    if (w.role === "moderator" && req.method !== "GET") {
      const onlyStatus = req.method === "PATCH" && /^\/api\/entities\/[^/]+$/.test(req.path) && Object.keys(req.body || {}).every((k) => k === "status");
      if (!onlyStatus) return res.status(403).json({ error: "forbidden" });
    }
    next();
  };
  const adminOnly: express.RequestHandler = (req, res, next) => {
    const w = whoIs(req);
    if (!w) return res.status(401).json({ error: "unauthorized" });
    if (w.role !== "admin") return res.status(403).json({ error: "forbidden" });
    (req as any).who = w; next();
  };

  // Вход: логин/пароль → токен на 30 дней
  app.post("/api/login", ah(async (req, res) => {
    const { login, password } = z.object({ login: z.string(), password: z.string() }).parse(req.body);
    const u = await users.findByLogin(login);
    if (!u || !Number(u.active) || !users.checkPassword(password, u.pass_hash)) return res.status(401).json({ error: "bad credentials" });
    await users.touchLogin(u.id);
    res.json({ token: users.issueToken(u), name: u.name, role: u.role, id: u.id });
  }));
  app.get("/api/me", ah(async (req, res) => {
    const w = whoIs(req);
    if (!w) return res.status(401).json({ error: "unauthorized" });
    res.json(w);
  }));
  // Пользователи — только администратор
  const userBody = z.object({ login: z.string().min(2).max(64), name: z.string().max(120).default(""), role: z.enum(["admin", "editor", "moderator"]), password: z.string().min(6).max(200) });
  app.get("/api/users", adminOnly, ah(async (_req, res) => res.json(await users.listUsers())));
  app.post("/api/users", adminOnly, ah(async (req, res) => {
    const b = userBody.parse(req.body);
    if (await users.findByLogin(b.login)) return res.status(409).json({ error: "login taken" });
    res.status(201).json(await users.createUser(b));
  }));
  app.patch("/api/users/:id", adminOnly, ah(async (req, res) => {
    const b = userBody.partial().extend({ active: z.boolean().optional() }).parse(req.body);
    const id = String(req.params.id), me = (req as any).who as Who;
    const cur = await users.getUser(id);
    if (!cur) return res.status(404).json({ error: "not found" });
    // нельзя оставить систему без активного администратора
    if (cur.role === "admin" && ((b.role && b.role !== "admin") || b.active === false) && (await users.countAdmins()) <= 1) return res.status(400).json({ error: "last admin" });
    if (b.login && b.login !== cur.login && (await users.findByLogin(b.login))) return res.status(409).json({ error: "login taken" });
    if (me.uid === id && b.role && b.role !== "admin") return res.status(400).json({ error: "self demote" });
    res.json(await users.updateUser(id, b));
  }));
  app.delete("/api/users/:id", adminOnly, ah(async (req, res) => {
    const id = String(req.params.id), me = (req as any).who as Who;
    if (me.uid === id) return res.status(400).json({ error: "self delete" });
    const cur = await users.getUser(id);
    if (cur?.role === "admin" && (await users.countAdmins()) <= 1) return res.status(400).json({ error: "last admin" });
    if (!(await users.deleteUser(id))) return res.status(404).json({ error: "not found" });
    res.status(204).end();
  }));

  // имя для журнала: пользователь сессии; для служебного токена — заголовок x-editor (uri-encoded)
  const actor = (req: express.Request) => {
    const w = (req as any).who as Who | undefined;
    if (w && w.uid !== "api") return w.name || w.uid;
    try { return decodeURIComponent(String(req.headers["x-editor"] || "")) || "API"; } catch { return "API"; }
  };

  // Vue-админка: собранная статика отдаётся тем же приложением по /admin (SPA — любой путь → index.html)
  const adminDir = process.env.ADMIN_DIR || path.resolve(process.cwd(), "admin-dist");
  if (existsSync(adminDir)) {
    app.use("/admin", express.static(adminDir, { index: "index.html", maxAge: "1h" }));
    app.get(/^\/admin(\/.*)?$/, (_req, res) => res.sendFile(path.join(adminDir, "index.html")));
  }

  app.get("/api/health", (_req, res) => res.json({ ok: true, version: "0.4.0" }));
  // публичная конфигурация для фронта и админки: ключ Яндекс Карт JavaScript API (привязан к доменам, секретом не является)
  // ymapsV3 — ключ открыт для JavaScript API 3.0 (YANDEX_JS_V3=1): фронт включает векторную карту со стилями дизайнера; иначе 2.1
  app.get("/api/config", (_req, res) => res.json({ ymapsKey: process.env.YANDEX_JS_KEY || "", ymapsV3: process.env.YANDEX_JS_V3 === "1" }));
  // геосаджест Яндекса — подсказки адреса при вводе (ключ тоже только на сервере)
  app.get("/api/suggest", auth, ah(async (req, res) => {
    const key = process.env.YANDEX_SUGGEST_KEY;
    if (!key) return res.json([]);
    const { q } = z.object({ q: z.string().min(2).max(200) }).parse(req.query);
    const u = new URL("https://suggest-maps.yandex.ru/v1/suggest");
    u.searchParams.set("apikey", key); u.searchParams.set("text", q); u.searchParams.set("lang", "ru"); u.searchParams.set("results", "7"); u.searchParams.set("print_address", "1"); u.searchParams.set("types", "geo");
    const r = await fetch(u, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return res.json([]);
    const j: any = await r.json();
    res.json((j?.results || []).map((x: any) => ({ title: x.title?.text || "", subtitle: x.subtitle?.text || "", address: x.address?.formatted_address || [x.title?.text, x.subtitle?.text].filter(Boolean).join(", ") })));
  }));
  // геокодер Яндекса — через бэкенд, ключ наружу не уходит: ?q=адрес (прямой) или ?ll=долгота,широта (обратный)
  app.get("/api/geo", auth, ah(async (req, res) => {
    const key = process.env.YANDEX_GEOCODER_KEY;
    if (!key) return res.status(503).json({ error: "geocoder not configured" });
    const { q, ll } = z.object({ q: z.string().max(300).optional(), ll: z.string().max(60).optional() }).parse(req.query);
    if (!q && !ll) return res.status(400).json({ error: "q or ll required" });
    const u = new URL("https://geocode-maps.yandex.ru/1.x/");
    u.searchParams.set("apikey", key); u.searchParams.set("format", "json"); u.searchParams.set("results", "6"); u.searchParams.set("lang", "ru_RU");
    u.searchParams.set("geocode", q || String(ll));
    // Referer — на случай, если у ключа включено ограничение по доменам (серверный запрос его не несёт)
    const r = await fetch(u, { signal: AbortSignal.timeout(8000), headers: { referer: "https://" + (req.get("host") || "") + "/" } });
    if (!r.ok) {
      // текст ошибки Яндекса, чтобы было понятно: ключ не тот, продукт не подключён или лимит
      let msg = ""; try { const e: any = await r.json(); msg = e?.message || e?.error?.message || e?.statusCode || ""; } catch {}
      return res.status(502).json({ error: `geocoder: HTTP ${r.status}${msg ? " — " + msg : ""} (ключ …${key.slice(-4)})` });
    }
    const j: any = await r.json();
    const items = (j?.response?.GeoObjectCollection?.featureMember || []).map((f: any) => {
      const g = f.GeoObject, [lon, lat] = String(g.Point?.pos || "").split(" ").map(Number);
      return { name: g.name, text: g.metaDataProperty?.GeocoderMetaData?.text || g.description || g.name, kind: g.metaDataProperty?.GeocoderMetaData?.kind, precision: g.metaDataProperty?.GeocoderMetaData?.precision, lat, lon };
    }).filter((x: any) => Number.isFinite(x.lat) && Number.isFinite(x.lon));
    res.json(items);
  }));
  app.get("/api/stats", ah(async (_req, res) => res.json(await repo.stats())));
  app.get("/api/dicts", ah(async (_req, res) => res.json(await repo.dicts())));
  // ключ оригинала в хранилище — служебное поле, наружу не уходит (оригиналы только через /api/media/:id/file)
  const hideOrig = (e: any) => { if (e && e.type === "media" && "origKey" in e) { const { origKey: _o, ...rest } = e; return rest; } return e; };
  const isStaff = (req: express.Request) => !!whoIs(req);
  app.get("/api/export", ah(async (req, res) => { const d = await repo.exportAll(); res.json(isStaff(req) ? d : { ...d, entities: d.entities.map(hideOrig) }); }));

  app.get("/api/entities", ah(async (req, res) => {
    const query = z.object({
      type: z.string().optional(),
      q: z.string().optional(),
      status: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    }).parse(req.query);
    const r = await repo.listEntities(query);
    res.json(isStaff(req) ? r : { ...r, items: r.items.map(hideOrig) });
  }));

  // пересборка медиатеки: закрыть оригиналы, пересчитать копии (водяной знак, ≤1600) — администратор
  app.post("/api/media/reprocess", adminOnly, ah(async (_req, res) => {
    if (!media.mediaEnabled()) return res.status(503).json({ error: "storage not configured" });
    const log: string[] = [];
    const r = await media.reprocessAll((m) => log.push(m));
    res.json({ ...r, log: log.slice(0, 50) });
  }));

  app.get("/api/entities/:id", ah(async (req, res) => {
    const e = await repo.getEntity(String(req.params.id));
    if (!e) return res.status(404).json({ error: "not found" });
    res.json(isStaff(req) ? e : { ...hideOrig(e), links: e.links.map(hideOrig) });
  }));

  const entityBody = z.object({
    id: z.string().min(1).max(64).optional(),
    type: z.enum(["material","person","place","event","theme","project","org","collection","source","media","tag","dict"]),
    title: z.string().min(1).max(500),
    status: z.enum(["draft","moderation","published"]).optional(),
    payload: z.record(z.unknown()).optional(),
    links: z.array(z.string()).optional(),
  });

  app.post("/api/entities", auth, ah(async (req, res) => {
    const body = entityBody.parse(req.body);
    const e = await repo.createEntity(body);
    await repo.logAct("create", e.id, e.title, actor(req));
    res.status(201).json(e);
  }));

  app.patch("/api/entities/:id", auth, ah(async (req, res) => {
    const body = entityBody.partial().parse(req.body);
    const e = await repo.updateEntity(String(req.params.id), body);
    if (!e) return res.status(404).json({ error: "not found" });
    await repo.logAct("update", e.id, e.title, actor(req));
    res.json(e);
  }));

  app.delete("/api/entities/:id", auth, ah(async (req, res) => {
    const id = String(req.params.id);
    const e = await repo.getEntity(id);
    if (media.mediaEnabled()) await media.deleteMediaFiles(id); // для media-сущностей подчищаем файлы
    if (!(await repo.deleteEntity(id))) return res.status(404).json({ error: "not found" });
    await repo.logAct("delete", id, e?.title || "", actor(req));
    res.status(204).end();
  }));

  app.post("/api/entities/:id/links", auth, ah(async (req, res) => {
    const { targetId } = z.object({ targetId: z.string() }).parse(req.body);
    const e = await repo.getEntity(String(req.params.id));
    if (!e || !(await repo.getEntity(targetId)))
      return res.status(404).json({ error: "entity not found" });
    await repo.addLink(String(req.params.id), targetId);
    await repo.logAct("link", e.id, e.title, actor(req));
    res.status(201).json(await repo.getEntity(String(req.params.id)));
  }));

  app.delete("/api/entities/:id/links/:targetId", auth, ah(async (req, res) => {
    if (!(await repo.removeLink(String(req.params.id), String(req.params.targetId))))
      return res.status(404).json({ error: "link not found" });
    const e = await repo.getEntity(String(req.params.id));
    await repo.logAct("unlink", String(req.params.id), e?.title || "", actor(req));
    res.status(204).end();
  }));

  // просмотр публичной страницы: считаем популярность, updated_at не меняется
  app.post("/api/entities/:id/view", ah(async (req, res) => {
    if (!(await repo.bumpViews(String(req.params.id)))) return res.status(404).json({ error: "not found" });
    res.status(204).end();
  }));

  // хит посещаемости с публичной части: анонимный id браузера + устройство
  app.post("/api/hit", ah(async (req, res) => {
    const { visitor, device, path } = z.object({
      visitor: z.string().min(1).max(40), device: z.string().max(30).optional(), path: z.string().max(120).optional(),
    }).parse(req.body);
    await repo.addHit(visitor, device || "", path || "");
    res.status(204).end();
  }));

  app.get("/api/statistics", auth, async (_req, res) => {
    try { res.json(await repo.statistics()); }
    catch (e: any) {
      console.error("statistics failed:", e);
      res.status(500).json({ error: "statistics: " + (e?.message || "failed") });
    }
  });

  // журнал: последние действия + сводка по сущностям (кто менял последним, сколько правок)
  app.get("/api/audit", auth, ah(async (_req, res) => {
    res.json({ recent: await repo.auditRecent(100), summary: await repo.auditSummary() });
  }));

  app.get("/api/entities/:id/audit", auth, ah(async (req, res) => {
    res.json(await repo.auditFor(String(req.params.id)));
  }));

  app.get("/api/search", ah(async (req, res) => {
    const { q } = z.object({ q: z.string().min(1) }).parse(req.query);
    res.json(await repo.search(q));
  }));

  // ---- Медиа: загрузка с генерацией сжатых производных, оригинал — только по подписанной ссылке ----
  // multer/busboy читают имя файла как latin1 — кириллица превращается в «Ð»Ð¸Ñ…». Перекодируем обратно в UTF-8.
  const fixName = (n: string) => { try { const u = Buffer.from(n, "latin1").toString("utf8"); return u.includes("\uFFFD") ? n : u; } catch { return n; } };
  const fixFile: express.RequestHandler = (req, _res, next) => { const f = (req as any).file; if (f?.originalname) f.originalname = fixName(f.originalname); next(); };
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

  // ассеты сайта: PNG/SVG иллюстраций → публичный URL (администратор)
  app.post("/api/assets", adminOnly, upload.single("file"), fixFile, ah(async (req, res) => {
    if (!media.mediaEnabled()) return res.status(503).json({ error: "storage not configured" });
    if (!req.file) return res.status(400).json({ error: "no file" });
    const { name } = z.object({ name: z.string().min(1).max(120) }).parse(req.body);
    res.status(201).json({ url: await media.putAsset(name, req.file.buffer) });
  }));

  // 3D-тур папкой (гигабайты): start → файлы по одному (параллельно из браузера) → finish с путём к index.html
  app.post("/api/tours/start", auth, ah(async (req, res) => {
    if (!media.mediaEnabled()) return res.status(503).json({ error: "storage not configured" });
    const { entityId, title } = z.object({ entityId: z.string().optional(), title: z.string().max(300).optional() }).parse(req.body);
    const m = await media.tourStart({ entityId, title: title?.trim() || "3D-тур" });
    res.status(201).json(m);
  }));
  app.get("/api/tours/:id/files", auth, ah(async (req, res) => res.json(await media.tourFiles(String(req.params.id)))));
  app.post("/api/tours/:id/file", auth, upload.single("file"), fixFile, ah(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "no file" });
    const { path: rel } = z.object({ path: z.string().min(1).max(500) }).parse(req.body);
    res.json(await media.tourPutFile(String(req.params.id), rel, req.file.buffer));
  }));
  app.post("/api/tours/:id/finish", auth, ah(async (req, res) => {
    const { index, files, size } = z.object({ index: z.string().min(1), files: z.number().int().optional(), size: z.number().optional() }).parse(req.body);
    const m = await media.tourFinish(String(req.params.id), index, files || 0, size || 0);
    await repo.logAct("media", m?.parent ? String(m.parent) : String(req.params.id), m?.title || "3D-тур", actor(req));
    res.json(m);
  }));

  // 3D-тур пакетом: ZIP (до 2 ГБ) пишется во временный файл, распаковывается прямо в S3; на выходе — медиа kind=tour
  const uploadZip = multer({ storage: multer.diskStorage({ destination: os.tmpdir() }), limits: { fileSize: 2 * 1024 * 1024 * 1024 } });
  app.post("/api/tours", auth, uploadZip.single("file"), fixFile, async (req, res) => {
    const tmp = req.file?.path;
    try {
      if (!media.mediaEnabled()) return res.status(503).json({ error: "storage not configured" });
      if (!req.file || !tmp) return res.status(400).json({ error: "no file" });
      const { entityId, title } = z.object({ entityId: z.string().optional(), title: z.string().max(300).optional() }).parse(req.body);
      const m = await media.uploadTourZip({ zipPath: tmp, entityId, title: title?.trim() || req.file.originalname.replace(/\.zip$/i, "") || "3D-тур" });
      await repo.logAct("media", entityId || m.id, m.title, actor(req));
      res.status(201).json(m);
    } catch (e: any) {
      console.error("tour upload failed:", e);
      res.status(502).json({ error: "tour: " + (e?.message || "upload failed") });
    } finally { if (tmp) unlink(tmp).catch(() => {}); }
  });

  app.post("/api/media", auth, upload.single("file"), fixFile, async (req, res) => {
    try {
      if (!media.mediaEnabled()) return res.status(503).json({ error: "storage not configured" });
      if (!req.file) return res.status(400).json({ error: "no file" });
      const { entityId } = z.object({ entityId: z.string().optional() }).parse(req.body);
      const m = await media.uploadMedia({
        entityId, filename: req.file.originalname, mime: req.file.mimetype, buffer: req.file.buffer,
      });
      await repo.logAct("media", entityId || m.id, m.title, actor(req));
      res.status(201).json(m);
    } catch (e: any) {
      console.error("media upload failed:", e);
      res.status(502).json({ error: "storage: " + (e?.message || "upload failed") });
    }
  });

  app.get("/api/media-selftest", auth, ah(async (_req, res) => {
    if (!media.mediaEnabled()) return res.status(503).json({ error: "storage not configured" });
    res.json(await media.selftest());
  }));

  // файл целиком через бэкенд (для читалки PDF и плееров): Range поддерживается
  app.get("/api/media/:id/file", ah(async (req, res) => {
    if (!media.mediaEnabled()) return res.status(503).json({ error: "storage not configured" });
    const m = await repo.getEntity(String(req.params.id));
    if (!m || m.type !== "media") return res.status(404).json({ error: "not found" });
    // доступ «по запросу» / ограниченный — только владельцам токена (личный кабинет появится позже)
    const parent = m.parent ? await repo.getEntity(String(m.parent)) : null;
    const access = String((parent?.access ?? m.access) || "open");
    if (access !== "open" && !whoIs(req)) return res.status(403).json({ error: "access restricted" });
    // оригиналы изображений наружу не отдаём вообще: сайту хватает копий ≤1600 (видео/аудио/PDF стримятся для плеера)
    if (String(m.kind) === "image" && !whoIs(req)) return res.status(403).json({ error: "originals are not public" });
    const s = await media.streamOriginal(m.id, req.headers.range as string | undefined);
    if (!s) return res.status(404).json({ error: "not found" });
    res.status(s.status).set(s.headers);
    s.body.pipe(res);
  }));

  // субтитры к видео/аудио: .vtt или .srt (конвертируем), язык — в поле lang
  app.post("/api/media/:id/subtitles", auth, upload.single("file"), fixFile, ah(async (req, res) => {
    if (!media.mediaEnabled()) return res.status(503).json({ error: "storage not configured" });
    if (!req.file) return res.status(400).json({ error: "no file" });
    const { lang, label } = z.object({ lang: z.string().optional(), label: z.string().optional() }).parse(req.body);
    const m = await media.addSubtitles(String(req.params.id), { filename: req.file.originalname, buffer: req.file.buffer, lang, label });
    if (!m) return res.status(404).json({ error: "not found" });
    await repo.logAct("media", m.id, m.title, actor(req));
    res.status(201).json(m);
  }));
  app.delete("/api/media/:id/subtitles/:lang", auth, ah(async (req, res) => {
    const m = await media.removeSubtitles(String(req.params.id), String(req.params.lang));
    if (!m) return res.status(404).json({ error: "not found" });
    res.json(m);
  }));

  app.get("/api/media/:id/original", ah(async (req, res) => {
    if (!media.mediaEnabled()) return res.status(503).json({ error: "storage not configured" });
    // ttl — для плееров публичной части (до суток); закрытые материалы — только редактору
    const ttl = Math.min(86400, Math.max(60, Number(req.query.ttl) || 600));
    const m = await repo.getEntity(String(req.params.id));
    if (!m || m.type !== "media") return res.status(404).json({ error: "not found" });
    const parent = m.parent ? await repo.getEntity(String(m.parent)) : null;
    const access = String((parent?.access ?? m.access) || "open");
    if (access !== "open" && req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) return res.status(403).json({ error: "access restricted" });
    const url = await media.originalUrl(m.id, ttl);
    if (!url) return res.status(404).json({ error: "not found" });
    res.json({ url, expiresIn: ttl });
  }));

  // единый обработчик ошибок (в т.ч. zod)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.name === "ZodError") return res.status(400).json({ error: "validation", issues: err.issues });
    console.error(err);
    res.status(500).json({ error: "internal" });
  });

  return app;
}
