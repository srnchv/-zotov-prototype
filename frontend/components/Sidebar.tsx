// Сайдбар по макету Figma HOME / left-menu (180×1180): логотип 148×96, мини-леттеринг «архив»,
// пункты с линией сверху 4px #e5e5e5, «Зотов Центр ↗», внизу кнопка «Войти». Один на все страницы.
const LETTERS = ["a", "r", "h", "i", "v"];
export const NAV = [
  ["поиск", "/search"], ["темы", "/cat/theme"], ["проекты центра", "/cat/project"], ["хронограф", "/chrono"],
  ["личности", "/cat/person"], ["карта", "/map"], ["коллекции", "/cat/collection"], ["тексты", "/texts"],
];
export const LOGIN_URL = "https://srnchv.github.io/-zotov-prototype/#/cabinet";
export const CENTER_URL = "https://zotov.center";
// логотип инлайном: на ховере красится в красный (fill: currentColor)
export const Logo = () => (
  <svg viewBox="0 0 136 88" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-label="Зотов"><path d="M49.8872 0H86.1128V7.99854H76.3023V88H59.7018V7.99854H49.8872V0Z"/><path d="M18.7296 0H45.7431V88H18.7296V0ZM25.8127 80.0015H34.3165V8.00256H25.8127V80.0015Z"/><path d="M90.2569 0H117.27V88H90.2569V0ZM101.688 80.0015H110.191V8.00256H101.688V80.0015Z"/><path d="M132.524 21.9748L129.369 40.0007H128.384V7.99854H132.528V21.9748H132.524ZM132.524 80.0015H128.38V48.0033H132.524V80.0015ZM123.328 0V88H136V39.9967H133.199L136 23.9996V0H123.328Z"/><path d="M12.6723 0H0V23.9996H3.4805V7.99854H7.62046V26.0285L3.4805 39.9967V48.0033H7.62046V80.0015H3.4805V64.0044H0V88H12.6723V39.9967H7.92577L12.6723 23.9996V0Z"/></svg>
);
export const ExtIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 2v1.5H3.5v9h9V10H14v4H2V2h4Zm8 0v5.5h-1.5V4.56L7.53 9.53 6.47 8.47l4.97-4.97H8.5V2H14Z" fill="#262626" /></svg>
);
export default function Sidebar({ variant = "home", active, centerUrl = CENTER_URL }: { variant?: "home" | "mat"; active?: string; centerUrl?: string }) {
  return (
    <aside id="sidebar" className="mat">
      <a className="logo" href="/"><Logo /></a>
      <div id="mini-arhiv" className={variant === "mat" ? "on" : undefined}>
        {LETTERS.map((l) => <img key={l} src={`/assets/letter-${l}.svg`} alt="" />)}
      </div>
      <nav id="menu" className="mat">
        {NAV.map(([t, h]) => <a key={t} href={h} className={active === h ? "active" : undefined}>{t}</a>)}
        <a className="mext" href={centerUrl} target="_blank" rel="noreferrer"><span>Центр «Зотов»</span><ExtIcon /></a>
      </nav>
      <a id="login-btn" href={LOGIN_URL}>Войти</a>
    </aside>
  );
}
