import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone", // компактный образ для Timeweb App Platform
  images: { unoptimized: true }, // картинки с S3 и из public — без прокси-оптимизации
  productionBrowserSourceMaps: false,
  // защитные заголовки (CSP — на прокси при переезде, с учётом Яндекс Карт, шрифтов и S3)
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    ] }];
  },
  experimental: { cpus: 1, workerThreads: false }, // сборка в один поток — под лимит памяти билдера Timeweb
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "https://srnchv-zotov-prototype-27ea.twc1.net/api",
  },
};
export default config;
