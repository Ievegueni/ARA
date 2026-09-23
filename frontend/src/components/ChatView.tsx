import { useEffect, useRef } from "react";
import { ShieldAlert } from "lucide-react";
import type { User } from "../lib/api";
import { Composer } from "./Composer";
import { EmptyState } from "./EmptyState";
import { MessageView, type UiMessage } from "./MessageView";

interface Props {
  user: User;
  messages: UiMessage[];
  busy: boolean;
  loading: boolean;
  onSend: (q: string) => void;
  onStop: () => void;
}

export function ChatView({ user, messages, busy, loading, onSend, onStop }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: busy ? "auto" : "smooth", block: "end" });
  }, [messages.length, last?.content, busy]);

  return (
    <>
      <div className="scroll-thin flex-1 overflow-y-auto">
        {loading ? (
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-3">
                <div className="ml-auto h-10 w-1/2 animate-pulse rounded-2xl bg-ink-200/70" />
                <div className="h-28 w-5/6 animate-pulse rounded-2xl bg-white" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <EmptyState name={user.name} onPick={onSend} />
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
            {messages.map((m) => (
              <MessageView key={m.id} m={m} />
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="bg-gradient-to-t from-ink-50 via-ink-50 to-ink-50/0 px-4 pt-2 pb-4">
        <div className="mx-auto max-w-3xl">
          <Composer busy={busy} onSend={onSend} onStop={onStop} autoFocus />
          <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-400">
            <ShieldAlert className="size-3" />
            Respostas baseadas apenas no manual do técnico. Confirme sempre procedimentos críticos e normas de segurança.
          </p>
        </div>
      </div>
    </>
  );
}
