"use client";
// Читалка PDF — PDF.js (Apache-2.0, Mozilla): постранично, с масштабом; файл идёт через бэкенд (/media/:id/file),
// чтобы не упираться в CORS хранилища. Внешний вид — свой, поэтому легко подогнать под дизайн.
import { useEffect, useRef, useState } from "react";

export default function PdfReader({ src, title }: { src: string; title?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const doc = useRef<{ numPages: number; getPage: (n: number) => Promise<{ getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> } }> } | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const d = await pdfjs.getDocument({ url: src }).promise;
        if (cancelled) return;
        doc.current = d as unknown as typeof doc.current;
        setPages(d.numPages); setPage(1);
      } catch (e) { setErr("Не удалось открыть документ" + (e instanceof Error ? ": " + e.message : "")); }
    })();
    return () => { cancelled = true; };
  }, [src]);

  useEffect(() => {
    const d = doc.current, c = canvas.current;
    if (!d || !c || !pages) return;
    let cancelled = false;
    d.getPage(page).then(async (p) => {
      if (cancelled) return;
      const dpr = window.devicePixelRatio || 1;
      const vp = p.getViewport({ scale: scale * dpr });
      c.width = vp.width; c.height = vp.height;
      c.style.width = vp.width / dpr + "px"; c.style.height = vp.height / dpr + "px";
      await p.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
    });
    return () => { cancelled = true; };
  }, [page, pages, scale]);

  return (
    <div className="pdf">
      <div className="pdf-bar">
        <span className="pdf-title">{title}</span>
        <span className="pdf-nav">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Предыдущая">←</button>
          <span>{pages ? `${page} / ${pages}` : err ? "—" : "…"}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} aria-label="Следующая">→</button>
          <button type="button" onClick={() => setScale((s) => Math.max(0.6, s - 0.2))} aria-label="Меньше">−</button>
          <button type="button" onClick={() => setScale((s) => Math.min(3, s + 0.2))} aria-label="Больше">+</button>
          <a href={src} target="_blank" rel="noreferrer">Открыть файл</a>
        </span>
      </div>
      <div className="pdf-page">{err ? <div className="pdf-err">{err}</div> : <canvas ref={canvas} />}</div>
    </div>
  );
}
