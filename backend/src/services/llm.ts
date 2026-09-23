import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import type { RetrievedChunk } from "./retrieval.js";

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

export const NO_CONTEXT_ANSWER =
  "Não sei. Não encontrei no manual do técnico informação suficiente para responder a esta pergunta. " +
  "Reformule a pergunta com mais detalhe (equipamento, alarme, sintoma) ou escale para o suporte de nível 2.";

export const SYSTEM_PROMPT = `És o Assistente de Avarias da Unitel, que apoia técnicos de manutenção de rede no diagnóstico e resolução de avarias.

Regras obrigatórias:
1. Responde APENAS com base nos excertos do manual do técnico fornecidos em <manual>. Não uses conhecimento externo, mesmo que pareça correto.
2. Se os excertos não contiverem informação suficiente para responder com segurança, responde que não sabes e indica que informação falta. Nunca inventes procedimentos, valores, comandos ou referências de equipamento — um procedimento errado pode causar danos na rede ou riscos de segurança.
3. Cita sempre a origem de cada informação no formato [Secção X, p. Y] usando a secção e página indicadas no excerto.
4. Responde em português (de Angola/Portugal), de forma direta e prática para um técnico no terreno.
5. Quando houver um procedimento, apresenta-o em passos numerados, pela ordem do manual. Coloca cada aviso de segurança numa linha própria iniciada por "> " (citação Markdown).
6. Se a pergunta for ambígua, indica as possibilidades presentes no manual e pede o detalhe que falta.`;

export type ChatTurn = { role: "user" | "assistant"; content: string };

function formatContext(chunks: RetrievedChunk[]): string {
  const docs = chunks
    .map((c, i) => {
      const pages = c.pageStart === c.pageEnd ? `${c.pageStart}` : `${c.pageStart}-${c.pageEnd}`;
      return `<excerto id="${i + 1}" documento="${c.documentTitle} v${c.documentVersion}" secção="${c.section}" página="${pages}">\n${c.text}\n</excerto>`;
    })
    .join("\n\n");
  return `<manual>\n${docs}\n</manual>`;
}

/**
 * Gera a resposta em streaming. `onText` recebe cada fragmento de texto.
 * O contexto do manual vai na última mensagem do utilizador; o histórico
 * anterior é enviado apenas como texto para dar continuidade à conversa.
 */
export async function answer(
  question: string,
  chunks: RetrievedChunk[],
  history: ChatTurn[],
  onText: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  if (!config.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não definida");

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-8).map((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: `${formatContext(chunks)}\n\n<pergunta>\n${question}\n</pergunta>` },
  ];

  const stream = client.messages.stream(
    {
      model: config.CLAUDE_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages,
    },
    { signal },
  );
  stream.on("text", onText);
  const final = await stream.finalMessage();

  if (final.stop_reason === "refusal") {
    const msg = "\n\nNão foi possível gerar resposta para esta pergunta.";
    onText(msg);
    return msg.trim();
  }
  return final.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
