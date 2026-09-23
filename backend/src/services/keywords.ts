/**
 * Palavras típicas de uma pergunta que não ajudam a encontrar a secção do manual
 * (o dicionário de stopwords do Postgres já remove artigos, preposições, etc.).
 */
const QUESTION_FILLERS = new Set(
  [
    "devo", "deve", "devemos", "fazer", "faço", "faz", "qual", "quais", "como", "quando", "onde",
    "porque", "porquê", "tenho", "temos", "tem", "está", "estão", "esta", "preciso", "precisa",
    "ajuda", "ajudar", "pode", "posso", "consigo", "resolver", "seguir", "passos", "dizer", "sei",
    // Stopwords acentuadas: o Postgres retira os acentos antes de as comparar e deixa de as reconhecer
    "não", "já", "até", "também", "só", "você", "vocês", "será", "são", "há", "é", "à", "às", "está",
  ].map((w) => w.normalize("NFD").replace(/[̀-ͯ]/g, "")),
);

/** Remove palavras de pergunta que não descrevem a avaria. */
export function cleanQuestion(q: string): string {
  return q
    .split(/\s+/)
    .filter((w) => {
      const k = w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
      return k && !QUESTION_FILLERS.has(k);
    })
    .join(" ");
}
