import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const singleRoute = fs.readFileSync(path.join(process.cwd(), "app", "api", "admin", "products", "route.ts"), "utf8");
const bulkRoute = fs.readFileSync(path.join(process.cwd(), "app", "api", "admin", "products", "import", "route.ts"), "utf8");
const singleUi = fs.readFileSync(path.join(process.cwd(), "components", "AdminManualProductForm.tsx"), "utf8");
const bulkUi = fs.readFileSync(path.join(process.cwd(), "components", "AdminManualProductBulkForm.tsx"), "utf8");
const affiliateIntakeUi = fs.readFileSync(path.join(process.cwd(), "components", "AdminAffiliateLinkIntake.tsx"), "utf8");
const candidateUi = fs.readFileSync(path.join(process.cwd(), "components", "AdminCandidateTable.tsx"), "utf8");
const navigation = fs.readFileSync(path.join(process.cwd(), "lib", "adminNavigation.ts"), "utf8");
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
assert.match(singleRoute, /let scoreError: string \| null = null/, "single intake separates score persistence failures from product persistence");
assert.match(singleRoute, /SOURCING_SCORE_SAVE_FAILED/, "single intake exposes a bounded score retry state");
assert.match(singleRoute, /score_error/, "single intake returns score error state to the admin UI");
assert.match(singleRoute, /후보는 저장됐지만 점수 저장에 실패했습니다/, "single intake gives a truthful retry action");
assert.match(bulkRoute, /let scoreError: string \| null = null/, "bulk intake separates score persistence failures from product persistence");
assert.match(bulkRoute, /scoreErrorCount/, "bulk intake counts score persistence warnings");
assert.match(bulkRoute, /score_error_count/, "bulk intake returns score persistence warnings");
assert.match(bulkRoute, /SOURCING_SCORE_SAVE_FAILED/, "bulk intake exposes a bounded score retry state");
assert.match(singleUi, /operator_next_action/, "single intake renders the next operator action");
assert.match(bulkUi, /SOURCING_SCORE_SAVE_FAILED/, "bulk intake labels score persistence warnings");
assert.match(bulkUi, /openAdminCandidateQueue\("review", recentProductIds\)/, "bulk intake hands imported rows to the focused review queue");
assert.match(bulkUi, /isUsableAffiliateUrl\(value\)/, "bulk intake only offers the link queue for usable Partners URLs");
assert.match(bulkUi, /recentAffiliateLinkCount > 0/, "bulk intake link queue CTA requires a usable affiliate URL row");
assert.match(affiliateIntakeUi, /setRecentProductIds\(data\.product\?\.id \? \[data\.product\.id\] : \[\]\)/, "single affiliate intake keeps the newly inserted product focused");
assert.match(affiliateIntakeUi, /openAdminCandidateQueue\("review", recentProductIds\)/, "affiliate intake hands the new product directly to review");
assert.match(affiliateIntakeUi, /onClick=\{openAdminAffiliateLinkQueue\}/, "affiliate intake provides a destination-verification handoff");
assert.match(affiliateIntakeUi, /new Set\([\s\S]*aggregatedItems[\s\S]*filter\(\(item\) => item\.status === "inserted" && item\.product_id\)/, "affiliate intake deduplicates inserted bulk product IDs for the review handoff");
assert.ok((affiliateIntakeUi.match(/setRecentProductIds\(\[\]\)/g) ?? []).length >= 2, "affiliate intake clears stale handoff IDs before single and bulk submissions");
assert.match(affiliateIntakeUi, /disabled=\{saving \|\| bulkSaving \|\|/, "single affiliate intake is locked while bulk intake is running");
assert.match(affiliateIntakeUi, /interruptedMessage = "네트워크 문제로 다음 묶음 처리를 완료하지 못했습니다\."[\s\S]*finalizeBulkResult\(\)/, "bulk network interruptions preserve partial results and handoff IDs");
assert.match(navigation, /productIds\?: string\[\]/, "admin candidate navigation carries imported product IDs");
assert.match(navigation, /productIds: Array\.from\(new Set\(productIds\.filter\(Boolean\)\)\)/, "admin candidate navigation de-duplicates focused IDs");
assert.match(candidateUi, /focusProductIds/, "candidate table supports a focused imported-candidate view");
assert.match(candidateUi, /방금 일괄 등록한 후보/, "candidate table labels the focused imported-candidate view");

console.log("Manual import safety checks passed: cross-source product IDs, normalized title/category conflicts, distinct categories, and retry-safe score persistence for single and bulk intake.");
