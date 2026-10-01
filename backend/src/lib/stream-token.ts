import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

/**
 * Token curto para reproduzir um vídeo. O elemento <video> não envia o cabeçalho
 * Authorization, por isso o URL leva um token assinado (HMAC), válido só para
 * aquele vídeo e por tempo limitado — em vez de expor o JWT de sessão no URL.
 */
const TTL_SECONDS = 6 * 60 * 60;

const sign = (payload: string) => createHmac("sha256", `stream:${config.JWT_SECRET}`).update(payload).digest("base64url");

export function signStreamToken(videoId: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + TTL_SECONDS;
  const payload = `${videoId}.${exp}`;
  return `${exp}.${sign(payload)}`;
}

export function verifyStreamToken(videoId: string, token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!Number.isInteger(exp) || !sig || exp * 1000 < now) return false;
  const expected = Buffer.from(sign(`${videoId}.${exp}`));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const streamUrl = (videoId: string) => `/api/videos/${videoId}/stream?t=${signStreamToken(videoId)}`;
