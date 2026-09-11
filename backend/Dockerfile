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
COPY seed ./seed
VOLUME /data
EXPOSE 3000
# первый запуск: если БД пустая — сидим данными прототипа
CMD ["sh", "-c", "node -e \"const {db}=await import('./dist/db.js');const c=db.prepare('SELECT count(*) c FROM entities').get().c;if(!c){await import('./dist/seed.js')}\" --input-type=module && node dist/index.js"]
