import { useState } from "react";
import { Play } from "lucide-react";
import type { VideoRef } from "../lib/api";
import { fmtDuration } from "../lib/format";
import { VideoPlayer } from "./VideoPlayer";

/** Lista de vídeos sugeridos; ao clicar abre o leitor. Com streamUrl mostra a pré-visualização. */
export function VideoCards({ videos, title = "Vídeos relacionados" }: { videos: VideoRef[]; title?: string }) {
  const [playing, setPlaying] = useState<VideoRef | null>(null);
  if (!videos.length) return null;
  return (
    <div>
      <h3 className="mb-2.5 text-xs font-semibold tracking-wider text-ink-500 uppercase">{title}</h3>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {videos.map((v) => (
          <li key={v.id}>
            <button
              onClick={() => setPlaying(v)}
              className="group flex w-full items-center gap-3 rounded-xl bg-white p-2 text-left shadow-sm ring-1 ring-ink-100 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-brand-200"
            >
              <span className="relative grid aspect-video w-28 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-navy-800 to-navy-950">
                {v.streamUrl && (
                  <video src={`${v.streamUrl}#t=0.5`} preload="metadata" muted playsInline className="absolute inset-0 size-full object-cover opacity-80" />
                )}
                <span className="relative grid size-9 place-items-center rounded-full bg-brand-500 text-white shadow-lg shadow-black/30 transition group-hover:scale-110">
                  <Play className="ml-0.5 size-4" fill="currentColor" />
                </span>
                {v.durationSec != null && (
                  <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-[10px] font-medium tabular-nums text-white">
                    {fmtDuration(v.durationSec)}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm font-medium text-ink-900">{v.title}</span>
                {v.description && <span className="mt-0.5 line-clamp-1 text-xs text-ink-400">{v.description}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {playing && <VideoPlayer videoId={playing.id} title={playing.title} onClose={() => setPlaying(null)} />}
    </div>
  );
}
