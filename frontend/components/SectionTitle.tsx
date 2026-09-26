// Заголовок-леттеринг: буквы Zotov Bold растянуты по ширине, справа круг со стрелкой (как buildTitle в вёрстке)
export default function SectionTitle({ text, href, small }: { text: string; href?: string; small?: boolean }) {
  const chars = [...text];
  const Arrow = (
    <svg width={small ? 16 : 24} height={small ? 16 : 24} viewBox="0 0 16 16" fill="none">
      <path d="M2 7.2002H11.25L7.53906 3.5H9.5L14 8L9.5 12.5H7.53906L11.25 8.7998H2V7.2002Z" fill="white" />
    </svg>
  );
  return (
    <div className={"sec-title" + (small ? " sm" : "")}>
      {chars.map((c, i) => c === " " ? <span key={i} className="ch sp"> </span> : <span key={i} className="ch">{c}</span>)}
      {href ? <a className="circle" href={href} aria-label={text}>{Arrow}</a> : <div className="circle">{Arrow}</div>}
    </div>
  );
}
