import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = fs.readFileSync(path.join(process.cwd(), "lib", "affiliateIdentity.ts"), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const loadedModule = { exports: {} };
new Function("exports", "module", "require", output)(loadedModule.exports, loadedModule, require);

const {
  assessAffiliateIdentity,
  createManualAffiliateIdentityConfirmation,
  extractCoupangProductId,
  getAffiliateIdentityReadiness,
  getExpectedCoupangProductIdentity,
  mergeAffiliateIdentityRecord
} = loadedModule.exports;

const product = {
  affiliate_url: "https://link.coupang.com/a/AbCd123",
  coupang_url: "https://www.coupang.com/vp/products/123456?itemId=1",
  source_url: null,
  raw_json: {}
};

assert.equal(extractCoupangProductId(product.coupang_url), "123456");
assert.equal(extractCoupangProductId("https://example.com/vp/products/123456"), null);
assert.deepEqual(getExpectedCoupangProductIdentity(product), { productId: "123456", source: "coupang_url" });

const match = assessAffiliateIdentity({ product, affiliateUrl: product.affiliate_url, resolvedProductId: "123456", resolutionCode: "RESOLVED_PRODUCT" });
assert.equal(match.status, "MATCH");
assert.equal(getAffiliateIdentityReadiness({ ...product, raw_json: mergeAffiliateIdentityRecord(product, match) }).ready, true);

const accessLimitedMatch = assessAffiliateIdentity({
  product,
  affiliateUrl: product.affiliate_url,
  resolvedProductId: "123456",
  resolutionCode: "RESOLVED_PRODUCT_ACCESS_LIMITED"
});
assert.equal(accessLimitedMatch.status, "MATCH");

const mismatch = assessAffiliateIdentity({ product, affiliateUrl: product.affiliate_url, resolvedProductId: "999999", resolutionCode: "RESOLVED_PRODUCT" });
const mismatchProduct = { ...product, raw_json: mergeAffiliateIdentityRecord(product, mismatch) };
assert.equal(mismatch.status, "MISMATCH");
assert.equal(getAffiliateIdentityReadiness(mismatchProduct).blocker, "파트너스 링크 상품번호 불일치");
assert.equal(createManualAffiliateIdentityConfirmation(mismatchProduct, product.affiliate_url), null);

const unresolved = assessAffiliateIdentity({ product, affiliateUrl: product.affiliate_url, resolutionCode: "SHORT_LINK_ACCESS_LIMITED" });
const unresolvedProduct = { ...product, raw_json: mergeAffiliateIdentityRecord(product, unresolved) };
assert.equal(unresolved.status, "UNRESOLVED");
assert.equal(getAffiliateIdentityReadiness(unresolvedProduct).blocker, "파트너스 링크 수동 확인 필요");
const manual = createManualAffiliateIdentityConfirmation(unresolvedProduct, product.affiliate_url, "2026-07-31T13:00:00.000Z");
assert.equal(manual?.status, "MANUAL_CONFIRMED");
assert.equal(getAffiliateIdentityReadiness({ ...product, raw_json: mergeAffiliateIdentityRecord(product, manual) }).ready, true);

const noExpected = assessAffiliateIdentity({
  product: { ...product, coupang_url: null },
  affiliateUrl: product.affiliate_url,
  resolvedProductId: "123456",
  resolutionCode: "RESOLVED_PRODUCT"
});
assert.equal(noExpected.status, "EXPECTED_ID_UNAVAILABLE");

assert.equal(getAffiliateIdentityReadiness({ ...product, affiliate_url: "https://link.coupang.com/a/Changed1", raw_json: mergeAffiliateIdentityRecord(product, match) }).ready, false);

const changedProductUrl = {
  ...product,
  coupang_url: "https://www.coupang.com/vp/products/999999?itemId=1",
  raw_json: mergeAffiliateIdentityRecord(product, match)
};
assert.equal(getAffiliateIdentityReadiness(changedProductUrl).ready, false);
assert.equal(getAffiliateIdentityReadiness(changedProductUrl).blocker, "파트너스 링크 상품번호 확인이 오래됐습니다");

console.log("Affiliate identity checks passed: match, mismatch, access-limited resolution, manual confirmation, missing expected ID, and URL-change invalidation.");
