#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
const port = 3236;
const baseUrl = `http://127.0.0.1:${port}`;
const endpoint = `${baseUrl}/api/admin/bootstrap-catalog/manual`;
const adminPassword = "ManualBootstrapRuntime123!";
const manualExpiryWindowMs = 7 * 24 * 60 * 60 * 1_000;
const expiringProductTitle = "ReturnPick QA expiring manual catalog product";

if (!fs.existsSync(buildIdPath)) throw new Error("NEXT_BUILD_REQUIRED: run npm run build before manual-bootstrap:runtime:check");

const productRow = (productId, affiliateUrl) => ({
  title: `ReturnPick QA monitor ${productId}`,
  category: "monitor",
  coupang_url: `https://www.coupang.com/vp/products/${productId}`,
  affiliate_url: affiliateUrl,
  brand: "ReturnPick QA",
  model_name: "RP-QA-27Q144",
  image_url: "https://image10.coupangcdn.com/returnpick-qa.jpg",
  source_price: 150000,
  return_price: 120000,
  new_price: 220000,
  naver_lowest_price: 180000,
  condition_grade: "최상",
  stock_count: 2,
  public_note: "로컬 수동 카탈로그 검증용 상품입니다."
});

function requestBody(rows, manualIdentityConfirmed = true) {
  return JSON.stringify({ rows, manual_identity_confirmed: manualIdentityConfirmed });
}

function manualCatalogValue(reviewedAt) {
  const now = new Date().toISOString();
  return JSON.stringify({
    version: 1,
    exported_at: now,
    products: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        source: "manual_admin",
        source_product_id: "manual-9200000009",
        category: "monitor",
        keyword: null,
        title: expiringProductTitle,
        brand: "ReturnPick QA",
        model_name: "RP-QA-27Q144",
        image_url: "https://image10.coupangcdn.com/returnpick-expiring.jpg",
        source_url: "https://www.coupang.com/vp/products/9200000009",
        coupang_url: "https://www.coupang.com/vp/products/9200000009",
        affiliate_url: "https://link.coupang.com/a/AbCd900",
        source_price: 150000,
        return_price: 120000,
        new_price: 220000,
        naver_lowest_price: null,
        condition_grade: "최상",
        stock_count: 2,
        spec_json: { size: "27인치", resolution: "QHD", refresh_rate: "144Hz" },
        raw_json: {
          provider: "manual_admin",
          affiliate_verification: {
            affiliate_url: "https://link.coupang.com/a/AbCd900",
            status: "MANUAL_CONFIRMED",
            expected_product_id: "9200000009",
            expected_id_source: "coupang_url",
            resolved_product_id: null,
            resolution_code: "MANUAL_BROWSER_CONFIRMATION",
            checked_at: reviewedAt,
            method: "manual"
          },
          manual_catalog_review: {
            status: "approved",
            method: "manual",
            reviewed_at: reviewedAt
          }
        },
        sourcing_status: "published",
        is_published: true,
        is_rejected: false,
        rejection_reason: null,
        admin_memo: null,
        public_note: "수동 검토 만료 회귀 검증용 상품입니다.",
        last_observed_at: null,
        created_at: now,
        updated_at: now
      }
    ]
  });
}

async function post(body, options = {}) {
  return fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": adminPassword,
      ...(options.headers ?? {})
    },
    body,
    ...options.fetchOptions
  });
}

async function waitForServer(child, logs) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`NEXT_START_EXITED_${child.exitCode}: ${logs.join("").slice(-2_000)}`);
    try {
      const response = await fetch(baseUrl);
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

const logs = [];
const expiringReviewAt = new Date(Date.now() - manualExpiryWindowMs + 25_000).toISOString();
const child = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    ADMIN_PASSWORD: adminPassword,
    NODE_ENV: "development",
    NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL: "https://link.coupang.com/a/dRiMJOFU0i",
    RETURNPICK_BOOTSTRAP_CATALOG_JSON: manualCatalogValue(expiringReviewAt)
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true
});
child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
child.stderr.on("data", (chunk) => logs.push(chunk.toString()));

