import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { prisma } from "./lib/db.js";
import { authRoutes } from "./routes/auth.js";
import { searchRoutes } from "./routes/search.js";
import { chatRoutes } from "./routes/chat.js";

export async function buildApp() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });

  await app.register(cors, { origin: config.CORS_ORIGIN.split(",").map((s) => s.trim()) });
  await app.register(jwt, { secret: config.JWT_SECRET });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

  app.get("/api/health", async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, model: config.CLAUDE_MODEL, embeddings: config.EMBEDDINGS_PROVIDER };
  });

  await app.register(authRoutes);
  await app.register(searchRoutes);
  await app.register(chatRoutes);
  return app;
}
