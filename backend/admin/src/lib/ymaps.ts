// Яндекс Карты JavaScript API 3.0: ключ приходит с бэкенда (/api/config), скрипт грузится один раз
import { api } from "./store";
let p: Promise<any> | null = null;
export function loadYmaps(): Promise<any> {
  if (p) return p;
  p = (async () => {
    const { ymapsKey } = await api<{ ymapsKey: string }>("/config");
    if (!ymapsKey) throw new Error("Ключ Яндекс Карт не задан на сервере");
    await new Promise<void>((res, rej) => { const s = document.createElement("script"); s.src = `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(ymapsKey)}&lang=ru_RU`; s.onload = () => res(); s.onerror = () => rej(new Error("Карта не загрузилась — проверьте домен в настройках ключа")); document.head.appendChild(s); });
    const y = (window as any).ymaps3; await y.ready; return y;
  })();
  p.catch(() => { p = null; });
  return p;
}