try {
  await waitForServer(child, logs);

  const expiringBefore = await fetch(`${baseUrl}/deals`);
  const expiringBeforeHtml = await expiringBefore.text();
  assert.equal(expiringBefore.status, 200);
  assert.match(expiringBeforeHtml, new RegExp(expiringProductTitle));

  await new Promise((resolve) => setTimeout(resolve, 27_000));
  const expiringAfter = await fetch(`${baseUrl}/deals`);
  const expiringAfterHtml = await expiringAfter.text();
  assert.equal(expiringAfter.status, 200);
  assert.doesNotMatch(expiringAfterHtml, new RegExp(expiringProductTitle));

  const unauthorized = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: requestBody([])
  });
  assert.equal(unauthorized.status, 401);

  const valid = await post(requestBody([productRow("9200000001", "https://link.coupang.com/a/AbCd123")]));
  const validPayload = await valid.json();
  assert.equal(valid.status, 200);
  assert.equal(validPayload.status, "ready");
  assert.equal(validPayload.eligible_count, 1);
  assert.equal(validPayload.storage_mode, "manual_input");

  const twentyRows = Array.from({ length: 20 }, (_, index) =>
    productRow(String(920001000 + index), `https://link.coupang.com/a/RpQa${String(index).padStart(2, "0")}`)
  );
  const twenty = await post(requestBody(twentyRows));
  const twentyPayload = await twenty.json();
  if (twenty.status === 200) {
    assert.equal(twentyPayload.status, "ready");
    assert.equal(twentyPayload.eligible_count, 20);
  } else {
    assert.equal(twenty.status, 400);
    assert.equal(twentyPayload.status, "invalid");
    assert.equal(twentyPayload.env_value, null);
    assert.ok(twentyPayload.issues.some((item) => item.code === "CATALOG_SIZE_LIMIT"));
  }

  const navigationImageRow = productRow("9200000008", "https://link.coupang.com/a/AbCd129");
  navigationImageRow.image_url = navigationImageRow.affiliate_url;
  const navigationImage = await post(requestBody([navigationImageRow]));
  const navigationImagePayload = await navigationImage.json();
  assert.equal(navigationImage.status, 400);
  assert.equal(navigationImagePayload.storage_mode, undefined);
  assert.ok(navigationImagePayload.issues.some((item) => item.code === "PRODUCT_IMAGE_INVALID"));

  const duplicate = await post(
    requestBody([
      productRow("9200000001", "https://link.coupang.com/a/AbCd123"),
      productRow("9200000002", "https://link.coupang.com/a/AbCd123")
    ])
  );
  const duplicatePayload = await duplicate.json();
  assert.equal(duplicate.status, 400);
  assert.ok(duplicatePayload.issues.some((item) => item.code === "DUPLICATE_AFFILIATE_LINK"));

  const extraColumnRow = { ...productRow("9200000006", "https://link.coupang.com/a/AbCd127"), extra_column: "unexpected" };
  const extraColumn = await post(requestBody([extraColumnRow]));
  const extraColumnPayload = await extraColumn.json();
  assert.equal(extraColumn.status, 400);
  assert.ok(extraColumnPayload.issues.some((item) => item.code === "FIELD_NOT_ALLOWED"));

  const malformedRow = productRow("9200000003", "https://link.coupang.com/a/AbCd124");
  malformedRow.source_price = true;
  const malformed = await post(requestBody([malformedRow]));
  const malformedPayload = await malformed.json();
  assert.equal(malformed.status, 400);
  assert.ok(malformedPayload.issues.some((item) => item.code === "FIELD_TYPE_INVALID"));

  const overlongRow = productRow("9200000004", "https://link.coupang.com/a/AbCd125");
  overlongRow.title = "x".repeat(301);
  const overlong = await post(requestBody([overlongRow]));
  const overlongPayload = await overlong.json();
  assert.equal(overlong.status, 400);
  assert.ok(overlongPayload.issues.some((item) => item.code === "FIELD_TOO_LONG"));

  const nullBody = await post("null");
  const nullBodyPayload = await nullBody.json();
  assert.equal(nullBody.status, 400);
  assert.equal(nullBodyPayload.error, "BODY_OBJECT_REQUIRED");
  assert.equal(nullBodyPayload.storage_mode, undefined);

  const oversizedBody = JSON.stringify({
    rows: [{ ...productRow("9200000005", "https://link.coupang.com/a/AbCd126"), public_note: "x".repeat(70_000) }],
    manual_identity_confirmed: true
  });
  const oversizedStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(oversizedBody));
      controller.close();
    }
  });
  const oversized = await post("", {
    fetchOptions: { body: oversizedStream, duplex: "half" }
  });
  assert.equal(oversized.status, 413);
} finally {
  await stopServer(child);
}

console.log("Manual bootstrap runtime checks passed: admin auth, valid export, duplicate affiliate rejection, strict field validation, and streamed body limits.");
