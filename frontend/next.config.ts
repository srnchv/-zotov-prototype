import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone", // компактный образ для Timeweb App Platform
  images: { unoptimized: true }, // картинки с S3 и из public — без прокси-оптимизации
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "https://srnchv-zotov-prototype-27ea.twc1.net/api",
  },
};
export default config;
