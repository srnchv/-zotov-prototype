import express from "express";
import cors from "cors";
import multer from "multer";
import { z } from "zod";
import * as repo from "./repo.js";
import * as media from "./media.js";

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

  app.get("/api/health", (_req, res) => res.json({ ok: true, version: "0.1.0" }));
  app.get("/api/stats", (_req, res) => res.json(repo.stats()));
  app.get("/api/dicts", (_req, res) => res.json(repo.dicts()));
  app.get("/api/export", (_req, res) => res.json(repo.exportAll()));

  app.get("/api/entities", (req, res) => {
    const q = z.object({
      type: z.string().optional(),
      q: z.string().optional(),
      status: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    }).parse(req.query);
    res.json(repo.listEntities(q));
  });

  app.get("/api/entities/:id", (req, res) => {
    const e = repo.getEntity(String(req.params.id));
    if (!e) return res.status(404).json({ error: "not found" });
    res.json(e);
  });

  const entityBody = z.object({
    id: z.string().min(1).max(64).optional(),
    type: z.enum(["material","person","place","event","theme","project","org","collection","source","media","tag"]),
    title: z.string().min(1).max(500),
    status: z.enum(["draft","moderation","published"]).optional(),
    payload: z.record(z.unknown()).optional(),
    links: z.array(z.string()).optional(),
  });

  app.post("/api/entities", auth, (req, res) => {
    const body = entityBody.parse(req.body);
    res.status(201).json(repo.createEntity(body));
  });

  app.patch("/api/entities/:id", auth, (req, res) => {
    const body = entityBody.partial().parse(req.body);
    const e = repo.updateEntity(String(req.params.id), body);
    if (!e) return res.status(404).json({ error: "not found" });
    res.json(e);
  });

  app.delete("/api/entities/:id", auth, async (req, res) => {
    const id = String(req.params.id);
    if (media.mediaEnabled()) await media.deleteMediaFiles(id); // для media-сущностей подчищаем файлы
    if (!repo.deleteEntity(id)) return res.status(404).json({ error: "not found" });
    res.status(204).end();
  });

  // ---- Медиа: загрузка с генерацией сжатых производных, оригинал — только по подписанной ссылке ----
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

  app.post("/api/media", auth, upload.single("file"), async (req, res, next) => {
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

  app.get("/api/media/:id/original", async (req, res, next) => {
    try {
      if (!media.mediaEnabled()) return res.status(503).json({ error: "storage not configured" });
      const url = await media.originalUrl(String(req.params.id));
      if (!url) return res.status(404).json({ error: "not found" });
      res.json({ url, expiresIn: 600 });
    } catch (e) { next(e); }
  });

  app.post("/api/entities/:id/links", auth, (req, res) => {
    const { targetId } = z.object({ targetId: z.string() }).parse(req.body);
    if (!repo.getEntity(String(req.params.id)) || !repo.getEntity(targetId))
      return res.status(404).json({ error: "entity not found" });
    repo.addLink(String(req.params.id), targetId);
    res.status(201).json(repo.getEntity(String(req.params.id)));
  });

  app.delete("/api/entities/:id/links/:targetId", auth, (req, res) => {
    if (!repo.removeLink(String(req.params.id), String(req.params.targetId)))
      return res.status(404).json({ error: "link not found" });
    res.status(204).end();
  });

  app.get("/api/search", (req, res) => {
    const { q } = z.object({ q: z.string().min(1) }).parse(req.query);
    res.json(repo.search(q));
  });

  // единый обработчик ошибок (в т.ч. zod)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.name === "ZodError") return res.status(400).json({ error: "validation", issues: err.issues });
    console.error(err);
    res.status(500).json({ error: "internal" });
  });

  return app;
}
