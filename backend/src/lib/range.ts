/**
 * Interpreta o cabeçalho HTTP Range ("bytes=0-1023", "bytes=500-", "bytes=-500")
 * para servir vídeo por partes (necessário para avançar/recuar no leitor).
 * Devolve undefined sem cabeçalho e null se o intervalo for inválido (→ 416).
 */
export function parseRange(header: string | undefined, size: number): { start: number; end: number } | null | undefined {
  if (!header) return undefined;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "") || size === 0) return null;
  let start: number;
  let end: number;
  if (m[1] === "") {
    // Sufixo: últimos N bytes
    const n = Number(m[2]);
    if (n === 0) return null;
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return null;
  return { start, end };
}
