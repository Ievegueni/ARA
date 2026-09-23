import "dotenv/config";
import { z } from "zod";

const bool = z.enum(["true", "false"]).default("false").transform((v) => v === "true");

const schema = z
  .object({
    DATABASE_URL: z.string().min(1),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default("0.0.0.0"),
    CORS_ORIGIN: z.string().default("http://localhost:5173"),
    JWT_SECRET: z.string().min(32, "JWT_SECRET deve ter pelo menos 32 caracteres"),

    /** false = pesquisa por palavras-chave, sem serviços externos. true = pesquisa semântica (Voyage) + resposta do Claude. */
    AI_ENABLED: bool,
    ANTHROPIC_API_KEY: z.string().optional(),
    CLAUDE_MODEL: z.string().default("claude-sonnet-5"),
    VOYAGE_API_KEY: z.string().optional(),
    VOYAGE_MODEL: z.string().default("voyage-4"),

    RETRIEVAL_TOP_K: z.coerce.number().int().min(1).max(20).default(6),
    /** Pesquisa semântica: similaridade mínima (0–1). */
    RETRIEVAL_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.35),
    /** Pesquisa por palavras-chave: fração mínima dos termos da pergunta presentes no excerto (0–1). */
    KEYWORD_MIN_COVERAGE: z.coerce.number().min(0).max(1).default(0.3),
    /** Excertos mostrados por resposta no modo sem IA. */
    KEYWORD_ANSWER_CHUNKS: z.coerce.number().int().min(1).max(10).default(3),
  })
  .superRefine((c, ctx) => {
    if (!c.AI_ENABLED) return;
    if (!c.ANTHROPIC_API_KEY) ctx.addIssue({ code: "custom", path: ["ANTHROPIC_API_KEY"], message: "obrigatória com AI_ENABLED=true" });
    if (!c.VOYAGE_API_KEY) ctx.addIssue({ code: "custom", path: ["VOYAGE_API_KEY"], message: "obrigatória com AI_ENABLED=true" });
  });

export const config = schema.parse(process.env);

/** Dimensão do vector guardado em pgvector (tem de bater com a migração). */
export const EMBEDDING_DIM = 1024;
