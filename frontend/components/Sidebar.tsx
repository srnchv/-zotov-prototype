// Сайдбар из вёрстки: логотип, мини-«АРХИВ» (появляется, когда большой уехал), меню, соцсети
const LETTERS = ["a", "r", "h", "i", "v"];
export const NAV = [
  ["каталог", "/search"], ["темы", "/cat/theme"], ["хронограф", "/chrono"], ["карта", "/map"],
  ["личности", "/cat/person"], ["коллекции", "/cat/collection"], ["проекты", "/cat/project"], ["тексты", "/texts"],
];
export default function Sidebar({ variant = "home", active }: { variant?: "home" | "mat"; active?: string }) {
  return (
    <aside id="sidebar" className={variant === "mat" ? "mat" : undefined}>
      <a className="logo" href="/"><img src="/assets/logo-zotov.svg" alt="Зотов" /></a>
      <div id="mini-arhiv" className={variant === "mat" ? "on" : undefined}>
        {LETTERS.map((l) => <img key={l} src={`/assets/letter-${l}.svg`} alt="" />)}
      </div>
      <nav id="menu">
        {NAV.map(([t, h]) => (
          <span key={t}><div className="rule" /><a href={h} className={active === h ? "active" : undefined}>{t}</a></span>
        ))}
        <div className="rule" />
      </nav>
      <div id="soc"><span>VK</span><span>TG</span></div>
    </aside>
  );
}
