/** Teste manual do retrieval (Sprint 2). Uso: npm run search -- "pergunta" [topK] */
import { search } from "../services/retrieval.js";
import { prisma } from "../lib/db.js";

const [q, k] = process.argv.slice(2);
if (!q) {
  console.error('Uso: npm run search -- "pergunta" [topK]');
  process.exit(1);
}
const results = await search(q, { topK: Number(k ?? 5), minScore: 0 });
for (const [i, r] of results.entries()) {
  console.log(`\n#${i + 1}  score=${r.score.toFixed(3)}  [${r.section}, p. ${r.pageStart}${r.pageEnd !== r.pageStart ? `-${r.pageEnd}` : ""}]`);
  console.log(r.text.slice(0, 300).replace(/\n+/g, " ") + (r.text.length > 300 ? "…" : ""));
}
await prisma.$disconnect();
