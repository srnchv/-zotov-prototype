// Сайдбар по макету Figma HOME / left-menu (180×1180): логотип 148×96, мини-леттеринг «архив»,
// пункты с линией сверху 4px #e5e5e5, «Зотов Центр ↗», внизу кнопка «Войти». Один на все страницы.
const LETTERS = ["a", "r", "h", "i", "v"];
export const NAV = [
  ["поиск", "/search"], ["темы", "/cat/theme"], ["проекты центра", "/cat/project"], ["хронограф", "/chrono"],
  ["личности", "/cat/person"], ["карта", "/map"], ["коллекции", "/cat/collection"], ["тексты", "/texts"],
];
export const LOGIN_URL = "https://srnchv.github.io/-zotov-prototype/#/cabinet";
export const CENTER_URL = "https://zotov.center";
export const ExtIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 2v1.5H3.5v9h9V10H14v4H2V2h4Zm8 0v5.5h-1.5V4.56L7.53 9.53 6.47 8.47l4.97-4.97H8.5V2H14Z" fill="#262626" /></svg>
);
export default function Sidebar({ variant = "home", active, centerUrl = CENTER_URL }: { variant?: "home" | "mat"; active?: string; centerUrl?: string }) {
  return (
    <aside id="sidebar" className="mat">
      <a className="logo" href="/"><img src="/assets/logo-zotov.svg" alt="Зотов" /></a>
      <div id="mini-arhiv" className={variant === "mat" ? "on" : undefined}>
        {LETTERS.map((l) => <img key={l} src={`/assets/letter-${l}.svg`} alt="" />)}
      </div>
      <nav id="menu" className="mat">
        {NAV.map(([t, h]) => <a key={t} href={h} className={active === h ? "active" : undefined}>{t}</a>)}
        <a className="sec" href={centerUrl} target="_blank" rel="noreferrer"><span>Зотов Центр</span><ExtIcon /></a>
      </nav>
      <a id="login-btn" href={LOGIN_URL}>Войти</a>
    </aside>
  );
}
