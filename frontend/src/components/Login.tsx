import { useState, type FormEvent } from "react";
import { ArrowRight, BookOpenCheck, Loader2, Lock, ShieldCheck, User as UserIcon, Zap } from "lucide-react";
import { api, auth, type User } from "../lib/api";
import { Logo, LogoMark } from "./Logo";

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
    <div className="grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      {/* Painel de marca */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 p-12 text-white lg:flex lg:flex-col">
        <div className="bg-grid absolute inset-0" />
        <svg className="absolute -right-24 -bottom-24 size-[520px] text-white/10" viewBox="0 0 200 200" fill="none" aria-hidden>
          {[40, 70, 100, 130].map((r) => (
            <circle key={r} cx="200" cy="200" r={r} stroke="currentColor" strokeWidth="10" />
          ))}
        </svg>
        <div className="relative flex items-center gap-3">
          <LogoMark inverse className="size-10 shadow-lg shadow-brand-900/20" />
          <span className="text-lg font-semibold tracking-tight">Unitel</span>
        </div>

        <div className="relative my-auto max-w-lg">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
            <span className="size-1.5 rounded-full bg-white" /> Prova de conceito
          </p>
          <h1 className="text-4xl leading-tight font-semibold tracking-tight xl:text-5xl">
            O manual do técnico, <br />a uma pergunta de distância.
          </h1>
          <p className="mt-5 text-lg text-white/85">
            Descreva o alarme ou o sintoma e receba o procedimento do manual, com a secção e a página de onde veio.
          </p>

          <ul className="mt-10 space-y-4">
            {[
              { icon: Zap, t: "Diagnóstico mais rápido", d: "Encontre o procedimento certo em segundos." },
              { icon: BookOpenCheck, t: "Sempre rastreável", d: "Cada resposta cita a secção e a página do manual." },
              { icon: ShieldCheck, t: "Sem invenções", d: "Se o manual não cobre o caso, o assistente diz que não sabe." },
            ].map(({ icon: Icon, t, d }) => (
              <li key={t} className="flex gap-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15 backdrop-blur">
                  <Icon className="size-5" />
                </div>
                <div>
                  <div className="font-semibold">{t}</div>
                  <div className="text-sm text-white/80">{d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/70">© {new Date().getFullYear()} Unitel · Direção de Manutenção de Rede</p>
      </aside>

      {/* Formulário */}
      <main className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Entrar</h2>
          <p className="mt-1.5 text-sm text-ink-500">Use as credenciais de técnico fornecidas pela equipa do projeto.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field icon={UserIcon} label="Utilizador">
              <input
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ex.: jsilva"
                className="peer w-full bg-transparent py-3 pr-3 text-sm outline-none placeholder:text-ink-300"
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
                className="w-full bg-transparent py-3 pr-3 text-sm outline-none placeholder:text-ink-300"
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

          <p className="mt-10 text-center text-xs text-ink-400">
            Acesso restrito a técnicos de manutenção de rede da Unitel.
          </p>
        </div>
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
