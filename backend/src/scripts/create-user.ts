/**
 * Uso: npm run user:create -- <username> <password> "<Nome>" [--admin] [--section "Rede Luanda"]
 * Com password "-" a palavra-passe é lida da variável de ambiente ARA_PASSWORD
 * (evita problemas com caracteres especiais na linha de comandos do Windows).
 */
import { parseArgs } from "node:util";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { admin: { type: "boolean", default: false }, section: { type: "string" } },
});
const [username, passwordArg, name] = positionals;
const password = passwordArg === "-" ? process.env.ARA_PASSWORD : passwordArg;
if (!username || !password || !name) {
  console.error('Uso: npm run user:create -- <username> <password> "<Nome>" [--admin] [--section "..."]');
  process.exit(1);
}
if (password.length < 8) {
  console.error("A palavra-passe deve ter pelo menos 8 caracteres");
  process.exit(1);
}
const data = {
  name,
  passwordHash: await bcrypt.hash(password, 12),
  role: values.admin ? ("ADMIN" as const) : ("TECNICO" as const),
  section: values.section ?? null,
};
const user = await prisma.user.upsert({
  where: { username: username.toLowerCase() },
  create: { username: username.toLowerCase(), ...data },
  update: data,
});
console.log(`✔ Utilizador ${user.username} (${user.role}) criado/atualizado`);
await prisma.$disconnect();
