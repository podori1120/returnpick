#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const route = read("app/api/admin/products/[id]/manual-promote/route.ts");
const ui = read("components/AdminAffiliateLinkQueue.tsx");
const packageJson = JSON.parse(read("package.json"));

assert.equal(packageJson.scripts["manual-promotion:check"], "node scripts/verify-manual-promotion.mjs");
for (const signal of [
  "requireAdmin(request)",
  "requirePersistentStorage()",
  "manual_review_confirmed",
  "isManualPromotionSource",
  "isUsableAffiliateUrl",
  "isUsableCoupangProductUrl",
  "isUsableProductImageUrl",
  "getManualPromotionDealPrice",
  "getAffiliateIdentityReadiness",
  "createManualCatalogReview",
  "getCustomerPublishReadiness",
  "updateProductIfUnchanged",
  "source: \"manual_affiliate_link\"",
  "sourcing_status: \"approved\"",
  "is_published: false",
  "is_rejected: false",
  "MANUAL_PROMOTION_PUBLIC_CONFLICT",
  "MANUAL_PROMOTION_STALE_CONFLICT",
  "MANUAL_PROMOTION_PROVENANCE_KEY",
  "isFreshManualCatalogReview"
]) {
  assert.match(route, new RegExp(signal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `route must retain ${signal}`);
}
assert.doesNotMatch(route, /is_published:\s*true/, "manual promotion must never publish");
assert.doesNotMatch(route, /sourcing_status:\s*["']published["']/, "manual promotion must never set published status");
assert.doesNotMatch(route, /createTelegramLog|sendTelegram|fetch\(/, "manual promotion must not send or make external calls");
assert.match(route, /if \(hasManualPromotionPublicMarker\(current\)\)\s*\{[\s\S]*?MANUAL_PROMOTION_PUBLIC_CONFLICT/);
assert.match(route, /const latest = await getProductById\(current\.id\)/);
assert.match(route, /isManualPromotionStateUnchanged\(current, latest\)/);
assert.match(route, /updateProductIfUnchanged\(/);

assert.match(ui, /manual-promote/);
assert.match(ui, /manual_review_confirmed:\s*true/);
assert.match(ui, /isManualPromotionSource\(product\.source\) && getAffiliateIdentityReadiness\(product\)\.ready/);
assert.match(ui, /filter\(\(product\) => !hasPublicProductMarker\(product\)\)/);
assert.match(ui, /if \(hasPublicProductMarker\(product\)\)/);
assert.match(ui, /const latestProduct = products\.find\(\(candidate\) => candidate\.id === product\.id\) \?\? product/);
assert.match(ui, /수동 검수로 전환/);
assert.match(ui, /공개 게시하지 않습니다/);

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadTypeScriptSource(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("exports", "module", "require", output)(loadedModule.exports, loadedModule, require);
  return loadedModule.exports;
}

function loadTypeScriptModule(relativePath) {
  return loadTypeScriptSource(read(relativePath));
}

const publicMarkerGuardSource = route.match(
  /function hasManualPromotionPublicMarker\(product: Pick<SourcedProduct, "is_published" \| "sourcing_status">\) \{[\s\S]*?\n\}/
);
assert.ok(publicMarkerGuardSource, "route must define the public-marker guard");
const { hasManualPromotionPublicMarker } = loadTypeScriptSource(
  `${publicMarkerGuardSource[0]}\nmodule.exports = { hasManualPromotionPublicMarker };`
);

const {
  MANUAL_PROMOTION_PROVENANCE_KEY,
  createManualPromotionRawJson,
  getManualPromotionDealPrice,
  isManualPromotionConfirmation,
  isManualPromotionStateUnchanged,
  isManualPromotionSource
} = loadTypeScriptModule("lib/manualPromotion.ts");
const { createManualCatalogReview, isFreshManualCatalogReview } = loadTypeScriptModule("lib/manualCatalogReview.ts");
const {
  assessAffiliateIdentity,
  getAffiliateIdentityReadiness,
  mergeAffiliateIdentityRecord
} = loadTypeScriptModule("lib/affiliateIdentity.ts");
const { isUsableAffiliateUrl, isUsableCoupangProductUrl } = loadTypeScriptModule("lib/coupangLink.ts");
const { isUsableProductImageUrl } = loadTypeScriptModule("lib/productImageUrl.ts");

const reviewedAt = "2026-08-11T00:00:00.000Z";
const affiliateUrl = "https://link.coupang.com/a/AbCd123";
const coupangUrl = "https://www.coupang.com/vp/products/123456789";
const identityProduct = {
  affiliate_url: affiliateUrl,
  coupang_url: coupangUrl,
  source_url: "https://www.algumon.com/deal/synthetic-1",
  raw_json: {}
};
const identity = assessAffiliateIdentity({
  product: identityProduct,
  affiliateUrl,
  resolvedProductId: "123456789",
  resolutionCode: "SYNTHETIC_MATCH",
  checkedAt: reviewedAt
});
const baseProduct = {
  ...identityProduct,
  id: "11111111-1111-4111-8111-111111111111",
  source: "algumon_discovery",
  source_product_id: "algumon:synthetic-1",
  category: "monitor",
  keyword: "synthetic keyword",
  title: "Synthetic monitor discovery candidate",
  image_url: "https://image10.coupangcdn.com/returnpick-synthetic.jpg",
  source_price: 150000,
  return_price: null,
  new_price: 220000,
  condition_grade: "확인필요",
  stock_count: null,
  raw_json: mergeAffiliateIdentityRecord(identityProduct, identity),
  updated_at: reviewedAt,
  sourcing_status: "needs_review",
  is_published: false,
  is_rejected: false
};

function strictConfirmation(value) {
  return isManualPromotionConfirmation(value);
}

function project(product) {
  if (hasManualPromotionPublicMarker(product)) return { ok: false, reason: "MANUAL_PROMOTION_PUBLIC_CONFLICT" };
  if (!isManualPromotionSource(product.source)) return { ok: false, reason: "SOURCE_NOT_ALLOWED" };
  if (!isUsableAffiliateUrl(product.affiliate_url)) return { ok: false, reason: "AFFILIATE_URL_REQUIRED" };
  if (!isUsableCoupangProductUrl(product.coupang_url)) return { ok: false, reason: "COUPANG_PRODUCT_URL_REQUIRED" };
  if (!isUsableProductImageUrl(product.image_url)) return { ok: false, reason: "PRODUCT_IMAGE_REQUIRED" };
  if (getManualPromotionDealPrice(product) == null) return { ok: false, reason: "POSITIVE_DEAL_PRICE_REQUIRED" };
  if (!getAffiliateIdentityReadiness(product).ready) return { ok: false, reason: "AFFILIATE_IDENTITY_NOT_VERIFIED" };

  const rawJson = createManualCatalogReview(createManualPromotionRawJson(product, reviewedAt), reviewedAt);
  return {
    ok: true,
    product: {
      ...product,
      source: "manual_affiliate_link",
      raw_json: rawJson,
      sourcing_status: "approved",
      is_published: false,
      is_rejected: false
    }
  };
}

assert.equal(strictConfirmation({ manual_review_confirmed: true }), true);
for (const invalid of [
  undefined,
  null,
  [],
  {},
  { manual_review_confirmed: false },
  { manual_review_confirmed: true, extra: "not allowed" }
]) {
  assert.equal(strictConfirmation(invalid), false);
}

assert.equal(hasManualPromotionPublicMarker(baseProduct), false);
for (const concurrentState of [
  { ...baseProduct, is_published: true },
  { ...baseProduct, sourcing_status: "published" }
]) {
  assert.equal(hasManualPromotionPublicMarker(concurrentState), true);
  assert.equal(project(concurrentState).reason, "MANUAL_PROMOTION_PUBLIC_CONFLICT");
}

const expectedWriteState = {
  updated_at: baseProduct.updated_at,
  is_published: baseProduct.is_published,
  sourcing_status: baseProduct.sourcing_status
};
let persistenceCalls = 0;
function simulateConditionalWrite(latest) {
  if (!isManualPromotionStateUnchanged(expectedWriteState, latest)) return null;
  persistenceCalls += 1;
  return latest;
}

for (const mutatedState of [
  { ...baseProduct, updated_at: "2026-08-11T00:00:01.000Z", raw_json: { changed: true } },
  { ...baseProduct, updated_at: "2026-08-11T00:00:02.000Z", source: "manual_admin" },
  { ...baseProduct, updated_at: "2026-08-11T00:00:03.000Z", is_rejected: true },
  { ...baseProduct, updated_at: "2026-08-11T00:00:04.000Z", is_published: true },
  { ...baseProduct, updated_at: "2026-08-11T00:00:05.000Z", sourcing_status: "published" }
]) {
  assert.equal(simulateConditionalWrite(mutatedState), null);
}
assert.equal(persistenceCalls, 0, "stale or public concurrent changes must not call persistence");
assert.equal(simulateConditionalWrite(baseProduct), baseProduct);
assert.equal(persistenceCalls, 1);

assert.equal(project({ ...baseProduct, source: "naver" }).reason, "SOURCE_NOT_ALLOWED");
assert.equal(project({ ...baseProduct, affiliate_url: null }).reason, "AFFILIATE_URL_REQUIRED");
assert.equal(project({ ...baseProduct, coupang_url: null }).reason, "COUPANG_PRODUCT_URL_REQUIRED");
assert.equal(project({ ...baseProduct, image_url: null }).reason, "PRODUCT_IMAGE_REQUIRED");
assert.equal(project({ ...baseProduct, source_price: null, return_price: null, new_price: null }).reason, "POSITIVE_DEAL_PRICE_REQUIRED");

const unresolved = assessAffiliateIdentity({ product: identityProduct, affiliateUrl, resolutionCode: "SYNTHETIC_UNRESOLVED", checkedAt: reviewedAt });
assert.equal(project({ ...baseProduct, raw_json: mergeAffiliateIdentityRecord(identityProduct, unresolved) }).reason, "AFFILIATE_IDENTITY_NOT_VERIFIED");

const promoted = project(baseProduct);
assert.equal(promoted.ok, true);
assert.equal(promoted.product.source, "manual_affiliate_link");
assert.equal(promoted.product.sourcing_status, "approved");
assert.equal(promoted.product.is_published, false);
assert.equal(promoted.product.is_rejected, false);
assert.equal(promoted.product.source_product_id, baseProduct.source_product_id);
assert.equal(promoted.product.source_url, baseProduct.source_url);
assert.equal(promoted.product.title, baseProduct.title);
assert.equal(promoted.product.keyword, baseProduct.keyword);
assert.deepEqual(promoted.product.raw_json[MANUAL_PROMOTION_PROVENANCE_KEY], {
  original_source: "algumon_discovery",
  original_source_product_id: baseProduct.source_product_id,
  original_source_url: baseProduct.source_url,
  original_title: baseProduct.title,
  original_keyword: baseProduct.keyword,
  promoted_at: reviewedAt
});
assert.equal(promoted.product.raw_json.manual_catalog_review.status, "approved");
assert.equal(promoted.product.raw_json.manual_catalog_review.method, "manual");
assert.equal(isFreshManualCatalogReview(promoted.product.raw_json, Date.parse(reviewedAt) + 60_000), true);

console.log("Manual promotion checks passed: strict confirmation, discovery allowlist, required fields, verified identity, bounded provenance, fresh review, approved-unpublished result, and no auto-publish path.");
