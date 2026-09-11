# Zotov Archive API — тестовый бэкенд (v0.1)

API цифрового архива Центра «Зотов»: сущности 11 типов, двусторонние связи
«многие-ко-многим», поиск по названиям и связям (ТЗ разд. 18), справочники.
Данные засеваются из клик-прототипа (105 сущностей, ~200 связей).

## Стек
Node 22 · TypeScript · Express · zod · встроенный SQLite (`node:sqlite`) — без
нативных зависимостей, стенд поднимается одним процессом. Слой БД изолирован в
`src/db.ts` + `src/repo.ts`; продовая замена на PostgreSQL (по смете) — переписывание
только этого слоя, схема переносится 1:1 (payload → JSONB).

## Запуск локально
```bash
npm install
npm run seed     # наполняет ./data/zotov.db данными прототипа
npm run dev      # http://localhost:3000
npm test
```

## API
| Метод | Путь | Что делает |
|---|---|---|
| GET | /api/health | статус |
| GET | /api/stats | счётчики по типам, число связей |
| GET | /api/dicts | справочники (типы материалов/событий/источников, доступ, статусы) |
| GET | /api/entities?type=&q=&status=&limit=&offset= | список с фильтрами |
| GET | /api/entities/:id | сущность + все связи (двусторонне) |
| POST | /api/entities | создать `{type,title,payload,links[]}` 🔒 |
| PATCH | /api/entities/:id | изменить 🔒 |
| DELETE | /api/entities/:id | удалить (связи каскадно) 🔒 |
| POST | /api/entities/:id/links `{targetId}` | связать 🔒 |
| DELETE | /api/entities/:id/links/:targetId | развязать 🔒 |
| GET | /api/search?q= | поиск: прямые совпадения + связанные, группировка по типам |

🔒 — заголовок `Authorization: Bearer <ADMIN_TOKEN>` (по умолчанию `dev-token`).

## Переменные окружения
`PORT` (3000) · `DB_PATH` (./data/zotov.db) · `ADMIN_TOKEN` (dev-token — на стенде сменить!)

## Деплой на тестовый хостинг
Docker-образ самодостаточен (`Dockerfile`), БД — файл в volume `/data`, при первом
старте сидится автоматически. Подходит любой хостинг с Docker и volume:
- **Timeweb Cloud / Amvera** (РФ-карты): «приложение из Git» → каталог `backend/`, Dockerfile подхватится.
- **Railway / Render**: New Service → repo, Root Directory = `backend`.
Обязательно задать `ADMIN_TOKEN` в переменных окружения стенда.

## Что дальше (план разработки)
- [ ] PostgreSQL-адаптер (pg) + миграции
- [ ] Роли и пользователи (сейчас один служебный токен)
- [ ] Заявки на доступ (модерация) как API
- [ ] Загрузка медиа (S3-совместимое хранилище)
- [ ] Подключение прототипа/админки к API вместо статических данных
