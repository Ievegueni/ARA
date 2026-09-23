/**
 * Gera embeddings para os chunks que ainda não os têm (manuais carregados com AI_ENABLED=false).
 * Correr uma vez ao ativar a IA: npm run embed:backfill
 */
import { config } from "../config.js";
import { prisma, toVectorLiteral } from "../lib/db.js";
import { embed } from "../services/embeddings.js";

if (!config.AI_ENABLED) {
  console.error("Ative AI_ENABLED=true (com VOYAGE_API_KEY) antes de gerar embeddings.");
  process.exit(1);
}
const chunks = await prisma.$queryRaw<{ id: string; text: string }[]>`
  SELECT id, text FROM "Chunk" WHERE embedding IS NULL ORDER BY "documentId", ordinal`;
console.log(`${chunks.length} excertos sem embedding`);
const vectors = await embed(chunks.map((c) => c.text), "document", (d, t) => process.stdout.write(`\r${d}/${t}`));
for (let i = 0; i < chunks.length; i++) {
  await prisma.$executeRaw`UPDATE "Chunk" SET embedding = ${toVectorLiteral(vectors[i])}::vector WHERE id = ${chunks[i].id}`;
}
console.log("\n✔ concluído");
await prisma.$disconnect();
