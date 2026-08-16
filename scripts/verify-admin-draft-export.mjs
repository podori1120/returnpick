import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const route = read("app/api/admin/products/draft-export/route.ts");
const packageJson = JSON.parse(read("package.json"));

assert.equal(
  packageJson.scripts["admin-draft-export:check"],
  "node scripts/verify-admin-draft-export.mjs",
  "package.json must expose the deterministic admin draft-export check"
);

for (const signal of [
  "export async function GET(request: Request)",
  "requireAdmin(request)",
  "requirePersistentStorage()",
  "listProducts()",
  "is_published !== true",
  "sourcing_status !== \"published\"",
  "isUsableAffiliateUrl(product.affiliate_url)",
  "isUsableCoupangProductUrl(product.coupang_url)",
  "getAffiliateIdentityReadiness(product).ready",
  "Boolean(product.public_note?.trim())",
  "const DEFAULT_LIMIT = 20",
  "const MAX_LIMIT = 40",
  "format === \"markdown\"",
  "generated_at: generatedAt",
  "format,",
  "counts:",
  "items",
  "review_status",
  "review_blockers",
  "affiliate_disclosure",
  "product_url",
  "affiliate_url",
  "item.new_price = product.new_price",
  "Cache-Control\": \"no-store\"",
  "Content-Disposition"
]) {
  assert.match(route, new RegExp(signal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `route must retain ${signal}`);
}

for (const forbidden of [
  "fetch(",
  "updateProduct",
  "insertSourcedProduct",
  "createTelegramLog",
  "sendTelegram",
  "source_url",
  "raw_json",
  "Blogger",
  "Telegram"
]) {
  assert.equal(route.includes(forbidden), false, `draft export must not use ${forbidden}`);
}

assert.match(route, /if \(!format\) return privateJson\([\s\S]*?400\)/);
assert.match(route, /if \(limit === null\) return privateJson\([\s\S]*?400\)/);
assert.match(route, /Content-Disposition[\s\S]*?returnpick-review-drafts\.md/);
assert.match(route, /review_status: REVIEW_STATUS/);
assert.match(route, /REQUIRED_REVIEW_CONFIRMATIONS/);
assert.match(route, /반품 가격/);
assert.match(route, /반품 등급/);
assert.match(route, /재고/);
assert.match(route, /최종 구매 조건/);
assert.match(route, /제휴 관계/);

assert.equal(route.includes("is_published: true"), false, "draft export must not make products public");
assert.equal(route.includes('sourcing_status: "published"'), false, "draft export must not set published status");

console.log("Admin draft-export checks passed: admin gate, persistent-storage gate, strict bounded inputs, identity-ready unpublished projection, review warnings, sanitized output, no-store headers, and no outbound/write path.");
