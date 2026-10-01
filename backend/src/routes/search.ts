import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { listCategories, search, searchVideos } from "../services/retrieval.js";
import { streamUrl } from "../lib/stream-token.js";
import { excerptForDisplay } from "../services/format.js";

const query = z.object({
  q: z.string().min(2).max(1000),
  topK: z.coerce.number().int().min(1).max(20).optional(),
  minScore: z.coerce.number().min(0).max(1).optional(),
  category: z.string().optional(),
});

export async function searchRoutes(app: FastifyInstance) {
  /** Pesquisa direta no manual (palavras-chave sem IA; semântica com IA) e nos vídeos (título/descrição). */
  app.get("/api/search", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = query.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: "Parâmetro q obrigatório (mín. 2 caracteres)" });
    const { q, ...opts } = parsed.data;
    const [results, videos] = await Promise.all([search(q, opts), searchVideos(q, { topK: 6, minScore: opts.minScore })]);
    return {
      query: q,
      results: results.map((r) => ({ ...r, display: excerptForDisplay(r) })),
      videos: videos.map((v) => ({ ...v, streamUrl: streamUrl(v.id) })),
    };
  });

  app.get("/api/categories", { preHandler: requireAuth }, async () => ({ categories: await listCategories() }));
}
