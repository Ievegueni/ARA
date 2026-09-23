import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { prisma } from "../lib/db.js";
import { listCategories, search } from "../services/retrieval.js";

const query = z.object({
  q: z.string().min(2).max(1000),
  topK: z.coerce.number().int().min(1).max(20).optional(),
  minScore: z.coerce.number().min(0).max(1).optional(),
  category: z.string().optional(),
});

export async function searchRoutes(app: FastifyInstance) {
  /** Sprint 2 — busca semântica pura (sem LLM), para validar o retrieval. */
  app.get("/api/search", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = query.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: "Parâmetro q obrigatório (mín. 2 caracteres)" });
    const { q, ...opts } = parsed.data;
    const results = await search(q, opts);
    return { query: q, results };
  });

  app.get("/api/categories", { preHandler: requireAuth }, async () => ({ categories: await listCategories() }));

  app.get("/api/documents", { preHandler: requireAuth }, async () => {
    const documents = await prisma.document.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, version: true, fileName: true, pages: true, createdAt: true, _count: { select: { chunks: true } } },
    });
    return { documents };
  });
}
