"use client";
// Описание (ТЗ «Единый шаблон»): форматированный HTML, сноски [n] раскрываются попапом по клику (повторный клик / клик вне — закрывает),
// текст длиннее 2000 знаков показывается началом с кнопкой «Раскрыть» → «Свернуть».
import { useEffect, useRef, useState } from "react";
export default function Description({ html, head, cut, notes }: { html: string; head: string; cut: boolean; notes: string[] }) {
  const [open, setOpen] = useState(false);
  const [fn, setFn] = useState<{ n: number; x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current; if (!root) return;
    const onClick = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest?.(".fn") as HTMLElement | null;
      if (t && root.contains(t)) {
        const n = Number(t.dataset.fn || 0);
        if (fn && fn.n === n) { setFn(null); return; }
        const r = t.getBoundingClientRect(), rr = root.getBoundingClientRect();
        setFn({ n, x: r.left - rr.left, y: r.top - rr.top }); e.stopPropagation(); return;
      }
      if (!(e.target as HTMLElement).closest?.(".fnpop")) setFn(null);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [fn]);
  const Plus = ({ minus }: { minus?: boolean }) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d={minus ? "M2 7.2h12v1.6H2z" : "M7.2 2h1.6v5.2H14v1.6H8.8V14H7.2V8.8H2V7.2h5.2V2Z"} fill="currentColor" /></svg>;
  return (
    <div className="desc" ref={ref}>
      <div className="rich" dangerouslySetInnerHTML={{ __html: open || !cut ? html : head }} />
      {cut ? <button type="button" className="cut" onClick={() => { setOpen((o) => !o); setFn(null); }}><Plus minus={open} /><span>{open ? "Свернуть" : "Раскрыть"}</span></button> : null}
      {fn && notes[fn.n - 1] ? <div className="fnpop" style={{ left: Math.min(fn.x, Math.max(0, (ref.current?.clientWidth || 400) - 287)), top: fn.y - 16 }}>{notes[fn.n - 1]}</div> : null}
    </div>
  );
}
