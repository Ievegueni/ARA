import { useState, type FormEvent } from "react";
import { ArrowRight, Loader2, Lock, User as UserIcon } from "lucide-react";
import { api, auth, type User } from "../lib/api";

export function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { token, user } = await api.login(username.trim(), password);
      auth.set(token);
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-ink-50 px-4 py-12">
      <div className="pointer-events-none absolute -top-40 -right-40 size-[480px] rounded-full bg-brand-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 size-[480px] rounded-full bg-navy-500/10 blur-3xl" />

      <main className="relative w-full max-w-md animate-fade-up">
        <div className="rounded-3xl bg-white p-8 shadow-xl shadow-navy-950/5 ring-1 ring-ink-100 sm:p-10">
          <img src="/unitel-logo.png" alt="Unitel" className="mx-auto h-12 w-auto" />
          <div className="mt-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-navy-950">Assistente de Avarias</h1>
            <p className="mt-1.5 text-sm text-ink-500">Entre com as credenciais de técnico.</p>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field icon={UserIcon} label="Utilizador">
              <input
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ex.: jsilva"
                className="w-full bg-transparent py-3 pr-3 text-base outline-none placeholder:text-ink-300 sm:text-sm"
                required
              />
            </Field>
            <Field icon={Lock} label="Palavra-passe">
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent py-3 pr-3 text-base outline-none placeholder:text-ink-300 sm:text-sm"
                required
              />
            </Field>

            {error && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 focus-visible:ring-4 focus-visible:ring-brand-200 focus-visible:outline-none disabled:opacity-70"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              Entrar
              {!loading && <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-ink-400">Acesso restrito a técnicos de manutenção de rede da Unitel.</p>
      </main>
    </div>
  );
}

function Field({ icon: Icon, label, children }: { icon: typeof Lock; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-600">{label}</span>
      <span className="flex items-center gap-2.5 rounded-xl border border-ink-200 bg-ink-50/50 pl-3.5 transition focus-within:border-brand-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-100">
        <Icon className="size-4 shrink-0 text-ink-400" />
        {children}
      </span>
    </label>
  );
}
