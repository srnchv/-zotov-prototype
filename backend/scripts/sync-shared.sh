#!/bin/sh
# Копирует чистую логику поиска/хронографа/карты с фронта в API (backend/src/shared): один источник правил для сайта и сервера.
# Запускать после правок frontend/lib/{core,search,chrono,map}.ts; результат коммитится.
set -e
cd "$(dirname "$0")/.."
for f in core search chrono map; do
  sed -E 's#from "\./(core|search|chrono|map)"#from "./\1.js"#g' "../frontend/lib/$f.ts" > "src/shared/$f.ts"
done
echo "shared synced: core search chrono map"
