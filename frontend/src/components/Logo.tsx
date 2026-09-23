export function LogoMark({ className = "size-9", inverse = false }: { className?: string; inverse?: boolean }) {
  const bg = inverse ? "#fff" : "var(--color-brand-500)";
  const fg = inverse ? "var(--color-brand-500)" : "#fff";
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill={bg} />
      <path d="M18 40c6-14 22-14 28 0" fill="none" stroke={fg} strokeWidth="5" strokeLinecap="round" />
      <path d="M25 40c3-6 11-6 14 0" fill="none" stroke={fg} strokeWidth="5" strokeLinecap="round" />
      <circle cx="32" cy="44" r="4" fill={fg} />
    </svg>
  );
}

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark />
      <div className="leading-tight">
        <div className={`text-[15px] font-semibold tracking-tight ${dark ? "text-white" : "text-ink-900"}`}>
          Assistente de Avarias
        </div>
        <div className="text-xs font-medium text-brand-500">Unitel · Manutenção de Rede</div>
      </div>
    </div>
  );
}
