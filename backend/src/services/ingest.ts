import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { prisma, toVectorLiteral } from "../lib/db.js";
import { chunkPages, type PageText } from "./chunker.js";
import { config } from "../config.js";
import { embed } from "./embeddings.js";

interface TextItem {
  str: string;
  transform: number[];
  hasEOL?: boolean;
}

/** Extrai o texto de cada página do PDF (preserva quebras de linha e parágrafos). */
export async function extractPdfPages(buffer: Buffer): Promise<PageText[]> {
  let doc;
  try {
    doc = await getDocument({ data: new Uint8Array(buffer), verbosity: 0, isEvalSupported: false }).promise;
  } catch (err) {
    const msg = (err as Error).name === "PasswordException" ? "o PDF está protegido por palavra-passe" : "ficheiro danificado ou inválido";
    throw new Error(`Não foi possível abrir o PDF: ${msg}`);
  }
  const pages: PageText[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let lastY: number | undefined;
      let text = "";
      for (const item of content.items as TextItem[]) {
        if (!("str" in item)) continue;
        const y = item.transform[5];
        if (lastY !== undefined && Math.abs(y - lastY) > 1) {
          // Salto vertical grande = novo parágrafo
          text += Math.abs(y - lastY) > 18 ? "\n\n" : "\n";
        }
        text += item.str;
        lastY = y;
      }
      pages.push({ page: n, text });
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return pages;
}

export interface IngestResult {
  documentId: string;
  pages: number;
  chunks: number;
}

export type IngestStage = "extracting" | "chunking" | "embedding" | "saving";
export type IngestProgress = (stage: IngestStage, done?: number, total?: number) => void;

/** Ingestão a partir de um ficheiro no disco (CLI). */
export async function ingestPdf(filePath: string, title: string, version: string, onProgress?: IngestProgress) {
  return ingestPdfBuffer(await readFile(filePath), basename(filePath), title, version, onProgress);
}

/** Ingestão completa: PDF → texto → chunks → embeddings → pgvector. Reingerir a mesma versão substitui-a. */
export async function ingestPdfBuffer(
  buffer: Buffer,
  fileName: string,
  title: string,
  version: string,
  onProgress: IngestProgress = () => {},
): Promise<IngestResult> {
  onProgress("extracting");
  const pages = await extractPdfPages(buffer);
  onProgress("chunking");
  const drafts = chunkPages(pages);
  if (!drafts.length) throw new Error("Nenhum texto extraído do PDF (é um PDF digitalizado? precisa de OCR)");

  // Sem IA, a pesquisa usa o índice de texto (coluna gerada pelo Postgres); embeddings só com AI_ENABLED
  let vectors: number[][] | null = null;
  if (config.AI_ENABLED) {
    onProgress("embedding", 0, drafts.length);
    vectors = await embed(drafts.map((d) => d.text), "document", (done, total) => onProgress("embedding", done, total));
  }
  onProgress("saving", 0, drafts.length);

  return prisma.$transaction(
    async (tx) => {
      await tx.document.deleteMany({ where: { title, version } });
      const doc = await tx.document.create({
        data: { title, version, fileName, pages: pages.length },
      });
      for (let i = 0; i < drafts.length; i++) {
        const d = drafts[i];
        const chunk = await tx.chunk.create({
          data: {
            documentId: doc.id,
            ordinal: d.ordinal,
            section: d.section,
            category: d.category,
            pageStart: d.pageStart,
            pageEnd: d.pageEnd,
            text: d.text,
            tokens: d.tokens,
          },
        });
        if (vectors) {
          await tx.$executeRaw`UPDATE "Chunk" SET embedding = ${toVectorLiteral(vectors[i])}::vector WHERE id = ${chunk.id}`;
        }
        if (i % 20 === 19) onProgress("saving", i + 1, drafts.length);
      }
      return { documentId: doc.id, pages: pages.length, chunks: drafts.length };
    },
    { timeout: 5 * 60_000 },
  );
}
