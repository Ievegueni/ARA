import type { RetrievedChunk } from "./retrieval.js";

/** Remove o título da secção que o chunker repete no início do texto. */
export function stripTitle(section: string, text: string): string {
  const plain = text.replace(/\*\*/g, "");
  return plain.startsWith(section) ? text.slice(text.indexOf("\n") + 1).trim() : text;
}

/**
 * Formata o excerto para leitura, sem alterar o conteúdo:
 * passos "1) … 2) …" escritos em linha passam a lista; marcadores "•" passam a "-".
 */
export function formatExcerpt(text: string): string {
  return text.replace(/([.:;])\s+(\d{1,2}\))\s/g, "$1\n$2 ").replace(/^[•●▪]\s/gm, "- ");
}

/** Texto do excerto pronto a mostrar (Markdown, termos da pesquisa a **negrito**). */
export function excerptForDisplay(c: Pick<RetrievedChunk, "section" | "text" | "highlighted">): string {
  return formatExcerpt(stripTitle(c.section, c.highlighted ?? c.text));
}
