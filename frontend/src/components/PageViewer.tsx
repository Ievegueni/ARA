import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ChevronLeft, ChevronRight, ExternalLink, FileImage, Loader2, Minus, Plus, X } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { api, type ChunkPage } from "../lib/api";

/**
 * Carrega o pdf.js só quando é preciso (não pesa no carregamento inicial da aplicação).
 * Build "legacy": funciona em navegadores e telemóveis mais antigos.
 */
async function loadPdfJs() {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

const ZOOMS = [1, 1.5, 2, 3];

/** Mostra a página original do manual (com imagens e esquemas) onde está a secção. */
export function PageViewer({ chunkId, onClose }: { chunkId: string; onClose: () => void }) {
  const [info, setInfo] = useState<ChunkPage | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(0);
  const [rendering, setRendering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Área útil (sem as margens): a página é ajustada a esta largura. */
  const fitRef = useRef<HTMLDivElement>(null);

  // 1. Secção → manual e página; 2. abre o PDF (por partes: só descarrega o necessário)
  useEffect(() => {
    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const data = await api.chunkPage(chunkId);
        if (cancelled) return;
        setInfo(data);
        setPage(data.pageStart);
        if (!data.fileUrl) return;
        const pdfjs = await loadPdfJs();
        doc = await pdfjs.getDocument({ url: data.fileUrl, disableAutoFetch: true, disableStream: true, rangeChunkSize: 65536 }).promise;
        if (cancelled) return void doc.destroy();
        setPdf(doc);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error && e.message ? e.message : "Não foi possível abrir o manual");
      }
    })();
    return () => {
      cancelled = true;
      doc?.destroy();
    };
  }, [chunkId]);

  // Desenha a página à largura disponível (× zoom), com nitidez em ecrãs de alta densidade
  useEffect(() => {
    if (!pdf || !canvasRef.current || !fitRef.current) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    setRendering(true);
    (async () => {
      try {
        const p = await pdf.getPage(page);
        if (cancelled) return;
        const base = p.getViewport({ scale: 1 });
        // Ajusta à largura disponível, até 920px (no computador uma página A4 inteira fica legível sem ser enorme)
        const width = Math.max(260, Math.min(fitRef.current!.clientWidth, 920));
        const scale = (width / base.width) * ZOOMS[zoom];
        const viewport = p.getViewport({ scale });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = canvasRef.current!;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        task = p.render({ canvas, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
        await task.promise;
        if (!cancelled) setRendering(false);
      } catch (e) {
        if (!cancelled && (e as Error)?.name !== "RenderingCancelledException") setError("Não foi possível desenhar a página");
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, page, zoom]);

  const pages = pdf?.numPages ?? info?.document.pages ?? 1;
  const go = useCallback((delta: number) => setPage((p) => Math.min(pages, Math.max(1, p + delta))), [pages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, go]);

  const inSection = info && page >= info.pageStart && page <= info.pageEnd;
  const btn = "grid size-9 place-items-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent";

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Página do manual" className="fixed inset-0 z-50 flex flex-col bg-navy-950/95 backdrop-blur-sm">
      {/* Barra superior */}
      <header className="flex items-center gap-3 px-3 py-2.5 text-white sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold sm:text-base">{info?.section ?? "A abrir…"}</div>
          {info && (
            <div className="truncate text-xs text-white/60">
              {info.document.title} v{info.document.version}
              {info.pageEnd > info.pageStart ? ` · secção nas pp. ${info.pageStart}–${info.pageEnd}` : ` · p. ${info.pageStart}`}
            </div>
          )}
        </div>
        {info?.fileUrl && (
          <a href={info.fileUrl} target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white sm:flex">
            <ExternalLink className="size-3.5" /> Abrir PDF completo
          </a>
        )}
        <button onClick={onClose} className={btn} aria-label="Fechar">
          <X className="size-5" />
        </button>
      </header>

      {/* Página */}
      <div className="scroll-dark relative flex-1 overflow-auto px-2 pb-2 sm:px-6">
        <div ref={fitRef} className="h-0 w-full" aria-hidden />
        {error ? (
          <Message>{error}</Message>
        ) : info && !info.fileUrl ? (
          <Message>
            O PDF original deste manual não está guardado (foi carregado antes desta funcionalidade). Peça a um administrador para o voltar a
            carregar em <strong>Biblioteca → Manuais</strong>.
          </Message>
        ) : (
          <div className="mx-auto w-fit">
            <canvas ref={canvasRef} className={`block rounded-sm bg-white shadow-2xl transition-opacity ${rendering ? "opacity-40" : "opacity-100"}`} />
          </div>
        )}
        {!error && (rendering || !info) && info?.fileUrl !== null && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <Loader2 className="size-8 animate-spin text-white/70" />
          </div>
        )}
      </div>

      {/* Navegação */}
      {pdf && (
        <footer className="flex items-center justify-center gap-1 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-white">
          <button onClick={() => go(-1)} disabled={page <= 1} className={btn} aria-label="Página anterior">
            <ChevronLeft className="size-5" />
          </button>
          <span className="flex min-w-20 items-center justify-center gap-1.5 text-sm whitespace-nowrap tabular-nums" aria-live="polite">
            <span className="hidden sm:inline">Página</span> {page} <span className="sm:hidden">/</span>
            <span className="hidden sm:inline">de</span> {pages}
            {inSection && <span className="rounded bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold">secção</span>}
          </span>
          <button onClick={() => go(1)} disabled={page >= pages} className={btn} aria-label="Página seguinte">
            <ChevronRight className="size-5" />
          </button>
          <span className="mx-2 h-5 w-px bg-white/20" />
          <button onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} className={btn} aria-label="Reduzir">
            <Minus className="size-4" />
          </button>
          <span className="w-10 text-center text-xs tabular-nums text-white/70">{Math.round(ZOOMS[zoom] * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoom === ZOOMS.length - 1} className={btn} aria-label="Ampliar">
            <Plus className="size-4" />
          </button>
        </footer>
      )}
    </div>,
    document.body,
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-16 flex max-w-md items-start gap-3 rounded-xl bg-white/10 p-4 text-sm leading-relaxed text-white/90">
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-brand-400" />
      <p>{children}</p>
    </div>
  );
}

/** Botão "Ver página" que abre o leitor da página do manual. */
export function ViewPageButton({ chunkId, className = "" }: { chunkId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-navy-800 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 ${className}`}
      >
        <FileImage className="size-3.5" /> Ver página
      </button>
      {open && <PageViewer chunkId={chunkId} onClose={() => setOpen(false)} />}
    </>
  );
}
