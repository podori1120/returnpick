import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function read(file) {
  const fullPath = resolve(root, file);
  if (!existsSync(fullPath)) throw new Error(`missing Blogger distribution file: ${file}`);
  return readFileSync(fullPath, "utf8");
}

function requireSignals(label, text, signals) {
  for (const signal of signals) {
    if (!text.includes(signal)) throw new Error(`${label} is missing: ${signal}`);
  }
}

const kit = read("lib/productDistributionKit.ts");
const blogger = read("lib/blogger.ts");
const adminRoute = read("app/api/admin/blogger/route.ts");
const cronRoute = read("app/api/cron/blogger-digest/route.ts");
const scheduler = read("lib/scheduler.ts");
const dataStore = read("lib/dataStore.ts");
const deliveryState = read("lib/distributionDeliveryState.ts");
const distributionQueue = read("lib/distributionQueue.ts");
const schema = read("sql/schema.sql");
const component = read("components/AdminProductDistributionKit.tsx");
const vercel = read("vercel.json");
const envExample = read(".env.example");
const layout = read("app/layout.tsx");
const packageJson = read("package.json");
const readiness = read("scripts/check-readiness.mjs");
const quality = read("lib/quality.ts");
const publicDeal = read("lib/publicDeal.ts");
const readme = read("README.md");

requireSignals("Blogger payload", kit, [
  "blogger:",
  "publisherUrl",
  "trackedUrl",
  "title",
  "body",
  "html",
  "buildBloggerHtml",
  "escapeHtml",
  "trackedDetailUrl(product.id, \"blogger\")",
  "process.env.BLOGGER_BLOG_URL",
  "naverBlog:",
  "buildTelegramMessage(product, { detailUrl: telegramUrl })",
  "isPublicDealReady(product)"
]);
requireSignals("Blogger HTML safety", kit, [
  "[제휴 안내]",
  "AFFILIATE_DISCLOSURE",
  "리턴픽 상세 검수와 현재 쿠팡 조건 확인",
  "가격, 재고, 배송 정보, 반품 조건은 확인 시점과 구매 시점에 달라질 수 있습니다",
  "escapeHtml(detailUrl)",
  "escapeHtml(product.title)"
]);
if (kit.includes("product.source_url") || kit.includes("product.image_url") || kit.includes("product.affiliate_url")) {
  throw new Error("Blogger payload must not copy remote page content, images, or direct affiliate URLs");
}

requireSignals("Blogger provider", blogger, [
  "BLOGGER_BLOG_ID",
  "BLOGGER_BLOG_URL",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_OAUTH_REFRESH_TOKEN",
  "BLOGGER_DISTRIBUTION_ENABLED",
  "isBloggerDistributionEnabled()",
  "BLOGGER_PUBLISH_MODE",
  "https://oauth2.googleapis.com/token",
  "https://www.googleapis.com/blogger/v3/blogs/",
  "new URLSearchParams",
  "AbortController",
  "Authorization: `Bearer ${accessToken}`",
  "isDraft",
  "/publish`",
  "publishBloggerDraft",
  "target_type: \"blogger\"",
  "target_key: input.productId",
  "status: input.status",
  "error: input.error",
  "API_NOT_CONFIGURED",
  "BLOGGER_HTTP_",
  "GOOGLE_OAUTH_HTTP_",
  "isPublicDealReady(product)",
  "claimDistributionDelivery",
  "restoreDistributionDraftAfterPrewriteFailure",
  "updateDistributionDelivery",
  "safeDistributionLedgerError",
  "DISTRIBUTION_LEDGER_UPDATE_FAILED",
  "status: \"ambiguous\"",
  "provider_post_id: post.postId",
  "request_key: claim.delivery.request_key",
  "deliveryStatus",
  "ambiguous",
  "BLOGGER_DISTRIBUTION_DISABLED"
]);
requireSignals("Blogger connection probe", blogger, [
  "probeBloggerConnection",
  "BLOGGER_BLOG_ID_MISMATCH",
  "method: \"GET\"",
  "BLOGGER_HTTP_"
]);
const bloggerLogSection = blogger.slice(blogger.indexOf("async function recordBloggerLog"), blogger.indexOf("export async function sendBloggerForProduct"));
if (bloggerLogSection.includes("accessToken") || bloggerLogSection.includes("clientSecret") || bloggerLogSection.includes("refreshToken")) {
  throw new Error("Blogger logs must not include OAuth access tokens");
}

