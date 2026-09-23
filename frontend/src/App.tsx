import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Menu } from "lucide-react";
import { api, auth, setUnauthorizedHandler, streamChat, type ConversationSummary, type Mode, type User } from "./lib/api";
import { Login } from "./components/Login";
import { Sidebar, type View } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { SearchView } from "./components/SearchView";
import { ManualsView } from "./components/ManualsView";
import { CategorySelect } from "./components/CategorySelect";
import type { UiMessage } from "./components/MessageView";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(!!auth.token);

  const logout = useCallback(() => {
    auth.set(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!auth.token) return;
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(logout)
      .finally(() => setBooting(false));
  }, [logout]);

  if (booting) {
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="size-6 animate-spin text-brand-500" />
      </div>
    );
  }
  return user ? <Shell user={user} onLogout={logout} /> : <Login onLogin={setUser} />;
}

function Shell({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [view, setView] = useState<View>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loadingConv, setLoadingConv] = useState(false);
  const [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [mode, setMode] = useState<Mode>("pesquisa");
  const abortRef = useRef<AbortController | null>(null);

  const refreshConversations = useCallback(() => {
    api.conversations().then((r) => setConversations(r.conversations)).catch(() => {});
  }, []);

  const refreshCategories = useCallback(() => {
    api.categories().then((r) => setCategories(r.categories)).catch(() => {});
  }, []);

  useEffect(() => {
    refreshConversations();
    refreshCategories();
    api.health().then((h) => setMode(h.mode)).catch(() => {});
  }, [refreshConversations, refreshCategories]);

  function newConversation() {
    abortRef.current?.abort();
    setActiveId(null);
    setMessages([]);
    setView("chat");
    setSidebarOpen(false);
  }

  async function openConversation(id: string) {
    abortRef.current?.abort();
    setView("chat");
    setSidebarOpen(false);
    setActiveId(id);
    setLoadingConv(true);
    try {
      const { conversation } = await api.conversation(id);
      setMessages(conversation.messages);
    } catch {
      setMessages([]);
    } finally {
      setLoadingConv(false);
    }
  }

  async function deleteConversation(id: string) {
    if (!confirm("Apagar esta conversa?")) return;
    await api.deleteConversation(id).catch(() => {});
    if (id === activeId) newConversation();
    refreshConversations();
  }

  async function send(question: string) {
    if (busy) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    const tmpUser = `tmp-u-${Date.now()}`;
    const tmpBot = `tmp-a-${Date.now()}`;
    setMessages((m) => [
      ...m,
      { id: tmpUser, role: "USER", content: question },
      { id: tmpBot, role: "ASSISTANT", content: "", streaming: true, mode },
    ]);
    let botId = tmpBot;
    const patchBot = (fn: (m: UiMessage) => UiMessage) =>
      setMessages((all) => all.map((m) => (m.id === tmpBot || m.id === botId ? fn(m) : m)));

    try {
      await streamChat(
        { question, conversationId: activeId ?? undefined, category: category || undefined },
        {
          onMeta: ({ conversationId, userMessageId, sources, mode }) => {
            setActiveId(conversationId);
            setMessages((all) => all.map((m) => (m.id === tmpUser ? { ...m, id: userMessageId } : m)));
            patchBot((m) => ({ ...m, sources, mode }));
            refreshConversations();
          },
          onDelta: (t) => patchBot((m) => ({ ...m, content: m.content + t })),
          onDone: ({ messageId }) => {
            patchBot((m) => ({ ...m, id: messageId, streaming: false }));
            botId = messageId;
          },
          onError: (error) => patchBot((m) => ({ ...m, streaming: false, error })),
        },
        ctrl.signal,
      );
    } catch {
      if (!ctrl.signal.aborted) patchBot((m) => ({ ...m, streaming: false, error: "Ligação ao servidor interrompida" }));
    } finally {
      patchBot((m) => ({ ...m, streaming: false }));
      setBusy(false);
      refreshConversations();
    }
  }

  const title =
    view === "search" ? "Pesquisa no manual" : view === "manuals" ? "Manuais" : conversations.find((c) => c.id === activeId)?.title ?? "Nova conversa";

  return (
    <div className="flex h-full">
      <Sidebar
        user={user}
        view={view}
        conversations={conversations}
        activeId={activeId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNew={newConversation}
        onSelect={openConversation}
        onDelete={deleteConversation}
        onView={(v) => {
          setView(v);
          setSidebarOpen(false);
        }}
        onLogout={onLogout}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-ink-100 bg-white/80 px-4 backdrop-blur">
          <button onClick={() => setSidebarOpen(true)} className="-ml-1 rounded-lg p-1.5 text-ink-600 hover:bg-ink-100 lg:hidden" aria-label="Abrir menu">
            <Menu className="size-5" />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-800">{title}</h2>
          {view !== "manuals" && <CategorySelect categories={categories} value={category} onChange={setCategory} />}
        </header>

        {view === "chat" ? (
          <ChatView
            user={user}
            mode={mode}
            messages={messages}
            busy={busy}
            loading={loadingConv}
            onSend={send}
            onStop={() => abortRef.current?.abort()}
          />
        ) : view === "search" ? (
          <SearchView category={category} />
        ) : (
          <ManualsView onChanged={refreshCategories} />
        )}
      </main>
    </div>
  );
}
