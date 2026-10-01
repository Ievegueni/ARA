import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { prisma, toVectorLiteral } from "../lib/db.js";
import { embed } from "./embeddings.js";

/**
 * Interruptor da IA em tempo real (administrador), guardado na tabela Setting.
 * As chaves API ficam só no .env do servidor — nunca na base de dados nem no navegador.
 *
 * - IA ativa = interruptor ligado + ANTHROPIC_API_KEY. O Claude escreve a resposta.
 * - Pesquisa semântica = IA ativa + VOYAGE_API_KEY + todos os excertos com embedding.
 *   Sem Voyage (ou enquanto os embeddings são gerados) usa a pesquisa por palavras-chave,
 *   por isso basta a chave do Claude para testar a IA.
 */
const SETTING_KEY = "ai_enabled";

let enabled = config.AI_ENABLED; // valor do .env até ser lido o da base de dados
let backfill = { running: false, done: 0, total: 0, error: null as string | null };

export const hasClaudeKey = () => Boolean(config.ANTHROPIC_API_KEY);
export const hasVoyageKey = () => Boolean(config.VOYAGE_API_KEY);
export const isAiActive = () => enabled && hasClaudeKey();
/** Gerar embeddings na ingestão só com a IA ativa: com a IA desligada nada sai do servidor. */
export const shouldEmbed = () => isAiActive() && hasVoyageKey();

export class AiUnavailableError extends Error {}

/** Lê a definição guardada; chamar no arranque do servidor. */
export async function loadAiSetting() {
  const s = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  if (s) enabled = s.value === true;
  if (shouldEmbed()) startBackfill();
}

export async function setAiEnabled(on: boolean) {
  if (on && !hasClaudeKey()) {
    throw new AiUnavailableError("Falta a ANTHROPIC_API_KEY no backend/.env (reinicie o backend depois de a adicionar).");
  }
  await prisma.setting.upsert({ where: { key: SETTING_KEY }, create: { key: SETTING_KEY, value: on }, update: { value: on } });
  enabled = on;
  if (shouldEmbed()) startBackfill();
  return getAiState();
}

async function missingEmbeddings(): Promise<number> {
  const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "Chunk" WHERE embedding IS NULL`;
  return Number(n);
}

/** Pesquisa semântica só quando todos os excertos têm embedding; caso contrário palavras-chave (resultados completos). */
export async function useSemanticSearch(): Promise<boolean> {
  if (!shouldEmbed() || backfill.running) return false;
  return (await missingEmbeddings()) === 0;
}

export async function getAiState() {
  const missing = await missingEmbeddings();
  const semantic = shouldEmbed() && !backfill.running && missing === 0;
  return {
    enabled,
    active: isAiActive(),
    model: config.CLAUDE_MODEL,
    keys: { claude: hasClaudeKey(), voyage: hasVoyageKey() },
    search: semantic ? ("semantica" as const) : ("palavras-chave" as const),
    missingEmbeddings: missing,
    backfill: { ...backfill },
  };
}

/** Gera em segundo plano os embeddings que faltam (manuais carregados com a IA desligada). */
function startBackfill() {
  if (backfill.running || !hasVoyageKey()) return;
  void (async () => {
    try {
      const chunks = await prisma.$queryRaw<{ id: string; text: string }[]>`
        SELECT id, text FROM "Chunk" WHERE embedding IS NULL ORDER BY "documentId", ordinal`;
      if (!chunks.length) return;
      backfill = { running: true, done: 0, total: chunks.length, error: null };
      const vectors = await embed(
        chunks.map((c) => c.text),
        "document",
        (done) => (backfill.done = done),
      );
      for (let i = 0; i < chunks.length; i++) {
        await prisma.$executeRaw`UPDATE "Chunk" SET embedding = ${toVectorLiteral(vectors[i])}::vector WHERE id = ${chunks[i].id}`;
      }
    } catch (err) {
      backfill.error = describeError(err);
    } finally {
      backfill.running = false;
    }
  })();
}

/** Teste de ligação às APIs (botão "Testar ligação"). O Claude é testado sem custo (consulta do modelo). */
export async function testConnections() {
  const result: { claude: { ok: boolean; message: string }; voyage: { ok: boolean; message: string } | null } = {
    claude: { ok: false, message: "Falta a ANTHROPIC_API_KEY no backend/.env" },
    voyage: null,
  };
  if (hasClaudeKey()) {
    try {
      const model = await new Anthropic({ apiKey: config.ANTHROPIC_API_KEY }).models.retrieve(config.CLAUDE_MODEL);
      result.claude = { ok: true, message: `Ligação OK — modelo ${model.display_name ?? model.id}` };
    } catch (err) {
      result.claude = { ok: false, message: describeError(err) };
    }
  }
  if (hasVoyageKey()) {
    try {
      await embed(["teste de ligação"], "query");
      result.voyage = { ok: true, message: `Ligação OK — ${config.VOYAGE_MODEL}` };
    } catch (err) {
      result.voyage = { ok: false, message: describeError(err) };
    }
  }
  return result;
}

/** Mensagem clara (em português) para os erros mais comuns das APIs. */
export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "Chave API do Claude inválida ou revogada";
  if (err instanceof Anthropic.PermissionDeniedError) return "A chave API não tem permissão para este modelo";
  if (err instanceof Anthropic.NotFoundError) return `Modelo "${config.CLAUDE_MODEL}" não encontrado (verifique CLAUDE_MODEL)`;
  if (err instanceof Anthropic.RateLimitError) return "Limite de pedidos ou de crédito atingido na conta Anthropic";
  if (err instanceof Anthropic.APIConnectionError) return "Sem ligação à API do Claude (rede ou firewall do servidor)";
  if (err instanceof Anthropic.APIError) return `Erro da API do Claude (${err.status ?? "?"})`;
  const msg = err instanceof Error ? err.message : String(err);
  if (/^Voyage 401/.test(msg)) return "Chave API da Voyage inválida";
  if (/^Voyage 429/.test(msg)) return "Limite de pedidos atingido na Voyage";
  if (/^Voyage \d+/.test(msg)) return `Erro da API da Voyage (${msg.slice(7, 10)})`;
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(msg)) return "Sem ligação à API (rede ou firewall do servidor)";
  return msg;
}
