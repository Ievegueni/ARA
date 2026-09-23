import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle, Check, Copy, ThumbsDown, ThumbsUp } from "lucide-react";
import { api, type Message } from "../lib/api";
import { LogoMark } from "./Logo";
import { Sources } from "./Sources";

/** Transforma citações "[Secção 2.1, p. 2]" em links especiais renderizados como etiquetas. */
const withCitations = (md: string) => md.replace(/\[((?:Sec[çc][ãa]o|Sec\.)[^\]\n]{1,80})\](?!\()/gi, "[$1](#cite)");

export interface UiMessage extends Message {
  streaming?: boolean;
  error?: string;
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
          {m.content ? (
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
            <Thinking />
          ) : null}

          {m.error && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="size-4" /> {m.error}
            </div>
          )}

          {m.sources && !m.streaming && <Sources sources={m.sources} />}
        </div>
        {!m.streaming && !m.error && m.id && !m.id.startsWith("tmp-") && <Actions m={m} onRated={onRated} />}
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex items-center gap-3 py-1 text-sm text-ink-500">
      <span className="flex gap-1">
        {[0, 150, 300].map((d) => (
          <span key={d} className="size-2 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: `${d}ms` }} />
        ))}
      </span>
      A consultar o manual…
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
