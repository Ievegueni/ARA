import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkPages, isHeading } from "./chunker.js";

test("isHeading deteta títulos numerados e ignora índice", () => {
  assert.deepEqual(isHeading("3.2 Perda de sinal na fibra"), { number: "3.2", title: "Perda de sinal na fibra" });
  assert.deepEqual(isHeading("CAPÍTULO 4 Rádio"), { number: null, title: "CAPÍTULO 4 Rádio" });
  assert.equal(isHeading("3.2 Perda de sinal ........ 12"), null);
  assert.equal(isHeading("texto normal de parágrafo"), null);
});

test("chunkPages divide por secção e guarda páginas e categoria", () => {
  const pages = [
    { page: 1, text: "1 Fibra Óptica\nIntrodução à fibra com texto suficiente para passar o mínimo de caracteres exigido pelo chunker.\n\n1.1 Perda de sinal\nVerificar o conector. Limpar com álcool isopropílico e medir com OTDR a atenuação do troço." },
    { page: 2, text: "Continuação na página 2 com mais detalhes do procedimento de medição e registo dos valores.\n2 Rádio\nAlarmes de VSWR elevado indicam problema na linha de transmissão ou antena danificada." },
  ];
  const chunks = chunkPages(pages);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[1].section, "1.1 Perda de sinal");
  assert.equal(chunks[1].category, "1 Fibra Óptica");
  assert.equal(chunks[1].pageStart, 1);
  assert.equal(chunks[1].pageEnd, 2);
  assert.equal(chunks[2].category, "2 Rádio");
  assert.ok(chunks[1].text.startsWith("1.1 Perda de sinal"));
});

test("secções longas geram vários chunks", () => {
  const para = "Frase de teste sobre avarias na rede. ".repeat(30);
  const text = `5 Energia\n${para}\n\n${para}\n\n${para}`;
  const chunks = chunkPages([{ page: 1, text }], { maxChars: 1500 });
  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((c) => c.section === "5 Energia"));
});
