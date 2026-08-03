import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
const buildManifestPath = path.join(process.cwd(), ".next", "build-manifest.json");
const productId = "11111111-1111-4111-8111-111111111111";
const productTitle = "ReturnPick QA 27인치 QHD 144Hz 모니터 반품-최상";
const affiliateUrl = "https://link.coupang.com/a/AbCd123";

if (!fs.existsSync(buildIdPath) && !fs.existsSync(buildManifestPath)) {
  throw new Error("NEXT_BUILD_REQUIRED: run npm run build before bootstrap-catalog:check");
}

function catalogValue({
  resolvedProductId = "9200000001",
  identityStatus,
  includeReturnEvidence = true,
  source = "public_web",
  includeObservation = true,
  manualReviewAt = null,
  lastObservedAt = null,
  sourcingStatus = "published",
  isPublished = true,
  demoMarkers = false,
  identityPatch = {},
  affiliateUrlValue = affiliateUrl,
  productPatch = {}
} = {}) {
  const now = new Date().toISOString();
  return JSON.stringify({
    version: 1,
    exported_at: now,
    products: [
      {
        id: productId,
        source,
        source_product_id: "bootstrap-verified-9200000001",
        category: "monitor",
        keyword: "QHD 모니터",
        title: productTitle,
        brand: "ReturnPick QA",
        model_name: "RP-QA-27Q144",
        image_url: "https://images.example.com/returnpick-qa.jpg",
        source_url: "https://www.coupang.com/vp/products/9200000001?itemId=27000000001",
        coupang_url: "https://www.coupang.com/vp/products/9200000001?itemId=27000000001",
        affiliate_url: affiliateUrlValue,
        source_price: 150000,
        return_price: includeReturnEvidence ? 150000 : null,
        new_price: 220000,
        naver_lowest_price: null,
        condition_grade: includeReturnEvidence ? "최상" : "확인필요",
        stock_count: 2,
        spec_json: { size: "27인치", resolution: "QHD", refresh_rate: "144Hz" },
        raw_json: {
          affiliate_verification: {
            affiliate_url: affiliateUrlValue,
            status: identityStatus ?? (resolvedProductId === "9200000001" ? "MATCH" : "MISMATCH"),
            expected_product_id: "9200000001",
            expected_id_source: "coupang_url",
            resolved_product_id: resolvedProductId,
            resolution_code: "RESOLVED_PRODUCT",
            checked_at: now,
            method: "automatic",
            ...identityPatch
          },
          ...(demoMarkers ? { provider: "demo_provider", demo_seed: true } : {}),
          ...(manualReviewAt
            ? {
                manual_catalog_review: {
                  status: "approved",
                  method: "manual",
                  reviewed_at: manualReviewAt
                }
              }
            : {})
        },
        sourcing_status: sourcingStatus,
        is_published: isPublished,
        is_rejected: false,
        rejection_reason: null,
        admin_memo: null,
        public_note: "로컬 통합 검증용 상품입니다.",
        last_observed_at: includeObservation ? lastObservedAt ?? now : null,
        created_at: now,
        updated_at: now,
        ...productPatch
      }
    ]
  });
}

async function waitForServer(baseUrl, child, logs) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`NEXT_START_EXITED_${child.exitCode}: ${logs.join("").slice(-2_000)}`);
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`NEXT_START_TIMEOUT: ${logs.join("").slice(-2_000)}`);
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3_000))
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function withServer(port, catalog, run) {
  const logs = [];
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      RETURNPICK_BOOTSTRAP_CATALOG_JSON: catalog
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  child.stderr.on("data", (chunk) => logs.push(chunk.toString()));
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await waitForServer(baseUrl, child, logs);
    await run(baseUrl, logs);
  } finally {
    await stopServer(child);
  }
}

await withServer(3217, catalogValue(), async (baseUrl) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.match(dealsHtml, new RegExp(productTitle));

  const detail = await fetch(`${baseUrl}/deals/${productId}`);
  const detailHtml = await detail.text();
  assert.equal(detail.status, 200);
  assert.match(detailHtml, new RegExp(affiliateUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(detailHtml, /쿠팡에서 가격 확인/);
  const productJsonLdMatch = detailHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(productJsonLdMatch, "customer-ready deal detail must expose Product JSON-LD");
  const productJsonLd = JSON.parse(productJsonLdMatch[1]);
  assert.equal(productJsonLd["@type"], "Product");
  assert.equal(productJsonLd.name, productTitle);
  assert.equal(productJsonLd.category, "모니터");
  assert.equal("offers" in productJsonLd, false);
  assert.equal("availability" in productJsonLd, false);
  assert.equal("aggregateRating" in productJsonLd, false);
});

await withServer(3218, catalogValue({ resolvedProductId: "9999999999", identityStatus: "MATCH" }), async (baseUrl, logs) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
  assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
});

