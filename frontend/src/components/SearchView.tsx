import { useState, type FormEvent } from "react";
import { FileSearch, Loader2, Search } from "lucide-react";
import { api, type SearchResult } from "../lib/api";
import { pagesLabel, ScoreBar } from "./Sources";

/** Sprint 2 — pesquisa semântica direta no manual (sem LLM), para validar o retrieval. */
export function SearchView({ category }: { category: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setLoading(true);
    setError(null);
    try {
      setResults((await api.search(q.trim(), category || undefined)).results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na pesquisa");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="scroll-thin flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Pesquisa no manual</h1>
          <p className="mt-1 text-sm text-ink-500">
            Encontre diretamente os excertos mais relevantes do manual, ordenados por semelhança com a pesquisa.
          </p>
        </div>

        <form onSubmit={submit} className="flex gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-ink-200 focus-within:ring-2 focus-within:ring-brand-400">
          <Search className="ml-2 size-5 self-center text-ink-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ex.: alarme de potência baixa na fibra"
            className="flex-1 bg-transparent px-1 text-[15px] outline-none placeholder:text-ink-400"
          />
          <button className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />} Pesquisar
          </button>
        </form>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {results && results.length === 0 && (
          <div className="mt-16 text-center text-ink-500">
            <FileSearch className="mx-auto mb-3 size-10 text-ink-300" />
            Nenhum excerto encontrado.
          </div>
        )}

        <ol className="mt-6 space-y-3">
          {results?.map((r, i) => (
            <li key={r.id} className="animate-fade-up rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-100" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-ink-900 text-xs font-bold text-white">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-semibold text-ink-900">{r.section}</span>
                    <ScoreBar score={r.score} />
                  </div>
                  <div className="mt-0.5 text-xs text-ink-400">
                    {r.documentTitle} v{r.documentVersion} · {pagesLabel(r.pageStart, r.pageEnd)}
                    {r.category && <> · {r.category}</>}
                  </div>
                  <p className="mt-2.5 line-clamp-5 text-sm leading-relaxed text-ink-600">{r.text.startsWith(r.section) ? r.text.slice(r.section.length).trim() : r.text}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
