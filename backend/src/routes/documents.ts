import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import { prisma } from "../lib/db.js";
import { ingestPdfBuffer } from "../services/ingest.js";
import { createJob, getJob, runningJobs } from "../services/jobs.js";

export const MAX_UPLOAD_MB = 100;

const fields = z.object({
  title: z.string().trim().min(2, "Título obrigatório").max(150),
  version: z.string().trim().min(1, "Versão obrigatória").max(30),
});

export async function documentRoutes(app: FastifyInstance) {
  app.get("/api/documents", { preHandler: requireAuth }, async () => {
    const documents = await prisma.document.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, version: true, fileName: true, pages: true, createdAt: true, _count: { select: { chunks: true } } },
    });
    return { documents };
  });

  /** Upload de um manual (PDF). A ingestão corre em segundo plano; o progresso é consultado em /api/documents/jobs/:id */
  app.post("/api/documents", { preHandler: requireAdmin }, async (req, reply) => {
    const file = await req.file({ limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 } });
    if (!file) return reply.code(400).send({ error: "Ficheiro em falta" });

    const buffer = await file.toBuffer().catch(() => null);
    if (!buffer || file.file.truncated) return reply.code(413).send({ error: `O ficheiro excede ${MAX_UPLOAD_MB} MB` });
    if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") return reply.code(400).send({ error: "O ficheiro não é um PDF válido" });

    const raw = Object.fromEntries(
      Object.entries(file.fields).map(([k, v]) => [k, v && "value" in v ? (v as { value: unknown }).value : undefined]),
    );
    const parsed = fields.safeParse(raw);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const { title, version } = parsed.data;

    if (runningJobs().some((j) => j.title === title && j.version === version)) {
      return reply.code(409).send({ error: "Este manual já está a ser processado" });
    }

    const job = createJob({ title, version, fileName: file.filename });
    ingestPdfBuffer(buffer, file.filename, title, version, (stage, done = 0, total = 0) => {
      Object.assign(job, { stage, done, total });
    })
      .then((result) => Object.assign(job, { status: "done", result }))
      .catch((err: Error) => {
        req.log.error(err, "falha na ingestão");
        Object.assign(job, { status: "error", error: err.message });
      });

    return reply.code(202).send({ job });
  });

  app.get<{ Params: { id: string } }>("/api/documents/jobs/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const job = getJob(req.params.id);
    if (!job) return reply.code(404).send({ error: "Processamento não encontrado" });
    return { job };
  });

  app.delete<{ Params: { id: string } }>("/api/documents/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { count } = await prisma.document.deleteMany({ where: { id: req.params.id } });
    if (!count) return reply.code(404).send({ error: "Manual não encontrado" });
    return { ok: true };
  });
}
