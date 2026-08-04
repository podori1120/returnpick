#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function read(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const route = read("app/api/admin/bootstrap-catalog/manual/route.ts");
const helper = read("lib/manualBootstrapCatalog.ts");
const panel = read("components/AdminBootstrapCatalogPanel.tsx");
const publicDeal = read("lib/publicDeal.ts");

assert.match(route, /requireAdmin\(request\)/, "manual bootstrap route must require the admin session");
assert.match(route, /MANUAL_BOOTSTRAP_MAX_BODY_BYTES/, "manual bootstrap route must cap request bytes");
assert.match(route, /content-length/, "manual bootstrap route must reject oversized declared bodies early");
assert.match(route, /readBoundedBody/, "manual bootstrap route must count streamed request bytes before buffering the payload");
assert.match(route, /manual_identity_confirmed/, "manual bootstrap route must require an explicit identity confirmation");
assert.match(route, /ROW_RECORD_REQUIRED/, "manual bootstrap route must reject malformed rows instead of silently dropping them");
assert.match(route, /createManualBootstrapCatalog/, "manual bootstrap route must use the shared builder");
assert.match(helper, /MANUAL_BOOTSTRAP_MAX_ROWS = 20/, "manual bootstrap input must remain bounded");
assert.match(helper, /isApprovalSampleAffiliateUrl\(affiliateUrl\)/, "approval sample links must be rejected");
assert.match(helper, /isUsableCoupangProductUrl\(coupangUrl\)/, "exact Coupang product URLs must be required");
assert.match(helper, /isUsableManualProductImageUrl\(imageUrl\)/, "manual product image URLs must use an image CDN allowlist");
assert.match(helper, /PRODUCT_IMAGE_INVALID/, "manual product image URLs must reject affiliate or navigation destinations");
assert.match(helper, /PRICE_REQUIRED/, "at least one directly observed product price must be required");
assert.match(helper, /MANUAL_CONFIRMED/, "manual identity confirmation must be persisted");
assert.match(helper, /createManualCatalogReview/, "manual catalog review evidence must be persisted");
assert.match(helper, /stableUuid/, "manual bootstrap IDs must be deterministic");
assert.match(helper, /DUPLICATE_AFFILIATE_LINK/, "the same Partners destination must not be reused for distinct products");
assert.match(helper, /validateManualRowShape/, "manual rows must have a strict scalar schema and explicit length limits");
assert.match(helper, /createBootstrapCatalog\(products, reviewedAt\)/, "manual rows must reuse the existing bootstrap public gate");
assert.match(helper, /부분 카탈로그를 만들지 않았습니다/, "manual catalogs must fail closed instead of silently truncating rows");
assert.match(panel, /MANUAL_FIELD_ORDER/, "admin UI must expose the manual field order");
assert.match(panel, /__field_count/, "admin UI must detect TSV rows with extra or missing columns");
assert.match(panel, /manual_identity_confirmed/, "admin UI must send the explicit identity confirmation");
assert.match(panel, /파트너스 링크가 같은 상품으로 연결/, "admin UI must explain the manual identity check");
assert.match(panel, /Supabase 전 임시 입력/, "admin UI must label the snapshot as temporary");
assert.match(panel, /result\.issues\.map/, "admin UI must render every bounded input issue");
assert.match(panel, /setResult\(null\)/, "admin UI must invalidate stale export results when input changes or a request fails");
assert.match(panel, /setManualIdentityConfirmed\(false\)/, "editing manual rows must clear the identity confirmation");
assert.match(panel, /disabled=\{running \|\| manualRunning\}/, "manual inputs must be locked while either catalog request is running");
assert.match(panel, /response\.ok/, "manual snapshot metadata must depend on the successful response");
assert.match(panel, /manualRequestVersion/, "manual responses must be versioned against stale requests");
assert.match(panel, /async function createCatalog\(\)[\s\S]{0,260}setResult\(null\)/, "automatic generation must clear the previous snapshot before starting");
assert.match(panel, /\/api\/admin\/bootstrap-catalog\/manual/, "admin UI must call the manual bootstrap endpoint");
assert.match(publicDeal, /isFreshManualCatalogReview/, "public visibility must recheck manual review freshness on every read");

console.log("Manual bootstrap catalog static contract passed: bounded authenticated TSV input, strict product/link/image/price gates, manual identity evidence, deterministic IDs, and temporary snapshot disclosure.");