requireSignals("Admin Blogger route", adminRoute, [
  "export async function GET(request: Request)",
  "probeBloggerConnection()",
  "isBloggerDistributionEnabled()",
  "getBloggerPublishMode()",
  "Blogger OAuth 또는 지정 블로그 접근을 확인하지 못했습니다.",
  "requireAdmin(request)",
  "requirePersistentStorage()",
  "mode !== \"preview\" && mode !== \"draft\" && mode !== \"publish\"",
  "status: \"preview\"",
  "payload: buildProductDistributionKit(product).blogger",
  "sendBloggerForProduct(productId, mode as BloggerPostMode)",
  "BLOGGER_ALREADY_DISTRIBUTED",
  "BLOGGER_DISTRIBUTION_DISABLED",
  "BLOGGER_API_NOT_CONFIGURED",
  "DISTRIBUTION_LEDGER_NOT_CONFIGURED",
  "BLOGGER_DISTRIBUTION_PENDING",
  "BLOGGER_DISTRIBUTION_AMBIGUOUS",
  "BLOGGER_DISTRIBUTION_FAILED"
]);
if (adminRoute.includes("process.env") || adminRoute.includes("GOOGLE_OAUTH_CLIENT_SECRET")) {
  throw new Error("Admin Blogger responses must not expose server-only OAuth configuration");
}

requireSignals("Blogger cron route", cronRoute, [
  "requireCronAuth(request)",
  "isCronProbeRequest(request)",
  "cronProbeJson(\"blogger_digest\")",
  "runScheduledBloggerDigest()",
  "CRON_BLOGGER_DIGEST_FAILED"
]);

const bloggerScheduler = scheduler.slice(scheduler.indexOf("export async function runScheduledBloggerDigest"));
requireSignals("Blogger scheduler", bloggerScheduler, [
  "hasSupabaseConfig()",
  "isBloggerDistributionEnabled()",
  "isBloggerConfigured()",
  "listDistributionCandidateProductPage(\"blogger\"",
  "DISTRIBUTION_CANDIDATE_PAGE_SIZE",
  "DISTRIBUTION_CANDIDATE_MAX_ATTEMPTS",
  "findNextReadyDistributionCandidate",
  "loadCandidates: (productIds) => getDistributionCandidateProducts(productIds)",
  "getCandidateId: (product) => product.id",
  "isPublicDealReady",
  "sendBloggerForProduct(candidate.id, mode)",
  "getBloggerPublishMode()",
  "NO_UNSENT_PUBLIC_CUSTOMER_READY_DEALS",
  "NO_CLAIMABLE_PUBLIC_CUSTOMER_READY_DEALS"
]);
if (bloggerScheduler.includes("getScheduledAutomationGate") || bloggerScheduler.includes("isCapabilityReady")) {
  throw new Error("Blogger scheduler must not depend on Coupang/API launch readiness gates");
}
if (blogger.includes("findSuccessfulBloggerLog") || blogger.includes("listTelegramLogs(BLOGGER_LOG_LIMIT)")) {
  throw new Error("Blogger delivery ledger must be the duplicate-prevention source, not a bounded Telegram log scan");
}
if (bloggerScheduler.includes("listDistributionDeliveries(") || bloggerScheduler.includes("listProducts(")) {
  throw new Error("Blogger scheduler must use the bounded database-side candidate anti-join");
}

requireSignals("Blogger delivery ledger", dataStore, [
  "claimDistributionDelivery",
  "planDistributionClaim",
  ".from(\"distribution_deliveries\")",
  "error.code !== \"23505\"",
  "updateDistributionDelivery",
  ".eq(\"status\", \"pending\")",
  ".eq(\"request_key\", input.request_key)",
  "Math.max(1, existing.attempt_count) + 1",
  ".eq(\"status\", existing.status)",
  ".eq(\"delivery_mode\", existing.delivery_mode)",
  ".eq(\"request_key\", existing.request_key)",
  "restoreDistributionDraftAfterPrewriteFailure",
  "listDistributionCandidateProductPage",
  "getDistributionCandidateProducts",
  ".rpc(\"list_distribution_candidate_ids\"",
  "Math.min(100",
  "p_after_created_at",
  "DISTRIBUTION_CANDIDATE_PAGE_INVALID"
]);
requireSignals("Blogger delivery state planner", deliveryState, [
  "planDistributionClaim",
  "planBloggerProviderWrite",
  "retry_failed",
  "promote_draft",
  "draft_post_id_missing",
  "already_distributed"
]);
requireSignals("Blogger delivery schema", schema, [
  "create table if not exists distribution_deliveries",
  "status in ('pending', 'succeeded', 'ambiguous', 'failed')",
  "delivery_mode in ('draft', 'publish')",
  "unique (channel, product_id)",
  "distribution_deliveries_channel_status_idx",
  "distribution_deliveries_updated_at",
  "Preserve successful Blogger deliveries",
  "on conflict (channel, product_id) do nothing",
  "create or replace function is_distribution_customer_ready",
  "conservative superset",
  "btrim(coalesce(affiliate_value, '')) ~*",
  "btrim(coalesce(image_value, '')) <> ''",
  "prices.deal_price <> 0",
  "is_distribution_customer_ready(\n        product.source",
  "create or replace function list_distribution_candidate_ids",
  "p_after_score integer default null",
  "candidate.candidate_score < p_after_score",
  "candidate.product_id > p_after_id",
  "not exists (",
  "delivery.status <> 'failed'",
  "delivery.provider_post_id is not null",
  "revoke all on function list_distribution_candidate_ids",
  "grant execute on function list_distribution_candidate_ids"
]);

