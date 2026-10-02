"use client";
// Фильтры поиска и хронографа по макету 02.10: серые ячейки «+ Название (N)»; клик открывает справа панель 480:
// заголовок, «Закрыть ×», поиск по списку, тумблер «Показать только выбранные», группы с чекбоксами (раскрываются плюсом),
// внизу прибиты «Применить» и «Очистить все». Выбор применяется одним переходом (без перезагрузки страницы).
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type FItem = { id: string; title: string };
export type FGroup = { title: string; items: FItem[] };
export type Filter = { param: string; label: string; selected: string[]; groups: FGroup[]; multi?: boolean; ph?: string };

const Plus = <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M7.2 2h1.6v5.2H14v1.6H8.8V14H7.2V8.8H2V7.2h5.2V2Z" fill="#262626" /></svg>;
const Minus = <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 7.2h12v1.6H2z" fill="#262626" /></svg>;
const X = <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 2.4 8 6.9l4.5-4.5 1.1 1.1L9.1 8l4.5 4.5-1.1 1.1L8 9.1l-4.5 4.5-1.1-1.1L6.9 8 2.4 3.5l1.1-1.1Z" fill="#262626" /></svg>;
const Tick = <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3 3 7-7" stroke="#fff" strokeWidth="2" fill="none" /></svg>;

function buildUrl(prefix: string, sp: Record<string, string>, patch: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
  p.delete("n");
  const q = p.toString();
  return prefix + (q ? "?" + q : "");
}

export default function FilterBar({ filters, sp, prefix, children }: { filters: Filter[]; sp: Record<string, string>; prefix: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  const cur = filters.find((f) => f.param === open) || null;
  return (
    <>
      <div id="fbar">
        {filters.map((f) => (
          <button type="button" className="fcell" key={f.param} onClick={() => setOpen(f.param)}>
            {Plus}<span className="t"><b>{f.label}</b>{f.selected.length ? <i>({f.selected.length})</i> : null}</span>
          </button>
        ))}
        {children}
      </div>
      {cur ? <Panel key={cur.param} f={cur} sp={sp} prefix={prefix} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function Panel({ f, sp, prefix, onClose }: { f: Filter; sp: Record<string, string>; prefix: string; onClose: () => void }) {
  const router = useRouter();
  const [sel, setSel] = useState<string[]>(f.selected);
  const [q, setQ] = useState("");
  const [onlySel, setOnlySel] = useState(false);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const multi = f.multi !== false;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [onClose]);
  const groups = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return f.groups.map((g) => ({ ...g, items: g.items.filter((it) => (!qq || it.title.toLowerCase().includes(qq)) && (!onlySel || sel.includes(it.id))) })).filter((g) => g.items.length);
  }, [f.groups, q, onlySel, sel]);
  const toggleItem = (id: string) => setSel((s) => multi ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [id]);
  const toggleGroup = (g: FGroup) => { const ids = g.items.map((i) => i.id); const all = ids.every((id) => sel.includes(id)); setSel((s) => all ? s.filter((x) => !ids.includes(x)) : [...new Set([...s, ...ids])]); };
  const apply = (ids: string[]) => { router.push(buildUrl(prefix, sp, { [f.param]: ids.join(",") || undefined }), { scroll: false }); onClose(); };
  const single = f.groups.length === 1 && !f.groups[0].title;
  return (
    <div className="fpanel-wrap" onClick={onClose}>
      <aside className="fpanel" role="dialog" aria-label={f.label} onClick={(e) => e.stopPropagation()}>
        <div className="fp-head"><h2>{f.label}</h2><button type="button" className="fp-close" onClick={onClose}><span>Закрыть</span>{X}</button></div>
        {f.groups.reduce((a, g) => a + g.items.length, 0) > 8 ? (
          <label className="fp-search"><span>Поиск</span><span className="in"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={f.ph || "Начните вводить"} autoComplete="off" />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="10.5" cy="10.5" r="6.5" stroke="#262626" strokeWidth="2" /><path d="M15.5 15.5 21 21" stroke="#262626" strokeWidth="2" /></svg></span></label>
        ) : null}
        {multi ? <button type="button" className="fp-only" onClick={() => setOnlySel((v) => !v)}><span>Показать только выбранные</span><span className={"sw" + (onlySel ? " on" : "")} /></button> : null}
        <div className="fp-list">
          {groups.map((g) => {
            const ids = g.items.map((i) => i.id), all = ids.every((id) => sel.includes(id)), some = ids.some((id) => sel.includes(id));
            const isClosed = !!closed[g.title];
            return (
              <div className="fp-group" key={g.title || "_"}>
                {single ? null : (
                  <div className="fp-gt">
                    {multi ? <button type="button" className={"cb" + (all ? " on" : some ? " half" : "")} aria-label="Выбрать группу" onClick={() => toggleGroup(g)}>{all ? Tick : null}</button> : null}
                    <button type="button" className="fp-gtl" onClick={() => setClosed((c) => ({ ...c, [g.title]: !isClosed }))}><b>{g.title}</b><i>({g.items.length})</i><span className="ic">{isClosed ? Plus : Minus}</span></button>
                  </div>
                )}
                {isClosed ? null : (
                  <div className={"fp-items" + (single ? " flat" : "")}>
                    {g.items.map((it) => (
                      <button type="button" className="fp-item" key={it.id} onClick={() => toggleItem(it.id)}>
                        <span className={"cb" + (sel.includes(it.id) ? " on" : "")}>{sel.includes(it.id) ? Tick : null}</span><span>{it.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {!groups.length ? <div className="fp-empty">Ничего не найдено</div> : null}
        </div>
        <div className="fp-foot">
          <button type="button" className="fp-apply" onClick={() => apply(sel)}>Применить</button>
          <button type="button" className="fp-clear" onClick={() => apply([])}>Очистить все</button>
        </div>
      </aside>
    </div>
  );
}
