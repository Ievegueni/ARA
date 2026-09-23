import { config } from "../config.js";
import { prisma, toVectorLiteral } from "../lib/db.js";
import { embed } from "./embeddings.js";

export interface RetrievedChunk {
  id: string;
  documentTitle: string;
  documentVersion: string;
  section: string;
  category: string | null;
  pageStart: number;
  pageEnd: number;
  text: string;
  score: number; // similaridade cosseno (0–1)
}

export interface SearchOptions {
  topK?: number;
  minScore?: number;
  category?: string;
}

/** Busca semântica: embedding da pergunta vs. embeddings dos chunks (cosine). */
export async function search(query: string, opts: SearchOptions = {}): Promise<RetrievedChunk[]> {
  const topK = opts.topK ?? config.RETRIEVAL_TOP_K;
  const minScore = opts.minScore ?? config.RETRIEVAL_MIN_SCORE;
  const [vector] = await embed([query], "query");
  const v = toVectorLiteral(vector);

  const rows = await prisma.$queryRaw<RetrievedChunk[]>`
    SELECT c.id, d.title AS "documentTitle", d.version AS "documentVersion",
           c.section, c.category, c."pageStart", c."pageEnd", c.text,
           1 - (c.embedding <=> ${v}::vector) AS score
    FROM "Chunk" c
    JOIN "Document" d ON d.id = c."documentId"
    WHERE c.embedding IS NOT NULL
      AND (${opts.category ?? null}::text IS NULL OR c.category = ${opts.category ?? null})
    ORDER BY c.embedding <=> ${v}::vector
    LIMIT ${topK}`;

  return rows.map((r) => ({ ...r, score: Number(r.score) })).filter((r) => r.score >= minScore);
}

export async function listCategories(): Promise<string[]> {
  const rows = await prisma.chunk.findMany({
    where: { category: { not: null } },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });
  return rows.map((r) => r.category!).filter(Boolean);
}
