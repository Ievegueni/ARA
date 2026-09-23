import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import pdf from "pdf-parse";
import { prisma, toVectorLiteral } from "../lib/db.js";
import { chunkPages, type PageText } from "./chunker.js";
import { embed } from "./embeddings.js";

/** Extrai o texto de cada página do PDF (preserva quebras de linha). */
export async function extractPdfPages(buffer: Buffer): Promise<PageText[]> {
  const pages: PageText[] = [];
  await pdf(buffer, {
    pagerender: async (pageData: any) => {
      const content = await pageData.getTextContent({ normalizeWhitespace: true });
      let lastY: number | undefined;
      let text = "";
      for (const item of content.items as { str: string; transform: number[] }[]) {
        const y = item.transform[5];
        if (lastY !== undefined && Math.abs(y - lastY) > 1) {
          // Salto vertical grande = novo parágrafo
          text += Math.abs(y - lastY) > 18 ? "\n\n" : "\n";
        }
        text += item.str;
        lastY = y;
      }
      pages.push({ page: pageData.pageIndex + 1, text });
      return text;
    },
  });
  return pages.sort((a, b) => a.page - b.page);
}

export interface IngestResult {
  documentId: string;
  pages: number;
  chunks: number;
}

/** Ingestão completa: PDF → texto → chunks → embeddings → pgvector. Reingerir a mesma versão substitui-a. */
export async function ingestPdf(filePath: string, title: string, version: string): Promise<IngestResult> {
  const pages = await extractPdfPages(await readFile(filePath));
  const drafts = chunkPages(pages);
  if (!drafts.length) throw new Error("Nenhum texto extraído do PDF (é um PDF digitalizado? precisa de OCR)");

  const vectors = await embed(drafts.map((d) => d.text), "document");

  return prisma.$transaction(
    async (tx) => {
      await tx.document.deleteMany({ where: { title, version } });
      const doc = await tx.document.create({
        data: { title, version, fileName: basename(filePath), pages: pages.length },
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
        await tx.$executeRaw`UPDATE "Chunk" SET embedding = ${toVectorLiteral(vectors[i])}::vector WHERE id = ${chunk.id}`;
      }
      return { documentId: doc.id, pages: pages.length, chunks: drafts.length };
    },
    { timeout: 5 * 60_000 },
  );
}
