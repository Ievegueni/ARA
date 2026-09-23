import { test } from "node:test";
import assert from "node:assert/strict";
import { excerptForDisplay, formatExcerpt, stripTitle } from "./format.js";

test("formatExcerpt passa passos em linha a lista", () => {
  assert.equal(formatExcerpt("Procedimento: 1) Bloquear o setor. 2) Medir o VSWR."), "Procedimento:\n1) Bloquear o setor.\n2) Medir o VSWR.");
  assert.equal(formatExcerpt("• Nota"), "- Nota");
  assert.equal(formatExcerpt("ver tabela (2) abaixo"), "ver tabela (2) abaixo");
});

test("stripTitle remove o título mesmo com destaques", () => {
  assert.equal(stripTitle("2.1 Alarme VSWR", "2.1 **Alarme** VSWR\n\nCorpo"), "Corpo");
  assert.equal(stripTitle("2.1 Alarme VSWR", "Outro texto"), "Outro texto");
});

test("excerptForDisplay usa o texto destacado quando existe", () => {
  assert.equal(excerptForDisplay({ section: "S", text: "S\n\na b", highlighted: "S\n\n**a** b" }), "**a** b");
});
