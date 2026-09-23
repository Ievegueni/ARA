export interface User {
  id: string;
  username: string;
  name: string;
  role: "TECNICO" | "ADMIN";
  section: string | null;
}

export interface Source {
  chunkId: string;
  document: string;
  section: string;
  pageStart: number;
  pageEnd: number;
  score: number;
  excerpt: string;
}

export interface Message {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  sources?: Source[] | null;
  rating?: number | null;
  createdAt?: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface SearchResult {
  id: string;
  documentTitle: string;
  documentVersion: string;
  section: string;
  category: string | null;
  pageStart: number;
  pageEnd: number;
  text: string;
  score: number;
}

const TOKEN_KEY = "ara.token";

export const auth = {
  get token() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* armazenamento indisponível */
    }
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn);

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (auth.token) headers.set("Authorization", `Bearer ${auth.token}`);
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401 && auth.token) onUnauthorized();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Erro inesperado");
  return data as T;
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<{ user: User }>("/api/auth/me"),
  conversations: () => request<{ conversations: ConversationSummary[] }>("/api/conversations"),
  conversation: (id: string) =>
    request<{ conversation: ConversationSummary & { messages: Message[] } }>(`/api/conversations/${id}`),
  deleteConversation: (id: string) => request(`/api/conversations/${id}`, { method: "DELETE" }),
  feedback: (messageId: string, rating: 1 | -1 | null) =>
    request(`/api/messages/${messageId}/feedback`, { method: "POST", body: JSON.stringify({ rating }) }),
  categories: () => request<{ categories: string[] }>("/api/categories"),
  search: (q: string, category?: string) => {
    const p = new URLSearchParams({ q, topK: "8", minScore: "0" });
    if (category) p.set("category", category);
    return request<{ results: SearchResult[] }>(`/api/search?${p}`);
  },
};

export interface ChatHandlers {
  onMeta: (m: { conversationId: string; userMessageId: string; sources: Source[] }) => void;
  onDelta: (text: string) => void;
  onDone: (m: { messageId: string }) => void;
  onError: (error: string) => void;
}

/** POST /api/chat com leitura do stream SSE. */
export async function streamChat(
  body: { question: string; conversationId?: string; category?: string },
  h: ChatHandlers,
  signal?: AbortSignal,
) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token ?? ""}` },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    if (res.status === 401) onUnauthorized();
    const data = await res.json().catch(() => ({}));
    h.onError(data.error ?? "Erro ao contactar o servidor");
    return;
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const event = /^event: (.*)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      if (!event || !data) continue;
      const payload = JSON.parse(data);
      if (event === "meta") h.onMeta(payload);
      else if (event === "delta") h.onDelta(payload.text);
      else if (event === "done") h.onDone(payload);
      else if (event === "error") h.onError(payload.error);
    }
  }
}
