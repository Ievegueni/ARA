import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { config } from "../config.js";
import { prisma } from "../lib/db.js";
import { search, searchVideos, type RetrievedChunk, type RetrievedVideo } from "../services/retrieval.js";
import { excerptForDisplay } from "../services/format.js";
import { answer, NO_CONTEXT_ANSWER, type ChatTurn } from "../services/llm.js";
import { describeError, isAiActive } from "../services/ai.js";

const chatBody = z.object({
  question: z.string().trim().min(2).max(2000),
  conversationId: z.string().optional(),
  category: z.string().optional(),
});

const NO_RESULTS_ANSWER =
  "Não encontrei no manual nem nos vídeos nada com estes termos. Experimente usar as palavras do manual: " +
  "o nome do alarme, do equipamento ou do sintoma (ex.: “LOS”, “VSWR”, “retificador”).";

type VideoRef = Pick<RetrievedVideo, "id" | "title" | "durationSec" | "score">;

export const fmtDuration = (s: number | null) => (s == null ? "" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

const plural = (n: number, one: string, many: string) => `**${n} ${n === 1 ? one : many}**`;

/** Resposta do modo sem IA: excertos e vídeos mais relevantes, em Markdown (usado para copiar e no histórico). */
export function excerptsAnswer(chunks: RetrievedChunk[], videos: VideoRef[] = []): string {
  if (!chunks.length && !videos.length) return NO_RESULTS_ANSWER;
  const found = [
    chunks.length ? `${plural(chunks.length, "secção", "secções")} do manual` : null,
    videos.length ? plural(videos.length, "vídeo", "vídeos") : null,
  ].filter(Boolean);
  const parts = chunks.map((c) => {
    const pages = c.pageStart === c.pageEnd ? `p. ${c.pageStart}` : `pp. ${c.pageStart}–${c.pageEnd}`;
    return `### ${c.section}\n*${c.documentTitle} v${c.documentVersion} · ${pages}*\n\n${excerptForDisplay(c)}`;
  });
  if (videos.length) {
    const list = videos.map((v) => `- ▶ ${v.title}${v.durationSec != null ? ` (${fmtDuration(v.durationSec)})` : ""}`);
    parts.push(`### Vídeos relacionados\n${list.join("\n")}`);
  }
  return [`Encontrei ${found.join(" e ")}:`, ...parts].join("\n\n");
}

const feedbackBody = z.object({ rating: z.union([z.literal(1), z.literal(-1), z.null()]) });

export async function chatRoutes(app: FastifyInstance) {
  app.get("/api/conversations", { preHandler: requireAuth }, async (req) => {
    const conversations = await prisma.conversation.findMany({
      where: { userId: req.user.sub },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true, updatedAt: true },
    });
    return { conversations };
  });

  app.get<{ Params: { id: string } }>("/api/conversations/:id", { preHandler: requireAuth }, async (req, reply) => {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.user.sub },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation) return reply.code(404).send({ error: "Conversa não encontrada" });
    return { conversation };
  });

  app.delete<{ Params: { id: string } }>("/api/conversations/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { count } = await prisma.conversation.deleteMany({ where: { id: req.params.id, userId: req.user.sub } });
    if (!count) return reply.code(404).send({ error: "Conversa não encontrada" });
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/api/messages/:id/feedback", { preHandler: requireAuth }, async (req, reply) => {
    const body = feedbackBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "rating deve ser 1, -1 ou null" });
    const { count } = await prisma.message.updateMany({
      where: { id: req.params.id, role: "ASSISTANT", conversation: { userId: req.user.sub } },
      data: { rating: body.data.rating },
    });
    if (!count) return reply.code(404).send({ error: "Mensagem não encontrada" });
    return { ok: true };
  });

  /**
   * Sprint 3 — pergunta → resposta. Resposta em Server-Sent Events:
   *   event: meta     { conversationId, userMessageId, sources }
   *   event: delta    { text }
   *   event: done     { messageId }
   *   event: error    { error }
   */
  app.post("/api/chat", { preHandler: requireAuth }, async (req, reply) => {
    const body = chatBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Pergunta inválida (2 a 2000 caracteres)" });
    const { question, category } = body.data;
    const userId = req.user.sub;

    let conversation = body.data.conversationId
      ? await prisma.conversation.findFirst({ where: { id: body.data.conversationId, userId } })
      : null;
    if (body.data.conversationId && !conversation) return reply.code(404).send({ error: "Conversa não encontrada" });

    const previous = conversation
      ? await prisma.message.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" } })
      : [];
    conversation ??= await prisma.conversation.create({
      data: { userId, title: question.length > 60 ? `${question.slice(0, 57)}…` : question },
    });

    const userMessage = await prisma.message.create({
      data: { conversationId: conversation.id, role: "USER", content: question },
    });

    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": req.headers.origin ?? "*",
    });
    const send = (event: string, data: unknown) => raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    const abort = new AbortController();
    raw.on("close", () => abort.abort());

    try {
      // Decidido por pedido: o administrador pode ligar/desligar a IA a qualquer momento
      const aiOn = isAiActive();
      let mode: "ia" | "pesquisa" = aiOn ? "ia" : "pesquisa";
      let chunks: RetrievedChunk[];
      if (aiOn) {
        // Reforça a busca com a pergunta anterior quando é um seguimento curto ("e se não resolver?")
        const lastUser = [...previous].reverse().find((m) => m.role === "USER");
        const retrievalQuery = lastUser && question.length < 60 ? `${lastUser.content}\n${question}` : question;
        chunks = await search(retrievalQuery, { category });
      } else {
        chunks = await search(question, { category, topK: config.KEYWORD_ANSWER_CHUNKS });
      }
      // Vídeos: pesquisa pelo título/descrição (palavras-chave), com e sem IA
      const videos: VideoRef[] = (await searchVideos(question)).map(({ id, title, durationSec, score }) => ({
        id,
        title,
        durationSec,
        score: Number(score.toFixed(3)),
      }));
      const toSources = (m: typeof mode) =>
        chunks.map((c) => ({
          chunkId: c.id,
          document: `${c.documentTitle} v${c.documentVersion}`,
          section: c.section,
          pageStart: c.pageStart,
          pageEnd: c.pageEnd,
          score: Number(c.score.toFixed(3)),
          // Sem IA o excerto é a própria resposta: texto completo com os termos destacados
          excerpt: m === "pesquisa" ? excerptForDisplay(c) : c.text.slice(0, 600),
        }));
      let sources = toSources(mode);
      send("meta", { conversationId: conversation.id, userMessageId: userMessage.id, sources, videos, mode });

      let text: string;
      if (!aiOn) {
        text = excerptsAnswer(chunks, videos);
        send("delta", { text });
      } else if (!chunks.length) {
        text = NO_CONTEXT_ANSWER;
        send("delta", { text });
      } else {
        // Respostas antigas do modo sem IA são listas longas de excertos: resumidas para não encher o contexto
        const history: ChatTurn[] = previous.map((m) => ({
          role: m.role === "USER" ? "user" : "assistant",
          content:
            m.role === "ASSISTANT" && m.mode === "pesquisa"
              ? "[Foram mostrados ao técnico excertos do manual relacionados com a pergunta anterior.]"
              : m.content,
        }));
        let streamed = false;
        try {
          text = await answer(
            question,
            chunks,
            history,
            (t) => {
              streamed = true;
              send("delta", { text: t });
            },
            abort.signal,
          );
        } catch (err) {
          // Se o Claude falhar antes de começar a responder (chave inválida, sem crédito, sem rede),
          // o técnico recebe os excertos do manual em vez de um erro; o aviso explica porquê.
          if (streamed || abort.signal.aborted) throw err;
          req.log.warn({ err }, "IA indisponível — a responder com excertos do manual");
          mode = "pesquisa";
          sources = toSources(mode);
          text = excerptsAnswer(chunks, videos);
          send("fallback", { text, sources, mode, notice: `A IA não respondeu (${describeError(err)}). A mostrar os excertos do manual.` });
        }
      }

      const saved = await prisma.message.create({
        data: { conversationId: conversation.id, role: "ASSISTANT", content: text, sources, videos, mode },
      });
      await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
      send("done", { messageId: saved.id });
    } catch (err) {
      req.log.error(err);
      if (!abort.signal.aborted) send("error", { error: "Erro ao gerar resposta. Tente novamente." });
    } finally {
      raw.end();
    }
  });
}
