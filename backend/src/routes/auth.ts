import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";

const loginBody = z.object({ username: z.string().min(1), password: z.string().min(1) });

export async function authRoutes(app: FastifyInstance) {
  app.post(
    "/api/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const body = loginBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: "Utilizador e palavra-passe obrigatórios" });

      const user = await prisma.user.findUnique({ where: { username: body.data.username.toLowerCase() } });
      if (!user || !(await bcrypt.compare(body.data.password, user.passwordHash))) {
        return reply.code(401).send({ error: "Credenciais inválidas" });
      }
      const token = app.jwt.sign(
        { sub: user.id, username: user.username, name: user.name, role: user.role },
        { expiresIn: "12h" },
      );
      return { token, user: { id: user.id, username: user.username, name: user.name, role: user.role, section: user.section } };
    },
  );

  app.get("/api/auth/me", { preHandler: requireAuth }, async (req) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user.sub },
      select: { id: true, username: true, name: true, role: true, section: true },
    });
    return { user };
  });
}
