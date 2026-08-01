#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = fs.readFileSync(path.join(process.cwd(), "lib", "publicWebJsonLd.ts"), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const loadedModule = { exports: {} };
new Function("exports", "module", "require", output)(loadedModule.exports, loadedModule, require);

const { collectJsonLdProducts, readJsonLdOfferPrice, readJsonLdText } = loadedModule.exports;
const payload = {
  "@graph": [
    {
      "@type": "Product",
      name: "로보락 S8 반품-최상 로봇청소기",
      description: "박스 훼손 반품 상품, 상태 최상",
      sku: "S8",
      offers: { price: "599,000" },
      url: "https://allowed.example/products/s8"
    },
    { "@type": "BreadcrumbList", name: "탐색 경로" }
  ]
};

const products = collectJsonLdProducts(payload);
assert.equal(products.length, 1);
assert.equal(readJsonLdText(products[0].name), "로보락 S8 반품-최상 로봇청소기");
assert.equal(readJsonLdOfferPrice(products[0]), 599000);

console.log("Public web JSON-LD checks passed: Product extraction ignores non-products and preserves explicit offer prices.");
