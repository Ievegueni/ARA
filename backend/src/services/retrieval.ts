import { config } from "../config.js";
import { prisma, toVectorLiteral } from "../lib/db.js";
import { embed } from "./embeddings.js";
import { cleanQuestion } from "./keywords.js";

export interface RetrievedChunk {
  id: string;
  documentTitle: string;
  documentVersion: string;
  section: string;
  category: string | null;
  pageStart: number;
  pageEnd: number;
  text: string;
  /** Texto com os termos encontrados marcados a **negrito** (só na pesquisa por palavras-chave). */
  highlighted?: string;
  /** 0–1. Palavras-chave: fração dos termos da pergunta presentes. Semântica: similaridade cosseno. */
  score: number;
}

export interface SearchOptions {
  topK?: number;
  minScore?: number;
  category?: string;
}

/** Pesquisa no manual: semântica (com IA) ou por palavras-chave (sem IA). */
export function search(query: string, opts: SearchOptions = {}): Promise<RetrievedChunk[]> {
  return config.AI_ENABLED ? semanticSearch(query, opts) : keywordSearch(query, opts);
}

/**
 * Full-text search em português (sem acentos, com radicais: "arrancou" ≈ "arranque").
 * Usa OU entre os termos e ordena pela fração de termos encontrados e depois pelo ts_rank
 * (o título da secção pesa mais do que o corpo).
 */
export async function keywordSearch(query: string, opts: SearchOptions = {}): Promise<RetrievedChunk[]> {
  const topK = opts.topK ?? config.RETRIEVAL_TOP_K;
  const minScore = opts.minScore ?? config.KEYWORD_MIN_COVERAGE;
  const category = opts.category ?? null;
  const q = cleanQuestion(query);

  const [{ lexemes }] = await prisma.$queryRaw<{ lexemes: string[] }[]>`
    SELECT coalesce(array(
      SELECT DISTINCT m[1] FROM regexp_matches(plainto_tsquery('pt_unaccent', ${q})::text, '''([^'']+)''', 'g') AS m
    ), '{}') AS lexemes`;
  if (!lexemes.length) return [];
  const orQuery = lexemes.map((l) => `'${l.replace(/'/g, "''")}'`).join(" | ");

  const rows = await prisma.$queryRaw<(RetrievedChunk & { rank: number })[]>`
    WITH q AS (SELECT ${orQuery}::tsquery AS query)
    SELECT c.id, d.title AS "documentTitle", d.version AS "documentVersion",
           c.section, c.category, c."pageStart", c."pageEnd", c.text,
           ts_headline('pt_unaccent', c.text, q.query,
             'HighlightAll=true, StartSel=**, StopSel=**') AS highlighted,
           (SELECT count(*) FROM unnest(${lexemes}::text[]) l WHERE c.tsv @@ quote_literal(l)::tsquery)::float
             / ${lexemes.length} AS score,
           ts_rank(c.tsv, q.query, 32) AS rank
    FROM "Chunk" c
    JOIN "Document" d ON d.id = c."documentId", q
    WHERE c.tsv @@ q.query
      AND (${category}::text IS NULL OR c.category = ${category})
    ORDER BY score DESC, rank DESC
    LIMIT ${topK}`;

  return rows
    .map(({ rank: _rank, ...r }) => ({ ...r, score: Number(r.score) }))
    .filter((r) => r.score >= minScore);
}

/** Pesquisa semântica: embedding da pergunta vs. embeddings dos chunks (cosine). Requer AI_ENABLED. */
export async function semanticSearch(query: string, opts: SearchOptions = {}): Promise<RetrievedChunk[]> {
  const topK = opts.topK ?? config.RETRIEVAL_TOP_K;
  const minScore = opts.minScore ?? config.RETRIEVAL_MIN_SCORE;
  const category = opts.category ?? null;
  const [vector] = await embed([query], "query");
  const v = toVectorLiteral(vector);

  const rows = await prisma.$queryRaw<RetrievedChunk[]>`
    SELECT c.id, d.title AS "documentTitle", d.version AS "documentVersion",
           c.section, c.category, c."pageStart", c."pageEnd", c.text,
           1 - (c.embedding <=> ${v}::vector) AS score
    FROM "Chunk" c
    JOIN "Document" d ON d.id = c."documentId"
    WHERE c.embedding IS NOT NULL
      AND (${category}::text IS NULL OR c.category = ${category})
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
