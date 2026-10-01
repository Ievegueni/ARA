import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Loader2, X } from "lucide-react";
import { api } from "../lib/api";

/** Leitor em janela sobreposta. Obtém um URL de reprodução novo (o token expira). */
export function VideoPlayer({ videoId, title, onClose }: { videoId: string; title: string; onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .video(videoId)
      .then(({ video }) => setSrc(video.streamUrl))
      .catch((e) => setError(e instanceof Error ? e.message : "Não foi possível abrir o vídeo"));
  }, [videoId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Portal para o <body>: um antepassado com transform (animação) prenderia o "fixed" dentro da mensagem
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 z-50 flex animate-fade-up items-center justify-center bg-navy-950/85 p-3 backdrop-blur-sm sm:p-8"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-5xl">
        <div className="mb-3 flex items-start gap-3 text-white">
          <h2 className="min-w-0 flex-1 text-base font-semibold sm:text-lg">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="Fechar vídeo">
            <X className="size-6" />
          </button>
        </div>
        <div className="grid aspect-video w-full place-items-center overflow-hidden rounded-2xl bg-black shadow-2xl">
          {error ? (
            <p className="flex items-center gap-2 text-sm text-red-300">
              <AlertCircle className="size-4" /> {error}
            </p>
          ) : src ? (
            <video
              src={src}
              controls
              autoPlay
              playsInline
              className="size-full"
              onError={() => setError("O navegador não consegue reproduzir este vídeo. Use o formato MP4 (H.264).")}
            />
          ) : (
            <Loader2 className="size-8 animate-spin text-white/60" />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
