import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, KeyRound, Loader2, PlugZap, Sparkles, XCircle } from "lucide-react";
import { api, type AiState, type AiTestResult } from "../lib/api";

/**
 * Interruptor ON/OFF da IA (só administradores), no cabeçalho.
 * O estado fica guardado no servidor e aplica-se logo a todos os técnicos.
 */
export function AiToggle({ onChange }: { onChange: (active: boolean) => void }) {
  const [state, setState] = useState<AiState | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<AiTestResult | "loading" | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await api.aiState();
      setState(s);
      onChange(s.active);
    } catch {
      /* sem permissão ou servidor indisponível */
    }
  }, [onChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Enquanto gera os embeddings em segundo plano, atualiza o progresso
  useEffect(() => {
    if (!open || !state?.backfill.running) return;
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, [open, state?.backfill.running, refresh]);

  // Fecha ao clicar fora ou com Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !boxRef.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function toggle() {
    if (!state) return;
    setSaving(true);
    setError(null);
    try {
      const s = await api.setAi(!state.enabled);
      setState(s);
      onChange(s.active);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível alterar");
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTest("loading");
    try {
      setTest(await api.testAi());
    } catch (e) {
      setTest({ claude: { ok: false, message: e instanceof Error ? e.message : "Erro no teste" }, voyage: null });
    }
  }

  if (!state) return null;
  const on = state.active;
  const canEnable = state.keys.claude;

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={on ? "IA ligada" : "IA desligada"}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
          on ? "border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100" : "border-ink-200 bg-white text-ink-500 hover:border-ink-300"
        }`}
      >
        <Sparkles className="size-3.5" />
        <span>IA</span>
        <span className={`rounded px-1 py-px text-[10px] ${on ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-500"}`}>{on ? "ON" : "OFF"}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Definições da IA"
          className="absolute top-full right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] animate-fade-up rounded-2xl bg-white p-4 shadow-xl ring-1 ring-ink-200"
        >
          {/* Interruptor */}
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-navy-950">Assistente com IA</div>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-500">
                {on
                  ? `Ligada: o Claude (${state.model}) escreve a resposta com base nas secções do manual.`
                  : "Desligada: as respostas mostram as secções do manual, sem serviços externos."}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={state.enabled}
              aria-label="Ligar ou desligar a IA"
              onClick={toggle}
              disabled={saving || (!state.enabled && !canEnable)}
              className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${state.enabled ? "bg-brand-500" : "bg-ink-200"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 grid size-6 place-items-center rounded-full bg-white shadow transition-transform ${
                  state.enabled ? "translate-x-5" : ""
                }`}
              >
                {saving && <Loader2 className="size-3.5 animate-spin text-ink-400" />}
              </span>
            </button>
          </div>

          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          {/* Estado */}
          <ul className="mt-4 space-y-2 border-t border-ink-100 pt-3 text-xs">
            <Row ok={state.keys.claude} label="Chave do Claude (ANTHROPIC_API_KEY)" hint={state.keys.claude ? "configurada" : "em falta — necessária para ligar a IA"} />
            <Row
              ok={state.keys.voyage}
              optional
              label="Chave da Voyage (VOYAGE_API_KEY)"
              hint={state.keys.voyage ? "configurada" : "opcional — sem ela a pesquisa é por palavras-chave"}
            />
            <li className="flex items-center gap-2 text-ink-600">
              <span className="size-4 shrink-0" />
              Pesquisa: <strong className="font-medium text-ink-800">{state.search === "semantica" ? "por significado (semântica)" : "por palavras-chave"}</strong>
            </li>
            {state.backfill.running && (
              <li className="flex items-center gap-2 text-ink-600">
                <Loader2 className="size-4 shrink-0 animate-spin text-brand-500" />A preparar a pesquisa semântica: {state.backfill.done}/{state.backfill.total}
              </li>
            )}
            {state.backfill.error && (
              <li className="flex items-start gap-2 text-red-700">
                <AlertCircle className="mt-px size-4 shrink-0" /> Embeddings: {state.backfill.error}
              </li>
            )}
          </ul>

          {!state.keys.claude && (
            <div className="mt-3 rounded-lg bg-ink-50 p-3 text-xs leading-relaxed text-ink-600">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-ink-800">
                <KeyRound className="size-3.5" /> Como adicionar a chave
              </div>
              No servidor, em <code className="rounded bg-white px-1 ring-1 ring-ink-200">backend/.env</code>:
              <code className="mt-1 block rounded bg-white px-2 py-1 ring-1 ring-ink-200">ANTHROPIC_API_KEY=sk-ant-…</code>
              Depois reinicie o backend: <code className="rounded bg-white px-1 ring-1 ring-ink-200">pm2 restart ara-api</code>
            </div>
          )}

          {/* Teste de ligação */}
          {(state.keys.claude || state.keys.voyage) && (
            <div className="mt-3 border-t border-ink-100 pt-3">
              <button
                onClick={runTest}
                disabled={test === "loading"}
                className="flex items-center gap-1.5 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-navy-800 transition hover:border-brand-300 hover:bg-brand-50 disabled:opacity-60"
              >
                {test === "loading" ? <Loader2 className="size-3.5 animate-spin" /> : <PlugZap className="size-3.5" />} Testar ligação
              </button>
              {test && test !== "loading" && (
                <ul className="mt-2 space-y-1.5 text-xs">
                  <TestRow name="Claude" r={test.claude} />
                  {test.voyage && <TestRow name="Voyage" r={test.voyage} />}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ ok, label, hint, optional = false }: { ok: boolean; label: string; hint: string; optional?: boolean }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2 className="mt-px size-4 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className={`mt-px size-4 shrink-0 ${optional ? "text-ink-300" : "text-red-500"}`} />
      )}
      <span>
        <span className="font-medium text-ink-800">{label}</span>
        <span className="block text-ink-500">{hint}</span>
      </span>
    </li>
  );
}

function TestRow({ name, r }: { name: string; r: { ok: boolean; message: string } }) {
  return (
    <li className={`flex items-start gap-2 ${r.ok ? "text-emerald-700" : "text-red-700"}`}>
      {r.ok ? <CheckCircle2 className="mt-px size-4 shrink-0" /> : <XCircle className="mt-px size-4 shrink-0" />}
      <span>
        <strong className="font-semibold">{name}:</strong> {r.message}
      </span>
    </li>
  );
}
