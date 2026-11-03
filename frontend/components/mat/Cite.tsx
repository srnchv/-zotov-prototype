"use client";
// «Цитировать» (ТЗ): плашка с четырьмя форматами — ГОСТ, MLA, APA, Wiki (порядок по макету); цитаты собираются из полей карточки,
// дата обращения — сегодняшняя. Кнопка: на десктопе с подписью, в плашке навигации — только иконка.
import { useState } from "react";
import Modal from "./Modal";
export type CiteData = { authors: string[]; title: string; year: string; url: string };
const Quote = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 9.5V6.3C2 4 3.3 2.6 5.8 2.2l.4 1.2c-1.4.4-2.1 1.2-2.2 2.6H6v3.5H2Zm7 0V6.3c0-2.3 1.3-3.7 3.8-4.1l.4 1.2c-1.4.4-2.1 1.2-2.2 2.6H14v3.5H9Z" fill="currentColor" /></svg>;
function formats(d: CiteData, date: string) {
  const a = d.authors.join(", "), aGost = d.authors.join(", "), yr = d.year ? d.year : "б. г.";
  return [
    ["ГОСТ", `${aGost ? aGost + " " : ""}${d.title}${d.year ? ". " + d.year : ""} // Архив Центра «Зотов». URL: ${d.url} (дата обращения: ${date}).`],
    ["MLA", `${a ? a + ". " : ""}"${d.title}." Архив Центра «Зотов»${d.year ? ", " + d.year : ""}, ${d.url}. Дата обращения ${date}.`],
    ["APA", `${a ? a + " " : ""}(${yr}). ${d.title}. Архив Центра «Зотов». ${d.url}`],
    ["Wiki", `{{cite web|${a ? "author=" + a + "|" : ""}title=${d.title}|website=Архив Центра «Зотов»${d.year ? "|date=" + d.year : ""}|url=${d.url}|access-date=${date}}}`],
  ] as [string, string][];
}
export default function Cite({ data, icon }: { data: CiteData; icon?: boolean }) {
  const [open, setOpen] = useState(false);
  const date = new Date().toLocaleDateString("ru-RU");
  return (
    <>
      <button type="button" className={"abtn" + (icon ? " ico" : "")} onClick={() => setOpen(true)} aria-label="Цитировать" title="Цитировать"><Quote />{icon ? null : <span>Цитировать</span>}</button>
      {open ? <Modal onClose={() => setOpen(false)} className="cite">
        {formats(data, date).map(([k, v]) => <div className="crow" key={k}><div className="k">{k}</div><div className="v">{v}</div></div>)}
      </Modal> : null}
    </>
  );
}
