#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = fs.readFileSync(path.join(process.cwd(), "lib", "naverPriceTrust.ts"), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const loadedModule = { exports: {} };
new Function("exports", "module", "require", output)(loadedModule.exports, loadedModule, require);

const {
  getNaverPriceTrust,
  getNaverProductFingerprint,
  mergeManualNaverPriceEvidence,
  withNaverPriceFingerprint
} = loadedModule.exports;

const product = {
  category: "laptop",
  title: "레노버 아이디어패드 5 16GB 512GB",
  brand: "레노버",
  model_name: "IdeaPad 5",
  spec_json: { ram: "16GB", ssd: "512GB" },
  naver_lowest_price: 850000,
  raw_json: {}
};

assert.match(getNaverProductFingerprint(product), /^v1:[0-9a-f]{8}$/);
assert.equal(getNaverPriceTrust(product).status, "unverified");
assert.equal(getNaverPriceTrust(product).trustedPrice, null);

const apiRecord = withNaverPriceFingerprint(
  {
    status: "ok",
    price: 850000,
    updated_at: "2026-07-31T14:00:00.000Z",
    match: {
      sku_confidence: "strong",
      sku_score: 92,
      sku_reason_code: "EXACT_MODEL_CODE"
    }
  },
  product
);
const apiVerified = { ...product, raw_json: { naver_price_lookup: apiRecord } };
assert.equal(getNaverPriceTrust(apiVerified).status, "verified_api");
assert.equal(getNaverPriceTrust(apiVerified).trustedPrice, 850000);

assert.equal(getNaverPriceTrust({ ...apiVerified, naver_lowest_price: 849000 }).status, "unverified");
assert.equal(getNaverPriceTrust({ ...apiVerified, title: `${product.title} RTX 4060` }).status, "unverified");
assert.equal(
  getNaverPriceTrust({
    ...product,
    raw_json: {
      naver_price_lookup: {
        ...apiRecord,
        match: { sku_confidence: "rejected", sku_score: 0, sku_reason_code: "SPEC_CONFLICT" }
      }
    }
  }).status,
  "unverified"
);

const manuallyVerified = {
  ...product,
  raw_json: mergeManualNaverPriceEvidence(product.raw_json, product, 850000, "2026-07-31T15:00:00.000Z", {
    sourceUrl: "https://search.shopping.naver.com/search/all?query=ideapad",
    matchedTitle: "레노버 아이디어패드 5 16GB 512GB"
  })
};
assert.equal(getNaverPriceTrust(manuallyVerified).status, "verified_manual");
assert.equal(getNaverPriceTrust(manuallyVerified).checkedAt, "2026-07-31T15:00:00.000Z");
assert.equal(manuallyVerified.raw_json.naver_price_manual.source_url, "https://search.shopping.naver.com/search/all?query=ideapad");
assert.equal(manuallyVerified.raw_json.naver_price_manual.matched_title, "레노버 아이디어패드 5 16GB 512GB");
assert.equal(getNaverPriceTrust({ ...product, naver_lowest_price: null }).status, "missing");

console.log("Naver price trust checks passed: legacy rejection, API/manual verification, price binding, SKU evidence, and product-fingerprint invalidation.");
