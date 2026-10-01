/**
 * Gera embeddings para os chunks que ainda não os têm (manuais carregados com a IA desligada).
 * O backend já o faz sozinho em segundo plano quando a IA é ligada; este script serve para o
 * fazer manualmente (ex.: depois de adicionar a VOYAGE_API_KEY). Uso: npm run embed:backfill
 */
import { config } from "../config.js";
import { prisma, toVectorLiteral } from "../lib/db.js";
import { embed } from "../services/embeddings.js";

if (!config.VOYAGE_API_KEY) {
  console.error("Defina a VOYAGE_API_KEY no backend/.env antes de gerar embeddings.");
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
