"use client";
// Простая версия сцены для внутренних страниц (материал): фикс-колонки масштабируются, правая часть скроллится
import { useEffect } from "react";
export default function StageScale({ shift = 180 }: { shift?: number }) {
  useEffect(() => {
    const stage = document.getElementById("stage")!, rest = document.getElementById("rest")!, restWrap = document.getElementById("restWrap")!;
    function layout() {
      const k = window.innerWidth / 1920;
      const stageH = Math.max(900, window.innerHeight / k);
      stage.style.height = stageH + "px";
      stage.style.transform = `scale(${k})`;
      rest.style.transform = `translateX(${shift * k}px) scale(${k})`;
      restWrap.style.height = rest.offsetHeight * k + "px";
    }
    window.addEventListener("resize", layout);
    document.fonts?.ready.then(layout);
    layout();
    const t = setTimeout(layout, 300);
    return () => { window.removeEventListener("resize", layout); clearTimeout(t); };
  }, [shift]);
  return null;
}
