// Corre todos os testes (*.test.ts) em qualquer sistema operativo.
// O padrão "src/**/*.test.ts" não é expandido pela linha de comandos do Windows.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const find = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? find(join(dir, e.name)) : e.name.endsWith(".test.ts") ? [join(dir, e.name)] : [],
  );

const files = find("src");
const r = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], { stdio: "inherit" });
process.exit(r.status ?? 1);
