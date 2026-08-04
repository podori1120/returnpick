import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const route = read("app/api/admin/products/link-intake/route.ts");
const ui = read("components/AdminAffiliateLinkIntake.tsx");
const packageJson = read("package.json");

for (const text of [route, ui]) assert.equal(text.includes("redirect: \"follow\""), false, "intake must not add arbitrary redirects");
assert.match(route, /requireAdmin\(request\)/, "admin authentication is required");
assert.match(route, /isUsableAffiliateUrl\(affiliateUrl\)/, "strict Partners URL validation is required");
assert.match(route, /isApprovalSampleAffiliateUrl\(affiliateUrl\)/, "approval sample links are rejected");
assert.match(route, /verifyCoupangAffiliateLinkResolution\(affiliateUrl\)/, "affiliate destination resolver is required");
assert.match(route, /extractCoupangProductId/, "provided product URLs must be parsed for product IDs");
assert.match(route, /AFFILIATE_TARGET_MISMATCH/, "mismatched destination IDs must not save");
assert.match(route, /source_price: null[\s\S]*return_price: null[\s\S]*new_price: null[\s\S]*naver_lowest_price: null/, "prices remain unknown");
assert.match(route, /condition_grade:\s+metadata\?\.condition_grade\s*\?\?\s*"확인필요"/, "condition remains unverified");
assert.match(route, /sourcing_status: "needs_review"[\s\S]*is_published: false/, "new candidates remain unpublished review items");
assert.match(route, /findManualImportConflict/, "duplicate conflicts are checked before insert");
assert.match(route, /calculateDealScore[\s\S]*createDealScore/, "score is saved after insert");
assert.match(route, /let scoreError: string \| null = null/, "score persistence failures are tracked separately from product persistence");
assert.match(route, /SOURCING_SCORE_SAVE_FAILED/, "score persistence failures expose a bounded retry state");
assert.match(route, /후보는 저장됐지만 점수 저장에 실패했습니다/, "operators receive a truthful retry instruction when score save fails");
assert.match(route, /identity_status: identity.status/, "access-limited identity state is retained");
assert.match(ui, /링크로 상품번호 확인 → 검수 대기 후보 저장/, "admin quick-intake action is visible");
assert.match(packageJson, /"affiliate-link-intake:check": "node scripts\/verify-affiliate-link-intake\.mjs"/, "package command is registered");
console.log("Affiliate link intake static contract passed: authenticated strict intake, verified identity, review-only save, duplicate guard, and score persistence.");
