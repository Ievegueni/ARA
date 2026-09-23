import type { FastifyReply, FastifyRequest } from "fastify";

export interface JwtUser {
  sub: string;
  username: string;
  name: string;
  role: "TECNICO" | "ADMIN";
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtUser;
    user: JwtUser;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "Sessão inválida ou expirada" });
  }
}
