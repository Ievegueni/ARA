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

    /**
     * Estado inicial da IA, usado só até o administrador usar o interruptor na interface
     * (a partir daí vale o valor guardado na base de dados). Ver services/ai.ts.
     */
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

    /** Pasta onde ficam os PDF originais dos manuais (para "Ver página no manual"). */
    DOCUMENT_DIR: z.string().default("./storage/manuals"),
    /** Pasta onde os vídeos ficam guardados no VPS. */
    VIDEO_DIR: z.string().default("./storage/videos"),
    /** Tamanho máximo por vídeo (MB). Ajustar também o client_max_body_size do Nginx. */
    MAX_VIDEO_MB: z.coerce.number().int().min(1).default(500),
    /** Vídeos sugeridos por resposta no chat. */
    VIDEO_ANSWER_COUNT: z.coerce.number().int().min(0).max(10).default(2),
  })
  // Chaves vazias contam como ausentes ("ANTHROPIC_API_KEY=" no .env)
  .transform((c) => ({ ...c, ANTHROPIC_API_KEY: c.ANTHROPIC_API_KEY || undefined, VOYAGE_API_KEY: c.VOYAGE_API_KEY || undefined }));

export const config = schema.parse(process.env);

/** Dimensão do vector guardado em pgvector (tem de bater com a migração). */
export const EMBEDDING_DIM = 1024;
