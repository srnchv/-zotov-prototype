# Сборка API и Vue-админки (backend/admin) в одном образе: админка отдаётся по /admin тем же приложением
FROM node:22-alpine AS admin
WORKDIR /adm
COPY admin/package*.json ./
RUN npm ci
COPY admin .
RUN npm run build

FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production DB_PATH=/data/zotov.db
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=admin /adm/dist ./admin-dist
COPY seed ./seed
VOLUME /data
EXPOSE 3000
CMD ["node", "dist/index.js"]
