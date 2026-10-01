-- Vídeos de apoio, pesquisáveis pelo título (peso A) e descrição (peso B)
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "durationSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Video_storedName_key" ON "Video"("storedName");

ALTER TABLE "Video" ADD COLUMN "tsv" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('pt_unaccent'::regconfig, "title"), 'A') ||
  setweight(to_tsvector('pt_unaccent'::regconfig, coalesce("description", '')), 'B')
) STORED;

CREATE INDEX "Video_tsv_idx" ON "Video" USING gin ("tsv");

-- Vídeos sugeridos em cada resposta
ALTER TABLE "Message" ADD COLUMN "videos" JSONB;
