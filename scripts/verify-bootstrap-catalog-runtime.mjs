import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
const productId = "11111111-1111-4111-8111-111111111111";
const productTitle = "ReturnPick QA 27인치 QHD 144Hz 모니터 반품-최상";
const affiliateUrl = "https://link.coupang.com/a/AbCd123";

if (!fs.existsSync(buildIdPath)) {
  throw new Error("NEXT_BUILD_REQUIRED: run npm run build before bootstrap-catalog:check");
}

function catalogValue({ resolvedProductId = "9200000001", identityStatus } = {}) {
  const now = new Date().toISOString();
  return JSON.stringify({
    version: 1,
    exported_at: now,
    products: [
      {
        id: productId,
        source: "public_web",
        source_product_id: "bootstrap-verified-9200000001",
        category: "monitor",
        keyword: "QHD 모니터",
        title: productTitle,
        brand: "ReturnPick QA",
        model_name: "RP-QA-27Q144",
        image_url: "https://images.example.com/returnpick-qa.jpg",
        source_url: "https://www.coupang.com/vp/products/9200000001?itemId=27000000001",
        coupang_url: "https://www.coupang.com/vp/products/9200000001?itemId=27000000001",
        affiliate_url: affiliateUrl,
        source_price: 150000,
        return_price: 150000,
        new_price: 220000,
        naver_lowest_price: null,
        condition_grade: "최상",
        stock_count: 2,
        spec_json: { size: "27인치", resolution: "QHD", refresh_rate: "144Hz" },
        raw_json: {
          affiliate_verification: {
            affiliate_url: affiliateUrl,
            status: identityStatus ?? (resolvedProductId === "9200000001" ? "MATCH" : "MISMATCH"),
            expected_product_id: "9200000001",
            expected_id_source: "coupang_url",
            resolved_product_id: resolvedProductId,
            resolution_code: "RESOLVED_PRODUCT",
            checked_at: now,
            method: "automatic"
          }
        },
        sourcing_status: "published",
        is_published: true,
        is_rejected: false,
        rejection_reason: null,
        admin_memo: null,
        public_note: "로컬 통합 검증용 상품입니다.",
        last_observed_at: now,
        created_at: now,
        updated_at: now
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
});

await withServer(3218, catalogValue({ resolvedProductId: "9999999999", identityStatus: "MATCH" }), async (baseUrl, logs) => {
  const deals = await fetch(`${baseUrl}/deals`);
  const dealsHtml = await deals.text();
  assert.equal(deals.status, 200);
  assert.doesNotMatch(dealsHtml, new RegExp(productTitle));
  assert.match(logs.join(""), /RETURNPICK_BOOTSTRAP_CATALOG_REJECTED/);
});

console.log("Bootstrap catalog runtime checks passed: verified product hydration and stale or forged affiliate identity rejection.");
