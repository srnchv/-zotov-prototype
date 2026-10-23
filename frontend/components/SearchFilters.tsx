"use client";
// Фильтры поиска по ТЗ DEV: строка категорий «+ Название (N)» → окно выбора одной категории
// (десктоп/планшет — панель справа поверх затемнения, мобайл — на весь экран). Внутри: поиск по списку,
// «Показать только выбранные», группы с чекбоксами и счётчиком, «Применить» / «Очистить все».
// Выбор применяется только по «Применить»; «Закрыть» сбрасывает несохранённое. Состояние — в URL (?mat=…&mat=…).
// Строка выбранных фильтров — чипсы по категориям, «Ещё»/«Свернуть», «Очистить все» (на мобайле не показывается).
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Cat, CatKey, Group } from "@/lib/search";

const Plus = <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M7.2 2h1.6v5.2H14v1.6H8.8V14H7.2V8.8H2V7.2h5.2V2Z" fill="currentColor" /></svg>;
const Minus = <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 7.2h12v1.6H2z" fill="currentColor" /></svg>;
const X = <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 2.4 8 6.9l4.5-4.5 1.1 1.1L9.1 8l4.5 4.5-1.1 1.1L8 9.1l-4.5 4.5-1.1-1.1L6.9 8 2.4 3.5l1.1-1.1Z" fill="currentColor" /></svg>;
const Tick = <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3 3 7-7" stroke="#fff" strokeWidth="2" fill="none" /></svg>;
const Dots = <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="3" cy="8" r="1.4" fill="currentColor" /><circle cx="8" cy="8" r="1.4" fill="currentColor" /><circle cx="13" cy="8" r="1.4" fill="currentColor" /></svg>;
const Up = <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 2.6h12V4H2zM8 5.5l4.5 4.5-1.1 1.1-2.6-2.6V14H7.2V8.5l-2.6 2.6L3.5 10 8 5.5Z" fill="currentColor" /></svg>;
const Search = <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="10.5" cy="10.5" r="6.5" stroke="#262626" strokeWidth="2" /><path d="M15.5 15.5 21 21" stroke="#262626" strokeWidth="2" /></svg>;

// адрес с новым набором значений категории; при смене фильтров выдача — с первой страницы
function useUrl() {
  const sp = useSearchParams();
  return (patch: Partial<Record<string, string[]>>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, vals] of Object.entries(patch)) { p.delete(k); for (const v of vals || []) p.append(k, v); }
    p.delete("page");
    const q = p.toString();
    return "/search" + (q ? "?" + q : "");
  };
}