requireSignals("Customer-ready queue scan", distributionQueue, [
  "DISTRIBUTION_CANDIDATE_PAGE_SIZE = 100",
  "DISTRIBUTION_CANDIDATE_MAX_ATTEMPTS = 8",
  "findNextReadyDistributionCandidate",
  "DISTRIBUTION_CANDIDATE_CURSOR_STALLED",
  "there is no fixed row ceiling"
]);

requireSignals("Admin distribution UI", component, [
  "텔레그램",
  "Blogger",
  "kit.blogger.html",
  "fetch(\"/api/admin/blogger\"",
  "sendBlogger(\"draft\")",
  "sendBlogger(\"publish\")",
  "Blogger 초안 저장",
  "Blogger 공개 게시"
]);
if (component.includes("naverBlog") || component.includes("네이버 블로그")) {
  throw new Error("Admin distribution UI must show Telegram + Blogger instead of Naver");
}

requireSignals("Vercel Blogger cron", vercel, ["/api/cron/blogger-digest", '"schedule": "15 0 * * *"']);
requireSignals("Blogger environment template", envExample, [
  "BLOGGER_BLOG_ID=",
  "BLOGGER_BLOG_URL=",
  "GOOGLE_OAUTH_CLIENT_ID=",
  "GOOGLE_OAUTH_CLIENT_SECRET=",
  "GOOGLE_OAUTH_REFRESH_TOKEN=",
  "BLOGGER_DISTRIBUTION_ENABLED=false",
  "BLOGGER_PUBLISH_MODE=draft",
  "NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=",
  "NEXT_PUBLIC_NAVER_SITE_VERIFICATION="
]);
requireSignals("Metadata verification", layout, [
  "NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION",
  "NEXT_PUBLIC_NAVER_SITE_VERIFICATION",
  '"naver-site-verification"',
  "google: googleSiteVerification"
]);
requireSignals("Package verification command", packageJson, ['"blogger-distribution:check": "node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/verify-blogger-distribution.mjs"']);
requireSignals("Readiness Blogger contract", readiness, [
  "BLOGGER_BLOG_ID",
  "BLOGGER_BLOG_URL",
  "GOOGLE_OAUTH_CLIENT_ID",
  "BLOGGER_DISTRIBUTION_ENABLED",
  "BLOGGER_PUBLISH_MODE"
]);
requireSignals("Existing public-review gates", quality, ["product.source === \"algumon_discovery\"", "상품별 파트너스 링크 필요"]);
requireSignals("Existing public-ready gate", publicDeal, ["export function isPublicDealReady", "getCustomerPublishReadiness(product).ready"]);
requireSignals("Operator documentation", readme, [
  "BLOGGER_BLOG_ID",
  "GOOGLE_OAUTH_REFRESH_TOKEN",
  "BLOGGER_DISTRIBUTION_ENABLED=false",
  "/api/cron/blogger-digest",
  "Blogger",
  "초안"
]);

