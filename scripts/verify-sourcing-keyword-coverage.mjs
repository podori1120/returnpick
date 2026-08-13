#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const dataStore = readFileSync(path.join(process.cwd(), "lib", "dataStore.ts"), "utf8");
const seed = readFileSync(path.join(process.cwd(), "sql", "seed.sql"), "utf8");
const requiredAdditiveDefaults = [
  { keyword: "노트북", category: "laptop", min_price: 800000, max_price: 3000000, min_discount_rate: 0.08 },
  { keyword: "게이밍 노트북", category: "laptop", min_price: 900000, max_price: 3000000, min_discount_rate: 0.1 },
  { keyword: "모니터", category: "monitor", min_price: 500000, max_price: 2000000, min_discount_rate: 0.1 },
  { keyword: "로봇청소기", category: "robot_vacuum", min_price: 600000, max_price: 2000000, min_discount_rate: 0.1 },
  { keyword: "무선청소기", category: "cordless_vacuum", min_price: 450000, max_price: 1500000, min_discount_rate: 0.1 },
  { keyword: "공기청정기", category: "air_purifier", min_price: 300000, max_price: 1200000, min_discount_rate: 0.1 },
  { keyword: "제습기", category: "dehumidifier", min_price: 300000, max_price: 1000000, min_discount_rate: 0.1 }
];
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const defaultBlock = dataStore.match(/DEFAULT_SOURCING_KEYWORDS: KeywordInput\[\] = \[([\s\S]*?)\n\];/);
assert.ok(defaultBlock, "code defaults block is present");
const defaults = [...defaultBlock[1].matchAll(/\{ keyword: "([^"]+)", category: "([^"]+)"/g)].map((match) => ({
  keyword: match[1],
  category: match[2]
}));

assert.equal(defaults.some((item) => item.keyword === "LG전자"), false, "code defaults omit generic LG전자");
assert.doesNotMatch(seed, /\('LG전자',\s*'/, "SQL seed omits generic LG전자");
assert.match(
  dataStore,
  /(?:export )?const RETIRED_SOURCING_KEYWORD[^=]*=\s*\{\s*keyword: "LG전자",\s*category: "laptop"\s*\}/,
  "code defines the exact LG전자/laptop retirement descriptor"
);
assert.match(
  dataStore,
  /\.from\("sourcing_keywords"\)\s*\.update\(\{\s*is_active: false,\s*updated_at: now\(\)\s*\}\)[\s\S]*?\.eq\("keyword_key", keywordKey\)[\s\S]*?\.eq\("category", descriptor\.category\)[\s\S]*?\.eq\("is_active", true\)/,
  "Supabase retirement filters the normalized key, category, and active rows"
);
assert.match(
  dataStore,
  /memoryKeywords\.filter\(\s*\(keyword\) =>\s*keyword\.is_active\s*&&\s*keyword\.category === descriptor\.category\s*&&\s*normalizeKeywordKey\(keyword\.keyword\) === keywordKey/,
  "memory retirement filters the normalized key, category, and active rows"
);
assert.match(
  dataStore,
  /const retired_count = await retireSourcingKeyword\(RETIRED_SOURCING_KEYWORD\);[\s\S]*?const existing = await listKeywords\(\);/,
  "retirement runs before default keyword listing and backfill"
);
assert.match(dataStore, /options\?\.activeOnly\) query = query\.eq\("is_active", true\)/, "active Supabase keyword selection excludes retired rows");
assert.match(
  seed,
  /update sourcing_keywords\s+set is_active = false,\s+updated_at = now\(\)\s+where keyword_key = 'lg전자'\s+and category = 'laptop'\s+and is_active = true\s*;/i,
  "SQL seed retires only the exact LG전자/laptop row"
);
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

for (const item of requiredAdditiveDefaults) {
  assert.match(
    dataStore,
    new RegExp(`\\{ keyword: "${escapeRegExp(item.keyword)}", category: "${item.category}", min_price: ${item.min_price}, max_price: ${item.max_price}, min_discount_rate: ${item.min_discount_rate} \\}`),
    `code defaults include ${item.keyword}/${item.category} with exact filters`
  );
  assert.match(
    seed,
    new RegExp(`\\('${escapeRegExp(item.keyword)}', '${item.category}', ${item.min_price}, ${item.max_price}, ${item.min_discount_rate.toFixed(2)}\\)`),
    `SQL seed includes ${item.keyword}/${item.category} with exact filters`
  );
}

for (const item of defaults) {
  assert.match(seed, new RegExp(`\\('(?:${escapeRegExp(item.keyword)})', '${item.category}'`), `SQL seed includes ${item.keyword}/${item.category}`);
}

console.log(`Sourcing keyword coverage check passed: ${defaults.length} defaults cover all six categories, seven additive lanes are verified, and existing stores are backfilled additively.`);
