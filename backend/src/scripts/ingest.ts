/**
 * Uso: npm run ingest -- <ficheiro.pdf> --title "Manual do Técnico" --version 1.0
 */
import { parseArgs } from "node:util";
import { basename } from "node:path";
import { ingestPdf } from "../services/ingest.js";
import { prisma } from "../lib/db.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { title: { type: "string" }, version: { type: "string", default: "1.0" } },
});
const file = positionals[0];
if (!file) {
  console.error('Uso: npm run ingest -- <ficheiro.pdf> --title "Manual" --version 1.0');
  process.exit(1);
}
const title = values.title ?? basename(file, ".pdf");
console.time("ingestão");
const r = await ingestPdf(file, title, values.version!);
console.timeEnd("ingestão");
console.log(`✔ ${title} v${values.version}: ${r.pages} páginas → ${r.chunks} chunks (documento ${r.documentId})`);
await prisma.$disconnect();
