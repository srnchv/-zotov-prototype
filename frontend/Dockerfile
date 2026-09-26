# Публичная часть архива (Next.js, standalone). Деплой: Timeweb App Platform, Docker из подпапки frontend/
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_URL=https://srnchv-zotov-prototype-27ea.twc1.net/api
# сборщик Timeweb даёт мало памяти: ограничиваем кучу Node и параллельность, иначе next build молча убивается (OOM)
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1024
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
