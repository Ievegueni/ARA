import { Filter } from "lucide-react";

export function CategorySelect({ categories, value, onChange }: { categories: string[]; value: string; onChange: (v: string) => void }) {
  if (!categories.length) return null;
  return (
    <label className="relative flex items-center">
      <Filter className="pointer-events-none absolute left-3 size-3.5 text-ink-400" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-[132px] appearance-none truncate rounded-lg border border-ink-200 bg-white py-1.5 pr-7 pl-8 text-base sm:w-auto sm:max-w-[220px] sm:text-xs font-medium text-ink-700 outline-none hover:border-ink-300 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      >
        <option value="">Todas</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-2.5 size-3 text-ink-400" viewBox="0 0 12 12" aria-hidden>
        <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </label>
  );
}
