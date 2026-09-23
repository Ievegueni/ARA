/** Símbolo Unitel (círculo laranja). */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return <img src="/unitel-simbolo.png" alt="" aria-hidden className={`${className} shrink-0 rounded-full object-contain`} />;
}

/** Logótipo Unitel completo + nome da aplicação. `dark` = sobre fundo azul-marinho. */
export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <img src={dark ? "/unitel-logo-branco.png" : "/unitel-logo.png"} alt="Unitel" className="h-10 w-auto self-start" />
      <div className={`text-xs font-semibold tracking-wider uppercase ${dark ? "text-brand-400" : "text-brand-600"}`}>
        Assistente de Avarias
      </div>
    </div>
  );
}
