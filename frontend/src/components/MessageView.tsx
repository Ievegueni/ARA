import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle, Check, Copy, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { api, type Message, type Source, type VideoRef } from "../lib/api";
import { VideoCards } from "./VideoCards";
import { ViewPageButton } from "./PageViewer";
import { Excerpt } from "./Excerpt";
import { LogoMark } from "./Logo";
import { pagesLabel, ScoreBar, Sources } from "./Sources";

/** Transforma citações "[Secção 2.1, p. 2]" em links especiais renderizados como etiquetas. */
const withCitations = (md: string) => md.replace(/\[((?:Sec[çc][ãa]o|Sec\.)[^\]\n]{1,80})\](?!\()/gi, "[$1](#cite)");

export interface UiMessage extends Message {
  streaming?: boolean;
  error?: string;
  /** Aviso temporário (ex.: a IA falhou e a resposta mostra os excertos do manual). */
  notice?: string;
}

export function MessageView({ m, onRated }: { m: UiMessage; onRated?: (rating: number | null) => void }) {
  if (m.role === "USER") {
    return (
      <div className="flex animate-fade-up justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-navy-950 px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-white shadow-sm">
          {m.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex animate-fade-up gap-3 sm:gap-4">
      <LogoMark className="mt-0.5 size-8 shadow-md shadow-brand-500/20" />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-md bg-white px-5 py-4 shadow-sm ring-1 ring-ink-100">
          {m.notice && (
            <div role="status" className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="mt-px size-3.5 shrink-0 text-amber-600" /> {m.notice}
            </div>
          )}
          {m.mode === "pesquisa" && (m.sources?.length || m.videos?.length) ? (
            <ExcerptAnswer sources={m.sources ?? []} videos={m.videos ?? []} />
          ) : m.content ? (
            <div className="prose prose-sm max-w-none text-[15px] prose-headings:font-semibold prose-headings:text-ink-900 prose-p:leading-relaxed prose-strong:text-ink-900 prose-ol:pl-5 prose-li:marker:font-semibold prose-li:marker:text-brand-600">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  blockquote: ({ children }) => (
                    <div className="not-prose my-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900 [&_p]:m-0">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                      <div>{children}</div>
                    </div>
                  ),
                  a: ({ href, children }) =>
                    href === "#cite" ? (
                      <span className="mx-0.5 inline-flex items-center rounded-md bg-brand-50 px-1.5 py-0.5 align-baseline text-[12px] font-medium whitespace-nowrap text-brand-700 ring-1 ring-brand-200 ring-inset">
                        {children}
                      </span>
                    ) : (
                      <a href={href} target="_blank" rel="noreferrer">
                        {children}
                      </a>
                    ),
                }}
              >
                {withCitations(m.content)}
              </ReactMarkdown>
              {m.streaming && <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-blink bg-brand-500" />}
            </div>
          ) : m.streaming ? (
            <Thinking label={m.mode === "ia" ? "A consultar o manual…" : "A pesquisar no manual…"} />
          ) : null}

          {m.error && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="size-4" /> {m.error}
            </div>
          )}

          {m.mode === "ia" && !m.streaming && !m.error && m.content && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-400">
              <Sparkles className="size-3" /> Resposta escrita por IA com base no manual — confirme nas secções citadas.
            </p>
          )}
          {m.sources && !m.streaming && m.mode !== "pesquisa" && <Sources sources={m.sources} />}
          {!!m.videos?.length && !m.streaming && m.mode !== "pesquisa" && (
            <div className="mt-4">
              <VideoCards videos={m.videos} />
            </div>
          )}
        </div>
        {!m.streaming && !m.error && m.id && !m.id.startsWith("tmp-") && <Actions m={m} onRated={onRated} />}
      </div>
    </div>
  );
}

/** Resposta do modo sem IA: as secções do manual encontradas, com os termos destacados. */
function ExcerptAnswer({ sources, videos }: { sources: Source[]; videos: VideoRef[] }) {
  const n = (count: number, one: string, many: string) => <strong className="text-ink-900">{count === 1 ? `1 ${one}` : `${count} ${many}`}</strong>;
  return (
    <div>
      <p className="text-[15px] text-ink-700">
        Encontrei {sources.length > 0 && <>{n(sources.length, "secção", "secções")} do manual</>}
        {sources.length > 0 && videos.length > 0 && " e "}
        {videos.length > 0 && n(videos.length, "vídeo", "vídeos")} relacionados com a pesquisa:
      </p>
      {videos.length > 0 && (
        <div className="mt-4">
          <VideoCards videos={videos} />
        </div>
      )}
      {sources.length > 0 && videos.length > 0 && <h3 className="mt-5 text-xs font-semibold tracking-wider text-ink-500 uppercase">No manual</h3>}
      <ol className={`${videos.length ? "mt-2.5" : "mt-4"} space-y-3`}>
        {sources.map((s, i) => (
          <li key={s.chunkId} className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
              <div className="min-w-0">
                <h3 className="font-semibold text-navy-950">{s.section}</h3>
                <div className="mt-0.5 text-xs text-ink-400">
                  {s.document} · {pagesLabel(s.pageStart, s.pageEnd)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ScoreBar score={s.score} label="Termos da pesquisa encontrados nesta secção" />
                <ViewPageButton chunkId={s.chunkId} />
              </div>
            </div>
            <div className="mt-3 border-t border-ink-100 pt-2">
              <Excerpt text={s.excerpt} clamp={i > 0} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Thinking({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1 text-sm text-ink-500">
      <span className="flex gap-1">
        {[0, 150, 300].map((d) => (
          <span key={d} className="size-2 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: `${d}ms` }} />
        ))}
      </span>
      {label}
    </div>
  );
}

function Actions({ m, onRated }: { m: UiMessage; onRated?: (r: number | null) => void }) {
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<number | null>(m.rating ?? null);

  async function rate(r: 1 | -1) {
    const next = rating === r ? null : r;
    setRating(next);
    try {
      await api.feedback(m.id, next);
      onRated?.(next);
    } catch {
      setRating(rating);
    }
  }

  const btn = "rounded-lg p-1.5 transition hover:bg-ink-100";
  return (
    <div className="mt-1.5 flex items-center gap-0.5 pl-1 text-ink-400">
      <button
        className={btn}
        title="Copiar"
        onClick={() => {
          navigator.clipboard?.writeText(m.content);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
      </button>
      <button className={`${btn} ${rating === 1 ? "text-emerald-600" : ""}`} title="Resposta útil" onClick={() => rate(1)}>
        <ThumbsUp className="size-4" fill={rating === 1 ? "currentColor" : "none"} />
      </button>
      <button className={`${btn} ${rating === -1 ? "text-red-600" : ""}`} title="Resposta incorreta ou pouco útil" onClick={() => rate(-1)}>
        <ThumbsDown className="size-4" fill={rating === -1 ? "currentColor" : "none"} />
      </button>
      {rating !== null && <span className="ml-1 text-xs text-ink-400">Obrigado pelo feedback</span>}
    </div>
  );
}
