import { Antenna, Cable, Radio, Zap } from "lucide-react";

const SUGGESTIONS = [
  { icon: Cable, cat: "Fibra óptica", q: "Tenho alarme LOS numa porta óptica. Qual é o procedimento?" },
  { icon: Antenna, cat: "Rádio", q: "O alarme de VSWR está elevado num setor. O que devo verificar?" },
  { icon: Zap, cat: "Energia", q: "Site em baterias e o gerador não arrancou. Que passos seguir?" },
  { icon: Radio, cat: "Micro-ondas", q: "Ligação de micro-ondas em baixo com RSL baixo. Qual a causa provável?" },
];

export function EmptyState({ name, onPick }: { name: string; onPick: (q: string) => void }) {
  const first = name.split(/\s+/)[0];
  return (
    <div className="mx-auto flex w-full max-w-3xl animate-fade-up flex-col items-center px-4 pt-[8vh] text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 animate-pulse rounded-full bg-brand-500/20 blur-2xl" />
        <div className="relative grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-xl shadow-brand-500/30">
          <svg viewBox="0 0 64 64" className="size-10" aria-hidden>
            <path d="M14 38c7-17 29-17 36 0" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
            <path d="M23 38c4-8 14-8 18 0" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
            <circle cx="32" cy="43" r="4.5" fill="#fff" />
          </svg>
        </div>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
        Olá, {first}. <span className="text-brand-500">Qual é a avaria?</span>
      </h1>
      <p className="mt-3 max-w-xl text-ink-500">
        Descreva o equipamento, o alarme ou o sintoma. A resposta vem do manual do técnico, com a secção e a página indicadas.
      </p>

      <div className="mt-10 grid w-full gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map(({ icon: Icon, cat, q }) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="group flex items-start gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-ink-100 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-brand-200"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-500 group-hover:text-white">
              <Icon className="size-4.5" />
            </span>
            <span>
              <span className="block text-[11px] font-semibold tracking-wider text-brand-600 uppercase">{cat}</span>
              <span className="mt-0.5 block text-sm leading-snug text-ink-700">{q}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
