import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRange } from "./range.js";

test("parseRange", () => {
  assert.equal(parseRange(undefined, 100), undefined);
  assert.deepEqual(parseRange("bytes=0-9", 100), { start: 0, end: 9 });
  assert.deepEqual(parseRange("bytes=50-", 100), { start: 50, end: 99 });
  assert.deepEqual(parseRange("bytes=-10", 100), { start: 90, end: 99 });
  assert.deepEqual(parseRange("bytes=90-500", 100), { start: 90, end: 99 });
  assert.equal(parseRange("bytes=100-", 100), null);
  assert.equal(parseRange("bytes=20-10", 100), null);
  assert.equal(parseRange("bytes=-", 100), null);
  assert.equal(parseRange("items=0-1", 100), null);
  assert.equal(parseRange("bytes=0-1,5-6", 100), null);
});
