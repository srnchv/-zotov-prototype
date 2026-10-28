// Леттеринг секции (title-section/big): буквы Zotov Bold, разнесены по ширине; пробел — отдельный слот.
// Высота и кегль — по брейкпоинту (переменные --lt-* в globals.css: 120/137, 86/97, 64/57).
// h1 — заголовок страницы (поиск, разделы, хронограф, карта): тот же вид, но семантический H1 для поисковиков
export const Lettering = ({ text, cream, h1 }: { text: string; cream?: boolean; h1?: boolean }) => {
  const Tag = h1 ? "h1" : "div";
  return <Tag className={"lt" + (cream ? " cream" : "")}>{[...text].map((c, i) => <span key={i} className={c === " " ? "sp" : undefined}>{c}</span>)}</Tag>;
};
// Ссылка «Все …» под секцией (section-link): линия сверху 8, текст справа, кружок со стрелкой
// textM — подпись для планшета и мобайла, если отличается («Смотреть на карте» / «Все места»)
export const SectionLink = ({ href, text, textM }: { href: string; text: string; textM?: string }) => (
  <a className="slink" href={href}><span>{textM ? <><em className="td">{text}</em><em className="tm">{textM}</em></> : text}</span><i><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 7.2h9.25L7.54 3.5H9.5L14 8l-4.5 4.5H7.54l3.71-3.7H2V7.2Z" fill="#fff" /></svg></i></a>
);
