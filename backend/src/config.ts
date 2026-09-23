import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET deve ter pelo menos 32 caracteres"),
  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_MODEL: z.string().default("claude-opus-5"),
  EMBEDDINGS_PROVIDER: z.enum(["voyage", "local"]).default("voyage"),
  VOYAGE_API_KEY: z.string().optional(),
  VOYAGE_MODEL: z.string().default("voyage-3.5"),
  RETRIEVAL_TOP_K: z.coerce.number().int().min(1).max(20).default(6),
  RETRIEVAL_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.35),
});

export const config = schema.parse(process.env);

/** Dimensão do vector guardado em pgvector (tem de bater com a migração). */
export const EMBEDDING_DIM = 1024;
