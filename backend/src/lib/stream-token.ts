import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

/**
 * Token curto para abrir um ficheiro protegido (vídeo, PDF do manual) num URL.
 * Os elementos <video> e o leitor de PDF não enviam o cabeçalho Authorization,
 * por isso o URL leva um token assinado (HMAC), válido só para aquele recurso
 * e por tempo limitado — em vez de expor o JWT de sessão no URL.
 */
export type TokenScope = "video" | "document";

const TTL_SECONDS = 6 * 60 * 60;

const sign = (payload: string) => createHmac("sha256", `stream:${config.JWT_SECRET}`).update(payload).digest("base64url");

export function signStreamToken(scope: TokenScope, id: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + TTL_SECONDS;
  return `${exp}.${sign(`${scope}:${id}.${exp}`)}`;
}

export function verifyStreamToken(scope: TokenScope, id: string, token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!Number.isInteger(exp) || !sig || exp * 1000 < now) return false;
  const expected = Buffer.from(sign(`${scope}:${id}.${exp}`));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const streamUrl = (videoId: string) => `/api/videos/${videoId}/stream?t=${signStreamToken("video", videoId)}`;

export const documentFileUrl = (documentId: string) => `/api/documents/${documentId}/file?t=${signStreamToken("document", documentId)}`;
