import { config, EMBEDDING_DIM } from "../config.js";

export type EmbedInput = "document" | "query";

const VOYAGE_BATCH = 64;

/**
 * Gera embeddings com a Voyage AI (só usado com AI_ENABLED=true).
 * A API do Claude não tem endpoint de embeddings; a Anthropic recomenda a Voyage.
 */
export async function embed(
  texts: string[],
  inputType: EmbedInput,
  onProgress?: (done: number, total: number) => void,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (!config.VOYAGE_API_KEY) throw new Error("VOYAGE_API_KEY não definida");
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += VOYAGE_BATCH) {
    const batch = texts.slice(i, i + VOYAGE_BATCH);
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: config.VOYAGE_MODEL,
        input: batch,
        input_type: inputType,
        output_dimension: EMBEDDING_DIM,
      }),
    });
    if (!res.ok) throw new Error(`Voyage ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
    json.data.sort((a, b) => a.index - b.index).forEach((d) => out.push(d.embedding));
    onProgress?.(out.length, texts.length);
  }
  return out;
}
