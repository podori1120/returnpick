import assert from "node:assert/strict";
import { resolveSourcingKeywordLimit } from "../lib/publicWebSourcingLimits.ts";

const cases = [
  ["public caps an oversized request", "public_web_only", 24, 8],
  ["public keeps the documented cap", "public_web_only", 8, 8],
  ["public keeps a smaller request", "public_web_only", 5, 5],
  ["public defaults a missing request", "public_web_only", undefined, 8],
  ["public defaults an invalid request", "public_web_only", 0, 8],
  ["auto mode keeps an oversized request", "auto", 24, 24],
  ["auto mode keeps a missing request nullable", "auto", undefined, null]
];

for (const [name, sourceMode, requested, expected] of cases) {
  assert.equal(resolveSourcingKeywordLimit(sourceMode, requested), expected, name);
}

console.log(`Public-web keyword limit checks passed: ${cases.length} cases.`);
