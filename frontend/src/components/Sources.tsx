import { useState } from "react";
import { BookOpen, ChevronDown, FileText } from "lucide-react";
import type { Source } from "../lib/api";

export const pagesLabel = (a: number, b: number) => (a === b ? `p. ${a}` : `pp. ${a}–${b}`);

export function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, score)) * 100);
  return (
    <span className="inline-flex items-center gap-1.5" title={`Relevância ${pct}%`}>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-ink-100">
        <span className="block h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-[11px] tabular-nums text-ink-400">{pct}%</span>
    </span>
  );
}

export function Sources({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!sources.length) return null;

  return (
    <div className="mt-4 rounded-xl border border-ink-100 bg-ink-50/60">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-ink-600 hover:text-ink-900">
        <BookOpen className="size-3.5 text-brand-500" />
        {sources.length} {sources.length === 1 ? "excerto consultado" : "excertos consultados"} no manual
        <ChevronDown className={`ml-auto size-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="space-y-1.5 px-2 pb-2">
          {sources.map((s) => (
            <li key={s.chunkId} className="rounded-lg bg-white shadow-sm ring-1 ring-ink-100">
              <button
                onClick={() => setExpanded(expanded === s.chunkId ? null : s.chunkId)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left"
              >
                <FileText className="size-4 shrink-0 text-ink-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink-800">{s.section}</div>
                  <div className="text-[11px] text-ink-400">
                    {s.document} · {pagesLabel(s.pageStart, s.pageEnd)}
                  </div>
                </div>
                <ScoreBar score={s.score} />
              </button>
              {expanded === s.chunkId && (
                <p className="border-t border-ink-100 px-3 py-2.5 text-xs leading-relaxed whitespace-pre-line text-ink-600">
                  {s.excerpt}
                  {s.excerpt.length >= 600 && "…"}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