const { isPrewriteFailureRetryable, planBloggerProviderWrite, planDistributionClaim } = await import("../lib/distributionDeliveryState.ts");
const { findNextReadyDistributionCandidate } = await import("../lib/distributionQueue.ts");
function expectPlan(label, existing, mode, expected) {
  const actual = planDistributionClaim(existing, mode);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} plan mismatch: ${JSON.stringify(actual)}`);
  }
}

expectPlan("new draft", null, "draft", { action: "claim", operation: "insert" });
expectPlan("new direct publish", null, "publish", { action: "claim", operation: "insert" });
expectPlan(
  "retry definite pre-write failure",
  { status: "failed", delivery_mode: "draft", provider_post_id: null },
  "draft",
  { action: "claim", operation: "retry_failed" }
);
expectPlan(
  "promote recorded draft",
  { status: "succeeded", delivery_mode: "draft", provider_post_id: "post-1" },
  "publish",
  { action: "claim", operation: "promote_draft" }
);
expectPlan(
  "do not duplicate published post",
  { status: "succeeded", delivery_mode: "publish", provider_post_id: "post-1" },
  "publish",
  { action: "reject", reason: "already_distributed" }
);
expectPlan(
  "do not duplicate same draft",
  { status: "succeeded", delivery_mode: "draft", provider_post_id: "post-1" },
  "draft",
  { action: "reject", reason: "already_distributed" }
);
expectPlan(
  "pending remains blocked",
  { status: "pending", delivery_mode: "draft", provider_post_id: null },
  "draft",
  { action: "reject", reason: "pending" }
);
expectPlan(
  "ambiguous remains blocked",
  { status: "ambiguous", delivery_mode: "publish", provider_post_id: "post-1" },
  "publish",
  { action: "reject", reason: "ambiguous" }
);
expectPlan(
  "draft without provider id needs reconciliation",
  { status: "succeeded", delivery_mode: "draft", provider_post_id: null },
  "publish",
  { action: "reject", reason: "draft_post_id_missing" }
);

const draftInsertPlan = planBloggerProviderWrite("insert", "draft", null);
if (JSON.stringify(draftInsertPlan) !== JSON.stringify({ action: "insert_new_post", isDraft: true })) {
  throw new Error(`draft provider plan mismatch: ${JSON.stringify(draftInsertPlan)}`);
}
const directPublishPlan = planBloggerProviderWrite("insert", "publish", null);
if (JSON.stringify(directPublishPlan) !== JSON.stringify({ action: "insert_new_post", isDraft: false })) {
  throw new Error(`direct publish provider plan mismatch: ${JSON.stringify(directPublishPlan)}`);
}
const draftPromotionPlan = planBloggerProviderWrite("promote_draft", "publish", "post-1");
if (JSON.stringify(draftPromotionPlan) !== JSON.stringify({ action: "publish_existing_draft", postId: "post-1" })) {
  throw new Error(`draft promotion provider plan mismatch: ${JSON.stringify(draftPromotionPlan)}`);
}
let missingDraftPostIdRejected = false;
try {
  planBloggerProviderWrite("promote_draft", "publish", null);
} catch (error) {
  missingDraftPostIdRejected = error instanceof Error && error.message === "BLOGGER_DRAFT_POST_ID_MISSING";
}
if (!missingDraftPostIdRejected) throw new Error("draft promotion without provider post id must fail closed");
if (!isPrewriteFailureRetryable("insert") || !isPrewriteFailureRetryable("retry_failed") || isPrewriteFailureRetryable("promote_draft")) {
  throw new Error("pre-write retry policy must retry new/retry claims and restore recorded drafts");
}

const invalidRowsBeforeValid = Array.from({ length: 150 }, (_, index) => ({ id: `row-${index}`, ready: index === 125 }));
const starvationScan = await findNextReadyDistributionCandidate({
  pageSize: 100,
  loadPage: async (limit, cursor) => {
    const start = cursor ? Number(cursor.productId.slice(4)) + 1 : 0;
    return {
      items: invalidRowsBeforeValid.slice(start, start + limit).map((row, index) => {
        const absoluteIndex = start + index;
        return {
          productId: row.id,
          cursor: { score: 1_000 - absoluteIndex, createdAt: "2026-08-09T00:00:00.000Z", productId: row.id }
        };
      })
    };
  },
  loadCandidates: async (productIds) => invalidRowsBeforeValid.filter((row) => productIds.includes(row.id)),
  getCandidateId: (row) => row.id,
  isReady: (row) => row.ready
});
if (starvationScan.candidate?.id !== "row-125" || starvationScan.scannedCount !== 126 || starvationScan.pageCount !== 2) {
  throw new Error("customer-ready queue must continue past 100 invalid rows");
}

console.log("Blogger distribution checks passed: escaped payload, server-only OAuth, durable idempotency ledger, admin modes, gated daily cron, metadata, and existing public-review gates.");
