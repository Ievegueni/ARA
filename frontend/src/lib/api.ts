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
  /** "pesquisa" = excertos do manual (sem IA) | "ia" = resposta do Claude */
  mode?: Mode;
  videos?: VideoRef[] | null;
  createdAt?: string;
}

export type Mode = "ia" | "pesquisa";

/** Estado do interruptor da IA (administrador). As chaves API nunca chegam ao navegador, só se existem. */
export interface AiState {
  enabled: boolean;
  active: boolean;
  model: string;
  keys: { claude: boolean; voyage: boolean };
  search: "semantica" | "palavras-chave";
  missingEmbeddings: number;
  backfill: { running: boolean; done: number; total: number; error: string | null };
}

export interface AiTestResult {
  claude: { ok: boolean; message: string };
  voyage: { ok: boolean; message: string } | null;
}

/** Vídeo sugerido numa resposta ou numa pesquisa. */
export interface VideoRef {
  id: string;
  title: string;
  durationSec: number | null;
  score: number;
  description?: string | null;
  /** URL de reprodução assinado (expira); presente na pesquisa, não no histórico. */
  streamUrl?: string;
}

export interface VideoInfo {
  id: string;
  title: string;
  description: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  durationSec: number | null;
  createdAt: string;
  streamUrl: string;
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
  /** Texto pronto a mostrar (Markdown, termos encontrados a negrito). */
  display: string;
  score: number;
}

/** Onde está uma secção no manual (para "Ver página"). fileUrl é null se o PDF original não foi guardado. */
export interface ChunkPage {
  section: string;
  pageStart: number;
  pageEnd: number;
  document: { id: string; title: string; version: string; pages: number };
  fileUrl: string | null;
}

export interface DocumentInfo {
  id: string;
  title: string;
  version: string;
  fileName: string;
  pages: number;
  createdAt: string;
  _count: { chunks: number };
  /** false nos manuais carregados antes de se guardar o PDF original. */
  hasFile: boolean;
}

export type IngestStage = "extracting" | "chunking" | "embedding" | "saving";

export interface IngestJob {
  id: string;
  title: string;
  version: string;
  fileName: string;
  status: "running" | "done" | "error";
  stage: IngestStage;
  done: number;
  total: number;
  result?: { documentId: string; pages: number; chunks: number };
  error?: string;
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
  aiState: () => request<{ ai: AiState }>("/api/settings/ai").then((r) => r.ai),
  setAi: (enabled: boolean) =>
    request<{ ai: AiState }>("/api/settings/ai", { method: "PUT", body: JSON.stringify({ enabled }) }).then((r) => r.ai),
  testAi: () => request<{ result: AiTestResult }>("/api/settings/ai/test", { method: "POST" }).then((r) => r.result),
  health: () => request<{ ok: boolean; mode: Mode; model: string | null }>("/api/health"),
  me: () => request<{ user: User }>("/api/auth/me"),
  conversations: () => request<{ conversations: ConversationSummary[] }>("/api/conversations"),
  conversation: (id: string) =>
    request<{ conversation: ConversationSummary & { messages: Message[] } }>(`/api/conversations/${id}`),
  deleteConversation: (id: string) => request(`/api/conversations/${id}`, { method: "DELETE" }),
  feedback: (messageId: string, rating: 1 | -1 | null) =>
    request(`/api/messages/${messageId}/feedback`, { method: "POST", body: JSON.stringify({ rating }) }),
  videos: () => request<{ videos: VideoInfo[] }>("/api/videos"),
  video: (id: string) => request<{ video: VideoInfo }>(`/api/videos/${id}`),
  updateVideo: (id: string, data: { title?: string; description?: string | null }) =>
    request<{ video: VideoInfo }>(`/api/videos/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteVideo: (id: string) => request(`/api/videos/${id}`, { method: "DELETE" }),
  chunkPage: (chunkId: string) => request<ChunkPage>(`/api/chunks/${chunkId}/page`),
  documents: () => request<{ documents: DocumentInfo[] }>("/api/documents"),
  job: (id: string) => request<{ job: IngestJob }>(`/api/documents/jobs/${id}`),
  deleteDocument: (id: string) => request(`/api/documents/${id}`, { method: "DELETE" }),
  categories: () => request<{ categories: string[] }>("/api/categories"),
  search: (q: string, category?: string) => {
    const p = new URLSearchParams({ q, topK: "8", minScore: "0" });
    if (category) p.set("category", category);
    return request<{ results: SearchResult[]; videos: VideoRef[] }>(`/api/search?${p}`);
  },
};

/**
 * Envia um formulário com progresso (XHR, porque fetch não expõe progresso de upload).
 * Os campos vão antes do ficheiro: o servidor só os lê se chegarem primeiro.
 */
function uploadForm<T>(url: string, fields: Record<string, string>, file: File, onProgress: (fraction: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    if (auth.token) xhr.setRequestHeader("Authorization", `Bearer ${auth.token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let data: T & { error?: string } = {} as T & { error?: string };
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* resposta não JSON (ex.: 413 do Nginx) */
      }
      if (xhr.status === 401) onUnauthorized();
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(xhr.status, data.error ?? (xhr.status === 413 ? "Ficheiro demasiado grande para o servidor" : "Erro no upload")));
    };
    xhr.onerror = () => reject(new ApiError(0, "Falha de ligação durante o upload"));
    xhr.send(form);
  });
}

export const uploadManual = (file: File, title: string, version: string, onProgress: (fraction: number) => void) =>
  uploadForm<{ job: IngestJob }>("/api/documents", { title, version }, file, onProgress).then((d) => d.job);

export const uploadVideo = (
  file: File,
  data: { title: string; description: string; durationSec?: number },
  onProgress: (fraction: number) => void,
) =>
  uploadForm<{ video: VideoInfo }>(
    "/api/videos",
    {
      title: data.title,
      ...(data.description ? { description: data.description } : {}),
      ...(data.durationSec != null ? { durationSec: String(Math.round(data.durationSec)) } : {}),
    },
    file,
    onProgress,
  ).then((d) => d.video);

export interface ChatHandlers {
  onMeta: (m: { conversationId: string; userMessageId: string; sources: Source[]; videos: VideoRef[]; mode: Mode }) => void;
  onDelta: (text: string) => void;
  onDone: (m: { messageId: string }) => void;
  /** A IA falhou antes de responder: o servidor envia os excertos do manual em vez da resposta. */
  onFallback: (m: { text: string; sources: Source[]; mode: Mode; notice: string }) => void;
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
      else if (event === "fallback") h.onFallback(payload);
      else if (event === "error") h.onError(payload.error);
    }
  }
}