await withServer(3219, catalogValue({ includeReturnEvidence: false }), async (baseUrl) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.match(dealsHtml, new RegExp(productTitle));
  assert.match(dealsHtml, /반품 정보 확인필요/);

  const detail = await fetch(`${baseUrl}/deals/${productId}`);
  const detailHtml = await detail.text();
  assert.equal(detail.status, 200);
  assert.match(detailHtml, /현재 판매가/);
  assert.match(detailHtml, /반품 정보가 확인되지 않은 항목은 쿠팡 상품 페이지에서 최종 확인하세요/);
});

await withServer(3220, catalogValue({ source: "manual_admin", includeObservation: false, manualReviewAt: new Date().toISOString() }), async (baseUrl) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.match(dealsHtml, new RegExp(productTitle));
});

await withServer(
  3221,
  catalogValue({
    source: "manual_affiliate_link",
    includeObservation: false,
    manualReviewAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000).toISOString()
  }),
  async (baseUrl, logs) => {
    const deals = await fetch(`${baseUrl}/deals`);
    const dealsHtml = await deals.text();
    assert.equal(deals.status, 200);
    assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
    assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
  }
);

await withServer(3222, catalogValue({ sourcingStatus: "needs_review", isPublished: false }), async (baseUrl, logs) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
  assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
});

await withServer(3223, catalogValue({ lastObservedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000).toISOString() }), async (baseUrl, logs) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
  assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
});

await withServer(3224, catalogValue({ lastObservedAt: new Date(Date.now() + 60 * 60 * 1_000).toISOString() }), async (baseUrl, logs) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
  assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
});

await withServer(3225, catalogValue({ demoMarkers: true }), async (baseUrl, logs) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
  assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
});

await withServer(
  3226,
  catalogValue({ identityPatch: { expected_id_source: null, checked_at: null, method: "bogus" } }),
  async (baseUrl, logs) => {
    const deals = await fetch(`${baseUrl}/deals`);
    const dealsHtml = await deals.text();
    assert.equal(deals.status, 200);
    assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
    assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
  }
);

await withServer(3228, catalogValue({ identityPatch: { checked_at: "1" } }), async (baseUrl, logs) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
  assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
});

await withServer(3229, catalogValue({ identityPatch: { method: "manual" } }), async (baseUrl, logs) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
  assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
});

await withServer(3227, catalogValue({ source: "manual_admin", includeObservation: true }), async (baseUrl, logs) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
  assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
});

await withServer(3230, catalogValue({ productPatch: { stock_count: 0 } }), async (baseUrl, logs) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
  assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
});

await withServer(3231, catalogValue({ productPatch: { coupang_url: "https://evil.example/vp/products/9200000001" } }), async (baseUrl, logs) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
  assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
});

await withServer(3232, catalogValue({ productPatch: { image_url: "https://127.0.0.1/private.jpg" } }), async (baseUrl, logs) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
  assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
});

await withServer(3233, catalogValue({ productPatch: { image_url: "https://user:pass@images.example.com/private.jpg" } }), async (baseUrl, logs) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
  assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
});

await withServer(3234, catalogValue({ affiliateUrlValue: "https://link.coupang.com/a/dpyguokdsm" }), async (baseUrl, logs) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
  assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
});

await withServer(3235, catalogValue({ affiliateUrlValue: "https://link.coupang.com/a/sample123" }), async (baseUrl, logs) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
  assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
});

await withServer(3236, catalogValue({ identityPatch: { resolution_code: "" } }), async (baseUrl, logs) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
  assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
});

await withServer(3237, catalogValue({ identityPatch: { expected_product_id: "not-numeric" } }), async (baseUrl, logs) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
  assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
});

await withServer(3238, catalogValue({ identityPatch: { status: "MISMATCH", resolved_product_id: null } }), async (baseUrl, logs) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
  assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
});

await withServer(3239, catalogValue({ identityPatch: { checked_at: "2026-02-30T00:00:00.000Z" } }), async (baseUrl, logs) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
  assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
});

await withServer(3240, catalogValue({ source: " manual_admin ", includeObservation: true }), async (baseUrl, logs) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
  assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
});

await withServer(3241, catalogValue({ productPatch: { coupang_url: "https://www.coupang.com/vp/products/not-a-number" } }), async (baseUrl, logs) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
  assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
});

await withServer(3242, catalogValue({ productPatch: { coupang_url: "https://www.coupang.com/vp/products/9200000001/extra" } }), async (baseUrl, logs) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
  assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
});

console.log("Bootstrap catalog runtime checks passed: verified product hydration, price-only publication, and stale or forged affiliate identity rejection.");
