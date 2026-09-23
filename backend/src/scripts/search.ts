/** Teste manual da pesquisa. Uso: npm run search -- "pergunta" [topK] */
import { search } from "../services/retrieval.js";
import { prisma } from "../lib/db.js";

const [q, k] = process.argv.slice(2);
if (!q) {
  console.error('Uso: npm run search -- "pergunta" [topK]');
  process.exit(1);
}
const results = await search(q, { topK: Number(k ?? 5), minScore: 0 });
if (!results.length) console.log("Sem resultados.");
for (const [i, r] of results.entries()) {
  console.log(`\n#${i + 1}  score=${r.score.toFixed(2)}  [${r.section}, p. ${r.pageStart}${r.pageEnd !== r.pageStart ? `-${r.pageEnd}` : ""}]`);
  const t = (r.highlighted ?? r.text).replace(/\n+/g, " ");
  console.log(t.slice(0, 220) + (t.length > 220 ? "…" : ""));
}
await prisma.$disconnect();
