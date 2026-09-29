"use client";
// Сцена внутренних страниц (материал, поиск): на десктопе фикс-колонки 1920 масштабируются под окно,
// правая часть скроллится; уже 1024 (планшет/мобайл по Figma 834/375) масштаб выключается —
// вёрстка перетекает в одну колонку обычными медиазапросами (класс html.mob).
import { useEffect } from "react";
export default function StageScale({ shift = 180 }: { shift?: number }) {
  useEffect(() => {
    const stage = document.getElementById("stage")!, rest = document.getElementById("rest")!, restWrap = document.getElementById("restWrap")!;
    function layout() {
      const mob = window.innerWidth < 1024;
      document.documentElement.classList.toggle("mob", mob);
      if (mob) {
        stage.style.cssText = ""; rest.style.cssText = ""; restWrap.style.cssText = "";
        const sb0 = document.getElementById("sidebar"); if (sb0) sb0.style.cssText = "";
        const rc0 = document.getElementById("rightcol"); if (rc0) rc0.style.cssText = "";
        return;
      }
      const k = window.innerWidth / 1920;
      const stageH = Math.max(900, window.innerHeight / k);
      stage.style.height = stageH + "px";
      const sb = document.getElementById("sidebar"); if (sb) sb.style.height = stageH + "px"; // «Войти» прибит к нижнему краю окна
      const rc = document.getElementById("rightcol"); if (rc) rc.style.minHeight = stageH + "px"; // «Похожее» не наезжает на навигацию слева
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
