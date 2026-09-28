import express from "express";
import cors from "cors";
import multer from "multer";
import { z } from "zod";
import * as repo from "./repo.js";
import * as media from "./media.js";

// Express 4 не ловит исключения из async-обработчиков — оборачиваем
const ah = (fn: (req: express.Request, res: express.Response) => Promise<unknown>): express.RequestHandler =>
  (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  // Мутации — только с токеном (тестовый стенд; в проде — полноценная авторизация и роли).
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "dev-token";
  const auth: express.RequestHandler = (req, res, next) => {
    if (req.headers.authorization === `Bearer ${ADMIN_TOKEN}`) return next();
    res.status(401).json({ error: "unauthorized" });
  };

  // Вход в админку: логин/пароль → ключ редактора (тестовый стенд; в проде — сессии и роли).
  const ADMIN_LOGIN = process.env.ADMIN_LOGIN || "admin";
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "zotov2026";
  app.post("/api/login", (req, res) => {
    const { login, password } = z.object({ login: z.string(), password: z.string() }).parse(req.body);
    if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD)
      return res.json({ token: ADMIN_TOKEN, name: "Тестовый администратор", role: "editor" });
    res.status(401).json({ error: "bad credentials" });
  });

  // имя редактора для журнала: фронт шлёт в заголовке (uri-encoded, т.к. кириллица)
  const actor = (req: express.Request) => {
    try { return decodeURIComponent(String(req.headers["x-editor"] || "")); } catch { return ""; }
  };

  app.get("/api/health", (_req, res) => res.json({ ok: true, version: "0.3.0" }));
  app.get("/api/stats", ah(async (_req, res) => res.json(await repo.stats())));
  app.get("/api/dicts", ah(async (_req, res) => res.json(await repo.dicts())));
  app.get("/api/export", ah(async (_req, res) => res.json(await repo.exportAll())));

  app.get("/api/entities", ah(async (req, res) => {
    const query = z.object({
      type: z.string().optional(),
      q: z.string().optional(),
      status: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    }).parse(req.query);
    res.json(await repo.listEntities(query));
  }));

  app.get("/api/entities/:id", ah(async (req, res) => {
    const e = await repo.getEntity(String(req.params.id));
    if (!e) return res.status(404).json({ error: "not found" });
    res.json(e);
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
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

  app.post("/api/media", auth, upload.single("file"), async (req, res) => {
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
    if (access !== "open" && req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) return res.status(403).json({ error: "access restricted" });
    const s = await media.streamOriginal(m.id, req.headers.range as string | undefined);
    if (!s) return res.status(404).json({ error: "not found" });
    res.status(s.status).set(s.headers);
    s.body.pipe(res);
  }));

  // субтитры к видео/аудио: .vtt или .srt (конвертируем), язык — в поле lang
  app.post("/api/media/:id/subtitles", auth, upload.single("file"), ah(async (req, res) => {
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
