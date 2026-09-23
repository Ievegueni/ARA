/**
 * Divide o texto do manual em chunks por secção.
 * - Deteta títulos numerados ("3", "3.2", "3.2.1 Título") ou "CAPÍTULO X".
 * - Cada secção vira um ou mais chunks (secções longas são partidas por
 *   parágrafos, com sobreposição), mantendo o título da secção e as páginas.
 * - A categoria de avaria é o título de nível 1 a que a secção pertence.
 */

export interface PageText {
  page: number; // 1-based
  text: string;
}

export interface ChunkDraft {
  ordinal: number;
  section: string;
  category: string | null;
  pageStart: number;
  pageEnd: number;
  text: string;
  tokens: number;
}

export interface ChunkOptions {
  maxChars?: number;
  overlapChars?: number;
  minChars?: number;
}

const HEADING_RE =
  /^(?:(\d{1,2}(?:\.\d{1,2}){0,3})\.?\s+([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][^\n]{2,90})|(CAP[IÍ]TULO\s+[\dIVXL]+[^\n]{0,90}))$/;

interface Line {
  text: string;
  page: number;
  pageEnd?: number;
}

interface Section {
  number: string | null;
  title: string;
  category: string | null;
  lines: Line[];
}

export function isHeading(line: string): { number: string | null; title: string } | null {
  const l = line.trim();
  if (l.length > 100) return null;
  const m = HEADING_RE.exec(l);
  if (!m) return null;
  if (m[3]) return { number: null, title: m[3].trim() };
  // Evita falsos positivos: frases longas terminadas em ponto ou linhas de índice ("..... 12")
  if (/\.{3,}\s*\d+$/.test(l) || /[.;:]$/.test(m[2])) return null;
  return { number: m[1], title: m[2].trim() };
}

export function splitSections(pages: PageText[]): Section[] {
  const sections: Section[] = [];
  let current: Section = { number: null, title: "Introdução", category: null, lines: [] };
  let category: string | null = null;

  for (const { page, text } of pages) {
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.replace(/\s+/g, " ").trim();
      if (!line) {
        current.lines.push({ text: "", page });
        continue;
      }
      const h = isHeading(line);
      if (h) {
        if (current.lines.some((l) => l.text)) sections.push(current);
        const label = h.number ? `${h.number} ${h.title}` : h.title;
        const isTopLevel = h.number === null || !h.number.includes(".");
        if (isTopLevel) category = label;
        current = { number: h.number, title: label, category, lines: [] };
        continue;
      }
      current.lines.push({ text: line, page });
    }
  }
  if (current.lines.some((l) => l.text)) sections.push(current);
  return sections;
}

const LIST_ITEM_RE = /^(\d{1,2}[.)]|[a-z][.)]|[-–•●▪])\s/;

/** Junta linhas em parágrafos (linha vazia = quebra de parágrafo). */
function paragraphs(lines: Line[]): Line[] {
  const out: Line[] = [];
  let buf: string[] = [];
  let page = lines[0]?.page ?? 1;
  let pageEnd = page;
  const flush = () => {
    if (buf.length) out.push({ text: buf.join(""), page, pageEnd });
    buf = [];
  };
  for (const l of lines) {
    if (!l.text) {
      flush();
      continue;
    }
    if (!buf.length) page = l.page;
    pageEnd = l.page;
    // Itens de lista (passos, marcadores) ficam em linha própria; o resto é quebra de linha do PDF
    if (buf.length && LIST_ITEM_RE.test(l.text)) buf.push(`\n${l.text}`);
    else buf.push(buf.length ? ` ${l.text}` : l.text);
  }
  flush();
  return out;
}

export function chunkPages(pages: PageText[], opts: ChunkOptions = {}): ChunkDraft[] {
  const maxChars = opts.maxChars ?? 2000;
  const overlap = opts.overlapChars ?? 250;
  const minChars = opts.minChars ?? 80;
  const chunks: ChunkDraft[] = [];

  for (const s of splitSections(pages)) {
    const paras = paragraphs(s.lines);
    let buf: Line[] = [];
    let size = 0;

    const emit = () => {
      const body = buf.map((p) => p.text).join("\n\n").trim();
      if (body.length < minChars && chunks.length && chunks[chunks.length - 1].section === s.title) {
        // Fragmento muito pequeno: anexa ao chunk anterior da mesma secção
        const prev = chunks[chunks.length - 1];
        prev.text += `\n\n${body}`;
        prev.pageEnd = Math.max(prev.pageEnd, endPage(buf));
        prev.tokens = estimateTokens(prev.text);
        return;
      }
      if (!body) return;
      const text = `${s.title}\n\n${body}`;
      chunks.push({
        ordinal: chunks.length,
        section: s.title,
        category: s.category,
        pageStart: buf[0].page,
        pageEnd: endPage(buf),
        text,
        tokens: estimateTokens(text),
      });
    };

    for (const p of splitLong(paras, maxChars)) {
      if (size + p.text.length > maxChars && buf.length) {
        emit();
        // Sobreposição: mantém o último parágrafo se for curto o suficiente
        const last = buf[buf.length - 1];
        buf = last.text.length <= overlap ? [last] : [];
        size = buf.reduce((n, x) => n + x.text.length, 0);
      }
      buf.push(p);
      size += p.text.length;
    }
    if (buf.length) emit();
  }
  return chunks;
}

/** Parte parágrafos maiores que maxChars por frases. */
function splitLong(paras: Line[], maxChars: number): Line[] {
  const out: Line[] = [];
  for (const p of paras) {
    if (p.text.length <= maxChars) {
      out.push(p);
      continue;
    }
    let cur = "";
    for (const sentence of p.text.split(/(?<=[.!?])\s+/)) {
      if (cur && cur.length + sentence.length > maxChars) {
        out.push({ text: cur, page: p.page, pageEnd: p.pageEnd });
        cur = "";
      }
      cur = cur ? `${cur} ${sentence}` : sentence;
    }
    if (cur) out.push({ text: cur, page: p.page, pageEnd: p.pageEnd });
  }
  return out;
}

const endPage = (buf: Line[]) => Math.max(...buf.map((l) => l.pageEnd ?? l.page));

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
