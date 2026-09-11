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

  app.get("/api/health", (_req, res) => res.json({ ok: true, version: "0.2.0" }));
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
    type: z.enum(["material","person","place","event","theme","project","org","collection","source","media","tag"]),
    title: z.string().min(1).max(500),
    status: z.enum(["draft","moderation","published"]).optional(),
    payload: z.record(z.unknown()).optional(),
    links: z.array(z.string()).optional(),
  });

  app.post("/api/entities", auth, ah(async (req, res) => {
    const body = entityBody.parse(req.body);
    res.status(201).json(await repo.createEntity(body));
  }));

  app.patch("/api/entities/:id", auth, ah(async (req, res) => {
    const body = entityBody.partial().parse(req.body);
    const e = await repo.updateEntity(String(req.params.id), body);
    if (!e) return res.status(404).json({ error: "not found" });
    res.json(e);
  }));

  app.delete("/api/entities/:id", auth, ah(async (req, res) => {
    const id = String(req.params.id);
    if (media.mediaEnabled()) await media.deleteMediaFiles(id); // для media-сущностей подчищаем файлы
    if (!(await repo.deleteEntity(id))) return res.status(404).json({ error: "not found" });
    res.status(204).end();
  }));

  app.post("/api/entities/:id/links", auth, ah(async (req, res) => {
    const { targetId } = z.object({ targetId: z.string() }).parse(req.body);
    if (!(await repo.getEntity(String(req.params.id))) || !(await repo.getEntity(targetId)))
      return res.status(404).json({ error: "entity not found" });
    await repo.addLink(String(req.params.id), targetId);
    res.status(201).json(await repo.getEntity(String(req.params.id)));
  }));

  app.delete("/api/entities/:id/links/:targetId", auth, ah(async (req, res) => {
    if (!(await repo.removeLink(String(req.params.id), String(req.params.targetId))))
      return res.status(404).json({ error: "link not found" });
    res.status(204).end();
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

  app.get("/api/media/:id/original", ah(async (req, res) => {
    if (!media.mediaEnabled()) return res.status(503).json({ error: "storage not configured" });
    const url = await media.originalUrl(String(req.params.id));
    if (!url) return res.status(404).json({ error: "not found" });
    res.json({ url, expiresIn: 600 });
  }));

  // единый обработчик ошибок (в т.ч. zod)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.name === "ZodError") return res.status(400).json({ error: "validation", issues: err.issues });
    console.error(err);
    res.status(500).json({ error: "internal" });
  });

  return app;
}
