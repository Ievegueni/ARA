import { createHash } from "node:crypto";
import { config, EMBEDDING_DIM } from "../config.js";

export type EmbedInput = "document" | "query";

/**
 * Gera embeddings. Claude não tem endpoint de embeddings; a Anthropic
 * recomenda a Voyage AI. O provider "local" é apenas para desenvolvimento
 * (hashing de n-gramas, sem compreensão semântica real).
 */
export async function embed(
  texts: string[],
  inputType: EmbedInput,
  onProgress?: (done: number, total: number) => void,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (config.EMBEDDINGS_PROVIDER === "voyage") return embedVoyage(texts, inputType, onProgress);
  const out = texts.map(localEmbedding);
  onProgress?.(texts.length, texts.length);
  return out;
}

const VOYAGE_BATCH = 64;

async function embedVoyage(
  texts: string[],
  inputType: EmbedInput,
  onProgress?: (done: number, total: number) => void,
): Promise<number[][]> {
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

/** Embedding determinístico por hashing de palavras e trigramas (só dev). */
export function localEmbedding(text: string): number[] {
  const v = new Array<number>(EMBEDDING_DIM).fill(0);
  const norm = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
  const add = (feat: string, w: number) => {
    const h = createHash("md5").update(feat).digest();
    const idx = h.readUInt32LE(0) % EMBEDDING_DIM;
    v[idx] += h[4] & 1 ? w : -w;
  };
  for (const word of norm.split(/\s+/).filter((w) => w.length > 2)) {
    add(`w:${word}`, 1);
    const p = ` ${word} `;
    for (let i = 0; i < p.length - 2; i++) add(`t:${p.slice(i, i + 3)}`, 0.3);
  }
  const mag = Math.hypot(...v) || 1;
  return v.map((x) => x / mag);
}
