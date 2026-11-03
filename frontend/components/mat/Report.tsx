"use client";
// «Напишите нам, если нашли несоответствие» (ТЗ): красная ссылка → окно «В тексте ошибка?», поле, кнопка «Отправить» (неактивна, пока пусто).
// Без входа; скрытое поле-ловушка; после отправки — текст в том же окне. Сообщение уходит в админку и письмом, если почта настроена.
import { useState } from "react";
import Modal from "./Modal";
import { API } from "@/lib/api";
const Arr = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 7.2h9.25L7.54 3.5H9.5L14 8l-4.5 4.5H7.54l3.71-3.7H2V7.2Z" fill="currentColor" /></svg>;
export default function Report({ id }: { id: string }) {
  const [open, setOpen] = useState(false), [text, setText] = useState(""), [hp, setHp] = useState(""), [state, setState] = useState<"" | "busy" | "done" | "err">("");
  const close = () => { setOpen(false); setState(""); setText(""); };
  async function send() {
    if (text.trim().length < 5 || state === "busy") return;
    setState("busy");
    try {
      const r = await fetch(`${API}/report`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, text: text.trim(), website: hp }) });
      setState(r.ok ? "done" : "err");
    } catch { setState("err"); }
  }
  return (
    <>
      <div className="reportrow"><button type="button" className="report" onClick={() => setOpen(true)}><span>Напишите нам, если нашли несоответствие</span><Arr /></button></div>
      {open ? <Modal onClose={close} className="err">
        {state === "done" ? <div className="para"><h4>Спасибо, сообщение отправлено</h4><p>Мы проверим и поправим карточку.</p></div> : <>
          <div className="para"><h4>В тексте ошибка?</h4><p>Расскажите подробнее, в чём неточность.</p></div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Что не так?" maxLength={4000} />
          <input className="hp" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} name="website" aria-hidden="true" />
          {state === "err" ? <div className="errmsg">Не получилось отправить — попробуйте ещё раз чуть позже.</div> : null}
          <button type="button" className="send" disabled={text.trim().length < 5 || state === "busy"} onClick={send}><span>{state === "busy" ? "Отправляем…" : "Отправить"}</span><Arr /></button>
        </>}
      </Modal> : null}
    </>
  );
}
