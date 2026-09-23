import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

/** Converte um array numérico para o literal aceite pelo pgvector: "[0.1,0.2,...]" */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}
