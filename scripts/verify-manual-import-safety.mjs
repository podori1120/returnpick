import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = fs.readFileSync(path.join(process.cwd(), "lib", "manualImportIdentity.ts"), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const loadedModule = { exports: {} };
new Function("exports", "module", "require", output)(loadedModule.exports, loadedModule, require);

const { findManualImportConflict, getManualImportTitleKey } = loadedModule.exports;
const existing = [
  { id: "existing-coupang", source_product_id: "100", category: "laptop", title: "LG Gram 16 16GB" },
  { id: "existing-title", source_product_id: "200", category: "monitor", title: "27 QHD Monitor" }
];

assert.deepEqual(
  findManualImportConflict(existing, { sourceProductId: "100", category: "laptop", title: "A different title" }),
  { code: "EXISTING_COUPANG_PRODUCT_ID", product_id: "existing-coupang" }
);
assert.deepEqual(
  findManualImportConflict(existing, { sourceProductId: "999", category: "monitor", title: " 27 qhd monitor " }),
  { code: "EXISTING_TITLE_CATEGORY", product_id: "existing-title" }
);
assert.equal(findManualImportConflict(existing, { sourceProductId: "999", category: "laptop", title: "27 QHD Monitor" }), null);
assert.equal(getManualImportTitleKey("laptop", "  LG GRAM 16  "), "laptop:lg gram 16");

console.log("Manual import safety checks passed: cross-source product IDs, normalized title/category conflicts, and distinct categories.");
