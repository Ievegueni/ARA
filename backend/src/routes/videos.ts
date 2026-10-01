import type { FastifyInstance } from "fastify";
import { createWriteStream } from "node:fs";
import { mkdir, open, rename, stat, unlink } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import { config } from "../config.js";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import { prisma } from "../lib/db.js";
import { sendFile } from "../lib/send-file.js";
import { streamUrl, verifyStreamToken } from "../lib/stream-token.js";

const VIDEO_DIR = resolve(config.VIDEO_DIR);

/** Formatos aceites (extensão → tipo). MP4 (H.264) é o que reproduz em todos os navegadores. */
const FORMATS: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

const fields = z.object({
  title: z.string({ error: "Título obrigatório" }).trim().min(2, "Título obrigatório").max(200),
  description: z.string().trim().max(2000).optional().transform((v) => v || null),
  durationSec: z.coerce.number().int().min(0).max(24 * 3600).optional(),
});

const patchBody = z.object({
  title: z.string({ error: "Título obrigatório" }).trim().min(2, "Título obrigatório").max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

/** Confirma pela assinatura do ficheiro que é mesmo um vídeo MP4/MOV ("ftyp") ou WebM (EBML). */
async function looksLikeVideo(path: string): Promise<boolean> {
  const fh = await open(path, "r");
  try {
    const buf = Buffer.alloc(12);
    await fh.read(buf, 0, 12, 0);
    return buf.subarray(4, 8).toString("latin1") === "ftyp" || buf.readUInt32BE(0) === 0x1a45dfa3;
  } finally {
    await fh.close();
  }
}

const select = { id: true, title: true, description: true, fileName: true, mimeType: true, size: true, durationSec: true, createdAt: true } as const;
type Row = { id: string; size: bigint } & Record<string, unknown>;
const toJson = <T extends Row>(v: T) => ({ ...v, size: Number(v.size), streamUrl: streamUrl(v.id) });

export async function videoRoutes(app: FastifyInstance) {
  await mkdir(VIDEO_DIR, { recursive: true });

  app.get("/api/videos", { preHandler: requireAuth }, async () => {
    const videos = await prisma.video.findMany({ orderBy: { createdAt: "desc" }, select });
    return { videos: videos.map(toJson) };
  });

  app.get<{ Params: { id: string } }>("/api/videos/:id", { preHandler: requireAuth }, async (req, reply) => {
    const video = await prisma.video.findUnique({ where: { id: req.params.id }, select });
    if (!video) return reply.code(404).send({ error: "Vídeo não encontrado" });
    return { video: toJson(video) };
  });

  /** Upload de um vídeo. Os campos (title, description, durationSec) têm de vir antes do ficheiro no formulário. */
  app.post("/api/videos", { preHandler: requireAdmin }, async (req, reply) => {
    const file = await req.file({ limits: { fileSize: config.MAX_VIDEO_MB * 1024 * 1024, files: 1 } });
    if (!file) return reply.code(400).send({ error: "Ficheiro em falta" });

    const ext = extname(file.filename).toLowerCase();
    const mimeType = FORMATS[ext];
    const raw = Object.fromEntries(
      Object.entries(file.fields).map(([k, v]) => [k, v && "value" in v ? (v as { value: unknown }).value : undefined]),
    );
    const parsed = fields.safeParse(raw);
    if (!mimeType || !parsed.success) {
      file.file.resume(); // descarta o resto do upload
      return reply.code(400).send({
        error: !mimeType ? "Formato não suportado. Use MP4 (recomendado), WebM ou MOV." : parsed.error!.issues[0].message,
      });
    }

    const storedName = `${randomUUID()}${ext}`;
    const finalPath = join(VIDEO_DIR, storedName);
    const tmpPath = `${finalPath}.part`;
    try {
      await pipeline(file.file, createWriteStream(tmpPath));
      if (file.file.truncated) {
        await unlink(tmpPath).catch(() => {});
        return reply.code(413).send({ error: `O vídeo excede ${config.MAX_VIDEO_MB} MB` });
      }
      if (!(await looksLikeVideo(tmpPath))) {
        await unlink(tmpPath).catch(() => {});
        return reply.code(400).send({ error: "O ficheiro não é um vídeo válido" });
      }
      await rename(tmpPath, finalPath);
    } catch (err) {
      await unlink(tmpPath).catch(() => {});
      req.log.error(err, "falha ao guardar vídeo");
      return reply.code(500).send({ error: "Não foi possível guardar o vídeo" });
    }

    const { size } = await stat(finalPath);
    const video = await prisma.video.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        durationSec: parsed.data.durationSec ?? null,
        fileName: file.filename,
        storedName,
        mimeType,
        size: BigInt(size),
      },
      select,
    });
    return reply.code(201).send({ video: toJson(video) });
  });

  app.patch<{ Params: { id: string } }>("/api/videos/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0].message });
    const exists = await prisma.video.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!exists) return reply.code(404).send({ error: "Vídeo não encontrado" });
    const data = { ...body.data, description: body.data.description === "" ? null : body.data.description };
    const video = await prisma.video.update({ where: { id: req.params.id }, data, select });
    return { video: toJson(video) };
  });

  app.delete<{ Params: { id: string } }>("/api/videos/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const video = await prisma.video.findUnique({ where: { id: req.params.id }, select: { storedName: true } });
    if (!video) return reply.code(404).send({ error: "Vídeo não encontrado" });
    await prisma.video.delete({ where: { id: req.params.id } });
    await unlink(join(VIDEO_DIR, video.storedName)).catch(() => {});
    return { ok: true };
  });

  /**
   * Reprodução com suporte a Range (avançar/recuar). Autenticação por token assinado
   * no URL (?t=), porque o elemento <video> não envia o cabeçalho Authorization.
   */
  app.get<{ Params: { id: string }; Querystring: { t?: string } }>(
    "/api/videos/:id/stream",
    { config: { rateLimit: false } },
    async (req, reply) => {
      if (!verifyStreamToken("video", req.params.id, req.query.t)) return reply.code(403).send({ error: "Ligação expirada ou inválida" });
      const video = await prisma.video.findUnique({ where: { id: req.params.id }, select: { storedName: true, mimeType: true } });
      if (!video) return reply.code(404).send({ error: "Vídeo não encontrado" });

      return sendFile(req, reply, join(VIDEO_DIR, video.storedName), video.mimeType, "Ficheiro do vídeo em falta no servidor");
    },
  );
}
