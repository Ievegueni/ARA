import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import { prisma } from "../lib/db.js";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { DOCUMENT_DIR, ingestPdfBuffer } from "../services/ingest.js";
import { documentFileUrl, verifyStreamToken } from "../lib/stream-token.js";
import { sendFile } from "../lib/send-file.js";
import { createJob, getJob, runningJobs } from "../services/jobs.js";

export const MAX_UPLOAD_MB = 100;

const fields = z.object({
  title: z.string({ error: "Título obrigatório" }).trim().min(2, "Título obrigatório").max(150),
  version: z.string({ error: "Versão obrigatória" }).trim().min(1, "Versão obrigatória").max(30),
});

export async function documentRoutes(app: FastifyInstance) {
  app.get("/api/documents", { preHandler: requireAuth }, async () => {
    const documents = await prisma.document.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        version: true,
        fileName: true,
        pages: true,
        createdAt: true,
        storedName: true,
        _count: { select: { chunks: true } },
      },
    });
    // hasFile: false nos manuais carregados antes de se guardar o PDF original (é preciso recarregá-los)
    return { documents: documents.map(({ storedName, ...d }) => ({ ...d, hasFile: storedName !== null })) };
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
    const doc = await prisma.document.findUnique({ where: { id: req.params.id }, select: { storedName: true } });
    const { count } = await prisma.document.deleteMany({ where: { id: req.params.id } });
    if (doc?.storedName) await unlink(join(DOCUMENT_DIR, doc.storedName)).catch(() => {});
    if (!count) return reply.code(404).send({ error: "Manual não encontrado" });
    return { ok: true };
  });

  /** Dados para o leitor "Ver página no manual", a partir de um excerto (chunk) de uma resposta ou pesquisa. */
  app.get<{ Params: { id: string } }>("/api/chunks/:id/page", { preHandler: requireAuth }, async (req, reply) => {
    const chunk = await prisma.chunk.findUnique({
      where: { id: req.params.id },
      select: {
        section: true,
        pageStart: true,
        pageEnd: true,
        document: { select: { id: true, title: true, version: true, pages: true, storedName: true } },
      },
    });
    if (!chunk) return reply.code(404).send({ error: "Esta secção já não existe — o manual foi atualizado ou apagado." });
    const { document: d, ...page } = chunk;
    return {
      ...page,
      document: { id: d.id, title: d.title, version: d.version, pages: d.pages },
      fileUrl: d.storedName ? documentFileUrl(d.id) : null,
    };
  });

  /** PDF original (com Range: o leitor só descarrega as partes de que precisa). Token assinado no URL. */
  app.get<{ Params: { id: string }; Querystring: { t?: string } }>(
    "/api/documents/:id/file",
    { config: { rateLimit: false } },
    async (req, reply) => {
      if (!verifyStreamToken("document", req.params.id, req.query.t)) return reply.code(403).send({ error: "Ligação expirada ou inválida" });
      const doc = await prisma.document.findUnique({ where: { id: req.params.id }, select: { storedName: true, fileName: true } });
      if (!doc?.storedName) return reply.code(404).send({ error: "PDF original não disponível" });
      reply.header("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`);
      return sendFile(req, reply, join(DOCUMENT_DIR, doc.storedName), "application/pdf", "PDF original em falta no servidor");
    },
  );
}
