"use client";
// Счётчик просмотров: раз за визит на сущность, без кук
import { useEffect } from "react";
import { API } from "@/lib/api";
export default function ViewPing({ id }: { id: string }) {
  useEffect(() => {
    const key = "zv_" + id;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    fetch(`${API}/entities/${encodeURIComponent(id)}/view`, { method: "POST" }).catch(() => {});
    try {
      let v = localStorage.getItem("zotov_vid"); if (!v) { v = Math.random().toString(36).slice(2, 12); localStorage.setItem("zotov_vid", v); }
      const device = /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "мобильные" : "десктоп";
      fetch(`${API}/hit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ visitor: v, device, path: "/m/" + id }) }).catch(() => {});
    } catch {}
  }, [id]);
  return null;
}
