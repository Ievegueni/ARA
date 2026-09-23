-- Pesquisa por palavras-chave (sem IA): full-text search em português, sem acentos.
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TEXT SEARCH CONFIGURATION pt_unaccent (COPY = portuguese);
ALTER TEXT SEARCH CONFIGURATION pt_unaccent
  ALTER MAPPING FOR hword, hword_part, word WITH unaccent, portuguese_stem;

-- Título da secção pesa mais (A) do que o corpo (B)
ALTER TABLE "Chunk" ADD COLUMN "tsv" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('pt_unaccent'::regconfig, coalesce("section", '')), 'A') ||
  setweight(to_tsvector('pt_unaccent'::regconfig, "text"), 'B')
) STORED;

CREATE INDEX "Chunk_tsv_idx" ON "Chunk" USING gin ("tsv");

-- Modo em que a resposta foi gerada: 'ia' (Claude) ou 'pesquisa' (excertos do manual)
ALTER TABLE "Message" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'ia';
