// Сайдбар по макету Figma «MENU»: логотип, мини-«АРХИВ», вертикальная колонка пунктов 172px, «Зотов.Центр →» внизу.
// Один компонент для всех страниц; на главной мини-«АРХИВ» появляется, когда большой леттеринг уехал.
const LETTERS = ["a", "r", "h", "i", "v"];
export const NAV = [
  ["поиск", "/search"], ["темы", "/cat/theme"], ["хронограф", "/chrono"], ["карта", "/map"],
  ["личности", "/cat/person"], ["коллекции", "/cat/collection"], ["проекты центра", "/cat/project"], ["тексты", "/texts"],
  ["войти", "https://srnchv.github.io/-zotov-prototype/#/cabinet"],
];
export default function Sidebar({ variant = "home", active }: { variant?: "home" | "mat"; active?: string }) {
  return (
    <aside id="sidebar" className="mat">
      <a className="logo" href="/"><img src="/assets/logo-zotov.svg" alt="Зотов" /></a>
      <div id="mini-arhiv" className={variant === "mat" ? "on" : undefined}>
        {LETTERS.map((l) => <img key={l} src={`/assets/letter-${l}.svg`} alt="" />)}
      </div>
      <nav id="menu" className="mat">
        {NAV.map(([t, h]) => <a key={t} href={h} className={active === h ? "active" : undefined}>{t}</a>)}
      </nav>
      <a id="center-link" href="https://zotov.center" target="_blank" rel="noreferrer"><span>Зотов.Центр</span><span>→</span></a>
    </aside>
  );
}
