#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const dataStore = readFileSync(path.join(process.cwd(), "lib", "dataStore.ts"), "utf8");
const seed = readFileSync(path.join(process.cwd(), "sql", "seed.sql"), "utf8");

const defaults = [...dataStore.matchAll(/\{ keyword: "([^"]+)", category: "([^"]+)"/g)].map((match) => ({
  keyword: match[1],
  category: match[2]
}));

assert.ok(defaults.length >= 55, `expected at least 55 default sourcing keywords, found ${defaults.length}`);
assert.deepEqual(
  new Set(defaults.map((item) => item.category)),
  new Set(["laptop", "monitor", "robot_vacuum", "cordless_vacuum", "air_purifier", "dehumidifier"]),
  "default keywords cover every supported category"
);
assert.match(dataStore, /const existingKeys = new Set\(/, "existing keywords are indexed before default backfill");
assert.match(dataStore, /const missingDefaults = DEFAULT_SOURCING_KEYWORDS\.filter\(/, "only missing defaults are backfilled");
assert.match(dataStore, /upsert\(missingDefaults\.map\(/, "Supabase receives only additive missing defaults");
assert.match(dataStore, /const created = missingDefaults\.map\(/, "memory fallback receives only additive missing defaults");

for (const item of defaults) {
  assert.match(seed, new RegExp(`\\('(?:${item.keyword.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")})', '${item.category}'`), `SQL seed includes ${item.keyword}/${item.category}`);
}

console.log(`Sourcing keyword coverage check passed: ${defaults.length} defaults cover all six categories and existing stores are backfilled additively.`);
