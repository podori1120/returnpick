import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = fs.readFileSync(path.join(process.cwd(), "lib", "providerProductMerge.ts"), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const loadedModule = { exports: {} };
new Function("exports", "module", "require", output)(loadedModule.exports, loadedModule, require);

const { mergeProviderProductBatches } = loadedModule.exports;
const base = {
  category: "laptop",
  keyword: "갤럭시북",
  brand: "Samsung",
  model_name: "NT960",
  image_url: "https://example.com/product.jpg",
  coupang_url: "https://www.coupang.com/vp/products/123",
  affiliate_url: null,
  source_price: 1200000,
  return_price: null,
  new_price: 1200000,
  condition_grade: "확인필요",
  stock_count: null,
  raw_json: {}
};

const result = mergeProviderProductBatches([
  {
    provider: "coupang_partners",
    products: [
      { ...base, source: "coupang_partners", source_product_id: "123", title: "갤럭시북4 프로 NT960" },
      { ...base, source: "coupang_partners", source_product_id: "456", title: "갤럭시북4 엣지 NT940" }
    ]
  },
  {
    provider: "public_web",
    products: [
      {
        ...base,
        source: "public_web",
        source_product_id: "https://allowed.example/return/123",
        title: "갤럭시북4 프로 NT960",
        source_url: "https://allowed.example/return/123",
        return_price: 890000,
        condition_grade: "최상",
        stock_count: 1,
        raw_json: { web_return_info: { is_return_candidate: true } }
      },
      { ...base, source: "public_web", source_product_id: "https://allowed.example/return/789", title: "LG 그램 16Z90S" }
    ]
  }
]);

assert.equal(result.fetchedCount, 4);
assert.equal(result.products.length, 3);
assert.equal(result.deduplicatedCount, 1);
assert.deepEqual(result.providers, ["coupang_partners", "public_web"]);

const enriched = result.products.find((product) => product.title === "갤럭시북4 프로 NT960");
assert.equal(enriched?.source, "public_web");
assert.equal(enriched?.return_price, 890000);
assert.equal(enriched?.condition_grade, "최상");
assert.equal(enriched?.image_url, "https://example.com/product.jpg");
assert.equal(enriched?.coupang_url, "https://www.coupang.com/vp/products/123");
assert.equal(enriched?.raw_json?.provider_merge?.matched_by, "exact_normalized_title");

const sourceDuplicate = mergeProviderProductBatches([
  { provider: "coupang_partners", products: [{ ...base, source: "coupang_partners", source_product_id: "same", title: "원본 이름" }] },
  {
    provider: "coupang_partners_refresh",
    products: [
      { ...base, source: "coupang_partners", source_product_id: "same", title: "갱신 이름", return_price: 850000, condition_grade: "상" }
    ]
  }
]);
assert.equal(sourceDuplicate.products.length, 1);
assert.equal(sourceDuplicate.products[0].return_price, 850000);
assert.equal(sourceDuplicate.products[0].raw_json?.provider_merge?.matched_by, "source_product_id");

console.log("Provider product merge checks passed: supplemental retention, exact-title evidence preference, and source-id deduplication.");
