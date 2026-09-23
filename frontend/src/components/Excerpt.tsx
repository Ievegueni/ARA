import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown } from "lucide-react";

/** Texto de um excerto do manual (Markdown); os termos pesquisados vêm a **negrito** e são destacados. */
export function Excerpt({ text, clamp = false }: { text: string; clamp?: boolean }) {
  const [open, setOpen] = useState(!clamp);
  const long = text.length > 420;
  return (
    <div>
      <div className={`relative ${!open && long ? "max-h-40 overflow-hidden" : ""}`}>
        <div className="prose prose-sm max-w-none text-[15px] leading-relaxed text-ink-700 prose-p:my-2 prose-ol:my-2 prose-ul:my-2 prose-li:my-0.5 prose-li:marker:font-semibold prose-li:marker:text-brand-600">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              strong: ({ children }) => <mark className="rounded bg-brand-100 px-0.5 font-medium text-ink-900">{children}</mark>,
            }}
          >
            {text}
          </ReactMarkdown>
        </div>
        {!open && long && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-white/0" />}
      </div>
      {long && clamp && (
        <button onClick={() => setOpen(!open)} className="mt-1 flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
          {open ? "Mostrar menos" : "Ver secção completa"}
          <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}
