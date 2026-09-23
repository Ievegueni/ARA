import { LogOut, MessageSquareText, Plus, Search, Trash2, X } from "lucide-react";
import type { ConversationSummary, User } from "../lib/api";
import { Logo } from "./Logo";

export type View = "chat" | "search";

interface Props {
  user: User;
  view: View;
  conversations: ConversationSummary[];
  activeId: string | null;
  open: boolean;
  onClose: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onView: (v: View) => void;
  onLogout: () => void;
}

function groupByDate(items: ConversationSummary[]) {
  const today = new Date().setHours(0, 0, 0, 0);
  const groups: Record<string, ConversationSummary[]> = {};
  for (const c of items) {
    const d = new Date(c.updatedAt).getTime();
    const label = d >= today ? "Hoje" : d >= today - 86_400_000 ? "Ontem" : d >= today - 7 * 86_400_000 ? "Últimos 7 dias" : "Mais antigas";
    (groups[label] ??= []).push(c);
  }
  return Object.entries(groups);
}

export function Sidebar(p: Props) {
  const initials = p.user.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      {p.open && <div className="fixed inset-0 z-30 bg-navy-950/50 backdrop-blur-sm lg:hidden" onClick={p.onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-navy-950 text-navy-100 transition-transform duration-300 lg:static lg:translate-x-0 ${
          p.open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between px-5 pt-6 pb-5">
          <Logo dark />
          <button onClick={p.onClose} className="rounded-lg p-1.5 text-navy-300 hover:bg-white/5 lg:hidden" aria-label="Fechar menu">
            <X className="size-5" />
          </button>
        </div>

        <div className="px-3">
          <button
            onClick={p.onNew}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition hover:bg-brand-600"
          >
            <Plus className="size-4" /> Nova conversa
          </button>

          <nav className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1 text-xs font-medium">
            {(
              [
                ["chat", MessageSquareText, "Assistente"],
                ["search", Search, "Pesquisa"],
              ] as const
            ).map(([v, Icon, label]) => (
              <button
                key={v}
                onClick={() => p.onView(v)}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition ${
                  p.view === v ? "bg-white/10 text-white" : "text-navy-300 hover:text-white"
                }`}
              >
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="scroll-dark mt-4 flex-1 overflow-y-auto px-3 pb-4">
          {p.conversations.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-navy-300/80">As suas conversas aparecem aqui.</p>
          ) : (
            groupByDate(p.conversations).map(([label, items]) => (
              <div key={label} className="mb-4">
                <div className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-navy-300/80 uppercase">{label}</div>
                {items.map((c) => {
                  const active = c.id === p.activeId && p.view === "chat";
                  return (
                    <div
                      key={c.id}
                      className={`group relative flex items-center rounded-lg text-sm transition ${
                        active ? "bg-white/10 text-white" : "text-navy-100 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand-500" />}
                      <button onClick={() => p.onSelect(c.id)} className="min-w-0 flex-1 truncate px-3 py-2 text-left">
                        {c.title}
                      </button>
                      <button
                        onClick={() => p.onDelete(c.id)}
                        className="mr-1.5 rounded-md p-1 text-navy-300/80 opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-red-400 focus:opacity-100"
                        aria-label="Apagar conversa"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-white/5 px-4 py-4">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-xs font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium text-white">{p.user.name}</div>
            <div className="truncate text-xs text-navy-300/80">{p.user.section ?? (p.user.role === "ADMIN" ? "Administrador" : "Técnico")}</div>
          </div>
          <button onClick={p.onLogout} className="rounded-lg p-2 text-navy-300 transition hover:bg-white/5 hover:text-white" aria-label="Sair" title="Sair">
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>
    </>
  );
}
