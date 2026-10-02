// Леттеринг секции (title-section/big): буквы Zotov Bold, разнесены по ширине; пробел — отдельный слот.
// Высота и кегль — по брейкпоинту (переменные --lt-* в globals.css: 120/137, 86/97, 64/57).
export const Lettering = ({ text, cream }: { text: string; cream?: boolean }) => (
  <div className={"lt" + (cream ? " cream" : "")}>{[...text].map((c, i) => <span key={i} className={c === " " ? "sp" : undefined}>{c}</span>)}</div>
);
// Ссылка «Все …» под секцией (section-link): линия сверху 8, текст справа, кружок со стрелкой
export const SectionLink = ({ href, text }: { href: string; text: string }) => (
  <a className="slink" href={href}><span>{text}</span><i><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 7.2h9.25L7.54 3.5H9.5L14 8l-4.5 4.5H7.54l3.71-3.7H2V7.2Z" fill="#fff" /></svg></i></a>
);