export default function SearchFilters({ cats, sel }: { cats: Cat[]; sel: Record<CatKey, string[]> }) {
  const [open, setOpen] = useState<CatKey | null>(null);
  const cur = cats.find((c) => c.key === open) || null;
  return (
    <>
      <div id="sfbar">
        {cats.map((c) => (
          <button type="button" className="fcell" key={c.key} onClick={() => setOpen(c.key)}>
            {Plus}<span className="t"><b>{c.label}</b>{sel[c.key]?.length ? <i>({sel[c.key].length})</i> : null}</span>
          </button>
        ))}
      </div>
      {cur ? <Panel key={cur.key} c={cur} selected={sel[cur.key] || []} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function Panel({ c, selected, onClose }: { c: Cat; selected: string[]; onClose: () => void }) {
  const router = useRouter();
  const url = useUrl();
  const [sel, setSel] = useState<string[]>(selected);
  const [q, setQ] = useState("");
  const [onlySel, setOnlySel] = useState(false);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [onClose]);
  const groups = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const okItem = (t: string, id: string) => (!qq || t.toLowerCase().includes(qq)) && (!onlySel || sel.includes(id));
    return c.groups.map((g) => {
      const titleHit = !!qq && g.title.toLowerCase().includes(qq);
      return { ...g, items: g.items.filter((it) => okItem(it.title, it.id) || (titleHit && (!onlySel || sel.includes(it.id)))) };
    }).filter((g) => g.items.length);
  }, [c.groups, q, onlySel, sel]);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  // выбор группы отмечает (или снимает) все её элементы — полный список группы, не только найденные
  const toggleGroup = (g: Group) => {
    const ids = (c.groups.find((x) => x.id === g.id) || g).items.map((i) => i.id);
    const all = ids.every((id) => sel.includes(id));
    setSel((s) => (all ? s.filter((x) => !ids.includes(x)) : [...new Set([...s, ...ids])]));
  };
  const apply = (ids: string[]) => { router.push(url({ [c.key]: ids }), { scroll: false }); onClose(); };
  const flat = c.groups.length === 1 && !c.groups[0].title;
  return (
    <div className="fpanel-wrap" onClick={onClose}>
      <aside className="fpanel" role="dialog" aria-label={c.label} onClick={(e) => e.stopPropagation()}>
        <div className="fp-head"><h2>{c.label}</h2><button type="button" className="fp-close" onClick={onClose}><span>Закрыть</span>{X}</button></div>
        <label className="fp-search"><span>Поиск</span><span className="in"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={c.ph} autoComplete="off" />{Search}</span></label>
        <button type="button" className="fp-only" onClick={() => setOnlySel((v) => !v)}><span>Показать только выбранные</span><span className={"sw" + (onlySel ? " on" : "")} /></button>
        <div className="fp-list">
          {groups.map((g) => {
            const full = (c.groups.find((x) => x.id === g.id) || g).items.map((i) => i.id);
            const all = full.every((id) => sel.includes(id)), some = full.some((id) => sel.includes(id));
            if (g.leaf) return ( // тип без подтипов — одна строка на уровне групп
              <div className="fp-group" key={g.id}>
                <div className="fp-gt"><button type="button" className={"cb" + (all ? " on" : "")} aria-label="Выбрать" onClick={() => toggleGroup(g)}>{all ? Tick : null}</button>
                  <button type="button" className="fp-gtl" onClick={() => toggleGroup(g)}><b>{g.title}</b></button></div>
              </div>
            );
            const isClosed = !!closed[g.id] && !q;
            return (
              <div className="fp-group" key={g.id || "_"}>
                {flat ? null : (
                  <div className="fp-gt">
                    <button type="button" className={"cb" + (all ? " on" : some ? " half" : "")} aria-label="Выбрать группу" onClick={() => toggleGroup(g)}>{all ? Tick : null}</button>
                    <button type="button" className="fp-gtl" onClick={() => setClosed((x) => ({ ...x, [g.id]: !isClosed }))}><b>{g.title}</b><i>({full.length})</i><span className="ic">{isClosed ? Plus : Minus}</span></button>
                  </div>
                )}
                {isClosed ? null : (
                  <div className={"fp-items" + (flat ? " flat" : "")}>
                    {g.items.map((it) => (
                      <button type="button" className="fp-item" key={it.id} onClick={() => toggle(it.id)}>
                        <span className={"cb" + (sel.includes(it.id) ? " on" : "")}>{sel.includes(it.id) ? Tick : null}</span><span>{it.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {!groups.length ? <div className="fp-empty">{onlySel ? "Ничего не выбрано" : "Ничего не найдено"}</div> : null}
        </div>
        <div className="fp-foot">
          <button type="button" className="fp-apply" onClick={() => apply(sel)}>Применить</button>
          <button type="button" className="fp-clear" onClick={() => setSel([])}>Очистить все</button>
        </div>
      </aside>
    </div>
  );
}

// строка выбранных фильтров: чипсы по категориям, свёрнуто — первые 10 + «Ещё»
export type Chip = { cat: CatKey; catLabel: string; id: string; title: string; href: string };
const COLLAPSED = 10;
export function SelectedChips({ chips, clearHref }: { chips: Chip[]; clearHref: string }) {
  const [open, setOpen] = useState(false);
  if (!chips.length) return null;
  const shown = open ? chips : chips.slice(0, COLLAPSED);
  return (
    <div id="schips">
      {shown.map((ch, i) => (
        <span className="schip-w" key={ch.cat + ch.id}>
          {i === 0 || shown[i - 1].cat !== ch.cat ? <span className="schip-l">{ch.catLabel}:</span> : null}
          <a className="schip" href={ch.href}><span>{ch.title}</span>{X}</a>
        </span>
      ))}
      {chips.length > COLLAPSED ? <button type="button" className="schip-more" onClick={() => setOpen((v) => !v)}>{open ? Up : Dots}<span>{open ? "Свернуть" : "Ещё"}</span></button> : null}
      <a className="schip-clear" href={clearHref}>Очистить все</a>
    </div>
  );
}
