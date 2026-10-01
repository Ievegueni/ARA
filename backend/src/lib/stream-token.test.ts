import { test } from "node:test";
import assert from "node:assert/strict";
import { signStreamToken, verifyStreamToken } from "./stream-token.js";

test("token de reprodução é válido só para o mesmo vídeo e dentro do prazo", () => {
  const now = Date.UTC(2026, 0, 1);
  const t = signStreamToken("vid1", now);
  assert.equal(verifyStreamToken("vid1", t, now + 1000), true);
  assert.equal(verifyStreamToken("vid2", t, now + 1000), false);
  assert.equal(verifyStreamToken("vid1", t, now + 7 * 3600 * 1000), false);
  assert.equal(verifyStreamToken("vid1", t.slice(0, -2) + "xx", now), false);
  assert.equal(verifyStreamToken("vid1", undefined, now), false);
  assert.equal(verifyStreamToken("vid1", "lixo", now), false);
});
