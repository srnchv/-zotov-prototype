"use client";
// Скролл-хореография главной — 1:1 из main-page/index.html:
// сцена 1920 масштабируется под окно; АРХИВ сжимается, приезжает баркод, поиск и темы докуются,
// затем герой уезжает и появляется скроллящийся контент. На CSS scroll-driven animations, JS — фолбэк.
import { useEffect } from "react";

export default function HomeChoreo() {
  useEffect(() => {
    const DESIGN_W = 1920, D1 = 800;
    const WORD_W0 = 1716, WORD_W1 = 856, BAR_W1 = 856, SEARCH_Y1 = 460, THEMES_Y1 = 548, COMPACT_H = 676, WORD_BOTTOM = 328;
    let D2 = 500, D = D1 + D2, HERO_H = 1080, THEMES_Y0 = 944, SEARCH_Y0 = 618, k = 1;
    const $ = (id: string) => document.getElementById(id)!;
    const stage = $("stage"), hero = $("hero"), word = $("word"), barcode = $("barcode"), search = $("search"),
      themes = $("themes"), mini = $("mini-arhiv"), space = $("scrollspace"), restWrap = $("restWrap"), rest = $("rest"), sidebar = $("sidebar");
    const NATIVE = CSS.supports("animation-timeline", "scroll()");
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    function update() {
      const S = window.scrollY / k, off = Math.max(0, S - D);
      if (!NATIVE) {
        const p1 = clamp(S / D1 || 1, 0, 1), s2 = clamp(S - D1, 0, D2);
        word.style.width = lerp(WORD_W0, WORD_W1, p1) + "px";
        barcode.style.width = BAR_W1 * p1 + "px";
        search.style.transform = `translateY(${-Math.min(s2, SEARCH_Y0 - SEARCH_Y1)}px)`;
        themes.style.transform = `translateY(${-s2}px)`;
        hero.style.transform = `translateY(${-off}px)`;
      }
      mini.classList.toggle("on", off > WORD_BOTTOM);
    }
    function layout() {
      k = window.innerWidth / DESIGN_W;
      HERO_H = Math.max(900, window.innerHeight / k);
      THEMES_Y0 = HERO_H - 148; SEARCH_Y0 = THEMES_Y0 - 232;
      D2 = THEMES_Y0 - THEMES_Y1; D = D1 + D2;
      stage.style.height = HERO_H + "px"; sidebar.style.height = HERO_H + "px"; hero.style.height = HERO_H + "px";
      stage.style.transform = `scale(${k})`;
      space.style.height = (COMPACT_H + D) * k + "px";
      rest.style.transform = `translateX(${180 * k}px) scale(${k})`;
      restWrap.style.height = rest.offsetHeight * k + "px";
      search.style.top = SEARCH_Y0 + "px"; themes.style.top = THEMES_Y0 + "px";
      const r = document.documentElement.style;
      r.setProperty("--aEnd", D1 * k + "px"); r.setProperty("--bStart", D1 * k + "px");
      r.setProperty("--bEndS", (D1 + (SEARCH_Y0 - SEARCH_Y1)) * k + "px"); r.setProperty("--bEnd", D * k + "px");
      r.setProperty("--cStart", D * k + "px"); r.setProperty("--cEnd", (D + HERO_H) * k + "px");
      r.setProperty("--dockShiftS", -(SEARCH_Y0 - SEARCH_Y1) + "px"); r.setProperty("--dockShiftT", -(THEMES_Y0 - THEMES_Y1) + "px");
      r.setProperty("--heroShift", -HERO_H + "px");
      update();
    }
    let ticking = false;
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { update(); ticking = false; }); } };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", layout);
    document.fonts?.ready.then(layout);
    layout();
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", layout); };
  }, []);
  return null;
}
