#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadTypeScriptModule(relativePath) {
  const source = read(relativePath);
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("exports", "module", "require", output)(loadedModule.exports, loadedModule, require);
  return loadedModule.exports;
}

function extractFunction(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} must remain defined in lib/dataStore.ts`);
  const openBrace = source.indexOf("{", start);
  assert.notEqual(openBrace, -1, `${functionName} must have a body`);

  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  assert.fail(`${functionName} body is not balanced`);
}

const dataStore = read("lib/dataStore.ts");
assert.match(
  dataStore,
  /isGenericCoupangLandingUrl,\s*isUsableAffiliateUrl,\s*isUsableCoupangProductUrl/,
  "dataStore must use the direct Coupang product URL validator"
);
assert.match(
  dataStore,
  /coupang_url:\s*isUsableCoupangProductUrl\(existing\.coupang_url\)\s*\?\s*existing\.coupang_url\s*:\s*payload\.coupang_url/,
  "preserveExistingReviewFields must preserve an existing valid Coupang product URL"
);

const { isUsableAffiliateUrl, isUsableCoupangProductUrl } = loadTypeScriptModule("lib/coupangLink.ts");
const { isUsableProductImageUrl } = loadTypeScriptModule("lib/productImageUrl.ts");
const helperSource = extractFunction(dataStore, "preserveExistingReviewFields");
const helperOutput = ts.transpileModule(
  `
const weakConditionGrades = new Set(["확인필요", "알수없음"]);
function isWeakConditionGrade(value) {
  return !value || weakConditionGrades.has(value);
}
${helperSource}
module.exports = { preserveExistingReviewFields };
`,
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }
).outputText;
const helperModule = { exports: {} };
new Function(
  "exports",
  "module",
  "require",
  "isUsableProductImageUrl",
  "isUsableAffiliateUrl",
  "isUsableCoupangProductUrl",
  helperOutput
)(helperModule.exports, helperModule, require, isUsableProductImageUrl, isUsableAffiliateUrl, isUsableCoupangProductUrl);

const { preserveExistingReviewFields } = helperModule.exports;
const validExistingUrl = "https://www.coupang.com/vp/products/123456789";
const validPayloadUrl = "https://www.coupang.com/vp/products/987654321";
const validAffiliateUrl = "https://link.coupang.com/a/AbCd123";
const validImageUrl = "https://image10.coupangcdn.com/returnpick-synthetic.jpg";

const existing = {
  coupang_url: validExistingUrl,
  affiliate_url: validAffiliateUrl,
  image_url: validImageUrl,
  return_price: 90000,
  new_price: 120000,
  naver_lowest_price: 85000,
  stock_count: 2,
  source_price: 100000,
  condition_grade: "상",
  admin_memo: "수동 확인 메모",
  public_note: "기존 공개 메모",
  last_observed_at: "2026-08-11T00:00:00.000Z",
  raw_json: { existing_marker: true, nested: { existing: true } }
};
const payload = {
  coupang_url: null,
  affiliate_url: null,
  image_url: null,
  return_price: null,
  new_price: null,
  naver_lowest_price: null,
  stock_count: null,
  source_price: null,
  condition_grade: "확인필요",
  admin_memo: "새 메모는 무시",
  public_note: "새 공개 메모는 무시",
  last_observed_at: null,
  raw_json: { incoming_marker: true, nested: { incoming: true } }
};

for (const invalidIncomingUrl of [null, "https://www.coupang.com/np/search?q=상품", "not-a-url"]) {
  const preserved = preserveExistingReviewFields(existing, { ...payload, coupang_url: invalidIncomingUrl });
  assert.equal(preserved.coupang_url, validExistingUrl, `invalid incoming URL ${String(invalidIncomingUrl)} must not clear the stored product URL`);
}

assert.equal(preserveExistingReviewFields(existing, { ...payload, coupang_url: validPayloadUrl }).coupang_url, validExistingUrl);
for (const invalidExistingUrl of [null, "https://www.coupang.com/np/search?q=상품", "https://www.coupang.com/vp/products/not-a-number"]) {
  const replaced = preserveExistingReviewFields(
    { ...existing, coupang_url: invalidExistingUrl },
    { ...payload, coupang_url: validPayloadUrl }
  );
  assert.equal(replaced.coupang_url, validPayloadUrl, `valid payload URL must replace stored URL ${String(invalidExistingUrl)}`);
}

const preserved = preserveExistingReviewFields(existing, payload);
assert.equal(preserved.affiliate_url, validAffiliateUrl);
assert.equal(preserved.image_url, validImageUrl);
assert.equal(preserved.return_price, existing.return_price);
assert.equal(preserved.new_price, existing.new_price);
assert.equal(preserved.naver_lowest_price, existing.naver_lowest_price);
assert.equal(preserved.stock_count, existing.stock_count);
assert.equal(preserved.source_price, existing.source_price);
assert.equal(preserved.condition_grade, existing.condition_grade);
assert.equal(preserved.admin_memo, existing.admin_memo);
assert.equal(preserved.public_note, existing.public_note);
assert.deepEqual(preserved.raw_json, {
  existing_marker: true,
  nested: { incoming: true },
  incoming_marker: true
});

console.log("Sourcing upsert preservation checks passed: valid direct Coupang URLs survive null/invalid refreshes, valid payload URLs replace missing/invalid stored URLs, and existing review fields remain preserved.");
