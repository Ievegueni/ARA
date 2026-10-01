import type { FastifyReply, FastifyRequest } from "fastify";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { parseRange } from "./range.js";

/**
 * Envia um ficheiro do disco com suporte a pedidos parciais (Range):
 * o leitor de vídeo avança/recua e o leitor de PDF lê só as páginas de que precisa.
 */
export async function sendFile(
  req: FastifyRequest,
  reply: FastifyReply,
  path: string,
  contentType: string,
  missingMessage: string,
) {
  const info = await stat(path).catch(() => null);
  if (!info) return reply.code(404).send({ error: missingMessage });

  reply.header("Accept-Ranges", "bytes").header("Content-Type", contentType).header("Cache-Control", "private, max-age=3600");
  const range = parseRange(req.headers.range, info.size);
  if (range === null) return reply.code(416).header("Content-Range", `bytes */${info.size}`).send();
  if (!range) return reply.header("Content-Length", info.size).send(createReadStream(path));

  return reply
    .code(206)
    .header("Content-Range", `bytes ${range.start}-${range.end}/${info.size}`)
    .header("Content-Length", range.end - range.start + 1)
    .send(createReadStream(path, { start: range.start, end: range.end }));
}
