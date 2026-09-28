import { SITE_DEFAULTS, type Site } from "@/lib/site";
// Футер: баркод, ссылки на документы, соцсети и копирайт — из «Текстов сайта»
export default function Footer({ className = "", site = SITE_DEFAULTS }: { className?: string; site?: Site }) {
  const soc = [["vk", "ВКонтакте"], ["tg", "Telegram"], ["yt", "YouTube"], ["dzen", "Дзен"]].filter(([k]) => site[k as keyof Site]);
  return (
    <div className={"foot " + className}>
      <img src="/assets/footer.png" alt="" />
      <div className="flinks">
        <a href={site.privacyUrl || "#"}>Политика конфиденциальности</a>
        <a href={site.personalUrl || "#"}>Обработка персональных данных</a>
        <a href={site.offerUrl || "#"}>Публичная оферта</a>
        {soc.map(([k, l]) => <a key={k} href={site[k as keyof Site]} target="_blank" rel="noreferrer">{l}</a>)}
        <span className="cop">{site.copyright}</span>
      </div>
    </div>
  );
}
