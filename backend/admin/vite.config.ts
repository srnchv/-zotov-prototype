import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
// Админка раздаётся API-приложением по /admin; в dev — прокси на локальный бэкенд
export default defineConfig({
  plugins: [vue()],
  base: "/admin/",
  server: { port: 5173, proxy: { "/api": "http://localhost:3000" } },
  build: { outDir: "dist", emptyOutDir: true },
});
