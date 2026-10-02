import { SITE_DEFAULTS, type Site } from "@/lib/site";
// Футер по макету Section 5: квадраты-баркоды (3 на широком десктопе, 2 на 1280/планшете, 1 на мобайле)
// и строка ссылок сеткой в 6 колонок: документы · соцсети · · · «Сделано в Charmer» · копирайт.
// Документы, соцсети и копирайт — из «Текстов сайта».
export default function Footer({ className = "", site = SITE_DEFAULTS }: { className?: string; site?: Site }) {
  const soc = [["vk", "ВКонтакте"], ["tg", "Телеграм"], ["yt", "YouTube"], ["dzen", "Дзен"]].filter(([k]) => site[k as keyof Site]);
  return (
    <footer className={"ft " + className}>
      <div className="bars">
        <img src="/assets/union-sq.svg" alt="" />
        <img src="/assets/union-sq.svg" alt="" />
        <img src="/assets/union-sq.svg" alt="" />
      </div>
      <div className="flinks">
        <div className="c1">
          <a href={site.privacyUrl || "#"}>Политика конфиденциальности</a>
          <a href={site.personalUrl || "#"}>Обработка персональных данных</a>
          <a href={site.offerUrl || "#"}>Публичная оферта</a>
        </div>
        <div className="c2">
          {soc.map(([k, l]) => <a key={k} href={site[k as keyof Site]} target="_blank" rel="noreferrer">{l}</a>)}
        </div>
        <div className="c5"><a href="https://charmer.design" target="_blank" rel="noreferrer">Сделано<br />в Charmer</a></div>
        <div className="c6">{site.copyright}</div>
      </div>
    </footer>
  );
}
