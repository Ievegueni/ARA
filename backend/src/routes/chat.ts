import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { config } from "../config.js";
import { prisma } from "../lib/db.js";
import { search, type RetrievedChunk } from "../services/retrieval.js";
import { excerptForDisplay } from "../services/format.js";
import { answer, NO_CONTEXT_ANSWER, type ChatTurn } from "../services/llm.js";

const chatBody = z.object({
  question: z.string().trim().min(2).max(2000),
  conversationId: z.string().optional(),
  category: z.string().optional(),
});

const NO_RESULTS_ANSWER =
  "Não encontrei no manual nenhuma secção com estes termos. Experimente usar as palavras do manual: " +
  "o nome do alarme, do equipamento ou do sintoma (ex.: “LOS”, “VSWR”, “retificador”).";

/** Resposta do modo sem IA: os excertos mais relevantes, em Markdown (usado para copiar e no histórico). */
function excerptsAnswer(chunks: RetrievedChunk[]): string {
  if (!chunks.length) return NO_RESULTS_ANSWER;
  const intro = chunks.length === 1 ? "Encontrei **1 secção** do manual relacionada:" : `Encontrei **${chunks.length} secções** do manual relacionadas:`;
  const parts = chunks.map((c) => {
    const pages = c.pageStart === c.pageEnd ? `p. ${c.pageStart}` : `pp. ${c.pageStart}–${c.pageEnd}`;
    return `### ${c.section}\n*${c.documentTitle} v${c.documentVersion} · ${pages}*\n\n${excerptForDisplay(c)}`;
  });
  return [intro, ...parts].join("\n\n");
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
      const mode = config.AI_ENABLED ? "ia" : "pesquisa";
      let chunks: RetrievedChunk[];
      if (config.AI_ENABLED) {
        // Reforça a busca com a pergunta anterior quando é um seguimento curto ("e se não resolver?")
        const lastUser = [...previous].reverse().find((m) => m.role === "USER");
        const retrievalQuery = lastUser && question.length < 60 ? `${lastUser.content}\n${question}` : question;
        chunks = await search(retrievalQuery, { category });
      } else {
        chunks = await search(question, { category, topK: config.KEYWORD_ANSWER_CHUNKS });
      }
      const sources = chunks.map((c) => ({
        chunkId: c.id,
        document: `${c.documentTitle} v${c.documentVersion}`,
        section: c.section,
        pageStart: c.pageStart,
        pageEnd: c.pageEnd,
        score: Number(c.score.toFixed(3)),
        // Sem IA o excerto é a própria resposta: texto completo com os termos destacados
        excerpt: mode === "pesquisa" ? excerptForDisplay(c) : c.text.slice(0, 600),
      }));
      send("meta", { conversationId: conversation.id, userMessageId: userMessage.id, sources, mode });

      let text: string;
      if (!config.AI_ENABLED) {
        text = excerptsAnswer(chunks);
        send("delta", { text });
      } else if (!chunks.length) {
        text = NO_CONTEXT_ANSWER;
        send("delta", { text });
      } else {
        const history: ChatTurn[] = previous.map((m) => ({
          role: m.role === "USER" ? "user" : "assistant",
          content: m.content,
        }));
        text = await answer(question, chunks, history, (t) => send("delta", { text: t }), abort.signal);
      }

      const saved = await prisma.message.create({
        data: { conversationId: conversation.id, role: "ASSISTANT", content: text, sources, mode },
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
