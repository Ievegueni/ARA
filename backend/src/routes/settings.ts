import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../lib/auth.js";
import { AiUnavailableError, getAiState, setAiEnabled, testConnections } from "../services/ai.js";

const body = z.object({ enabled: z.boolean() });

/** Interruptor da IA (só administradores). As chaves API nunca são devolvidas, só se existem. */
export async function settingsRoutes(app: FastifyInstance) {
  app.get("/api/settings/ai", { preHandler: requireAdmin }, async () => ({ ai: await getAiState() }));

  app.put("/api/settings/ai", { preHandler: requireAdmin }, async (req, reply) => {
    const parsed = body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "enabled deve ser true ou false" });
    try {
      const ai = await setAiEnabled(parsed.data.enabled);
      req.log.info({ user: req.user.username, enabled: ai.enabled }, "IA ligada/desligada");
      return { ai };
    } catch (err) {
      if (err instanceof AiUnavailableError) return reply.code(409).send({ error: err.message });
      throw err;
    }
  });

  app.post(
    "/api/settings/ai/test",
    { preHandler: requireAdmin, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async () => ({ result: await testConnections() }),
  );
}
