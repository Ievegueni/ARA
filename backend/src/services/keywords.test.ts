import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanQuestion } from "./keywords.js";

test("cleanQuestion remove palavras de pergunta e mantém termos técnicos", () => {
  assert.equal(cleanQuestion("O alarme de VSWR está elevado. O que devo verificar?"), "O alarme de VSWR elevado. O que verificar?");
  assert.equal(cleanQuestion("Qual é o procedimento? Como faço?"), "o procedimento?");
  assert.equal(cleanQuestion("O gerador não arrancou"), "O gerador arrancou");
  assert.equal(cleanQuestion("   "), "");
});
