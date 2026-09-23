import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";

interface Props {
  busy: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  autoFocus?: boolean;
}

export function Composer({ busy, onSend, onStop, autoFocus }: Props) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  function submit() {
    const q = text.trim();
    if (q.length < 2 || busy) return;
    onSend(q);
    setText("");
  }

  return (
    <div className="rounded-2xl bg-white p-2 shadow-lg shadow-ink-900/5 ring-1 ring-ink-200 transition focus-within:ring-2 focus-within:ring-brand-400">
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          rows={1}
          autoFocus={autoFocus}
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Descreva a avaria ou o alarme…"
          className="scroll-thin max-h-[200px] flex-1 resize-none bg-transparent px-3 py-2.5 text-base outline-none sm:text-[15px] placeholder:text-ink-400"
        />
        {busy ? (
          <button onClick={onStop} className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink-900 text-white transition hover:bg-ink-700" aria-label="Parar">
            <Square className="size-3.5" fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={text.trim().length < 2}
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-500 text-white shadow-md shadow-brand-500/30 transition hover:bg-brand-600 disabled:bg-ink-200 disabled:shadow-none"
            aria-label="Enviar"
          >
            <ArrowUp className="size-5" />
          </button>
        )}
      </div>
    </div>
  );
}
