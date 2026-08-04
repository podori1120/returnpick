import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";
import os from "node:os";
import path from "node:path";

register("./public-web-test-loader.mjs", import.meta.url);
const { inspectPublicWebProductUrl } = await import("../lib/providers/publicWebProvider.ts");

const projectRoot = process.cwd();

function read(path) {
  return fs.readFileSync(path, "utf8");
}

const provider = read("lib/providers/publicWebProvider.ts");
const route = read("app/api/admin/products/link-intake/route.ts");
const bulkRoute = read("app/api/admin/products/link-intake/bulk/route.ts");
const ui = read("components/AdminAffiliateLinkIntake.tsx");
const packageJson = read("package.json");

assert.match(provider, /export async function inspectPublicWebProductUrl/);
assert.match(provider, /PUBLIC_WEB_ALLOWED_HOSTS_INVALID/);
assert.match(provider, /PRODUCT_PATH_REQUIRED/);
assert.match(provider, /isPathAllowedByRobots\(robots\.text/);
assert.match(provider, /redirect:\s*["']manual["']/);
assert.match(provider, /readTextWithLimit\(response, MAX_PUBLIC_WEB_HTML_BYTES\)/);
assert.match(provider, /public_web_inspection/);
assert.match(provider, /FETCH_TIMEOUT/);
assert.match(provider, /originNextFetchAt\.set\(origin, scheduledAt \+ delayMs\)/);
assert.doesNotMatch(provider, /return\s+htmlResult\.text/);

assert.match(route, /body\.enrich_public_web === true/);
assert.match(route, /inspectPublicWebProductUrl/);
assert.match(route, /enrichPublicWeb && inputCoupangUrl && isUsableCoupangProductUrl\(inputCoupangUrl\)/);
assert.match(route, /inspectPublicWebProductUrl\(\{\s*url:\s*inputCoupangUrl[\s\S]*?deadlineAt:\s*Date\.now\(\)\s*\+\s*PUBLIC_WEB_INTAKE_ENRICHMENT_BUDGET_MS/);
assert.match(route, /sourcing_status: "needs_review"/);
assert.match(route, /is_published: false/);
assert.match(route, /public_web_enrichment/);
assert.match(route, /enrichment\.status !== "ok"/);
assert.match(route, /new_price: null/);
assert.match(route, /isUsableProductImageUrl\(metadata\.image_url\)/);
assert.match(route, /title: candidateTitle/);
assert.match(route, /appliedFields/);
assert.match(route, /!imageUrl && enrichedImageUrl/);

assert.match(bulkRoute, /enrich_public_web/);
assert.match(bulkRoute, /MAX_PUBLIC_WEB_ITEMS = 2/);
assert.match(bulkRoute, /PUBLIC_WEB_BULK_LIMIT/);
assert.match(ui, /공개 웹 정보 보강 시도/);
assert.match(ui, /PUBLIC_WEB allowlist와 robots\.txt/);
assert.match(ui, /enrich_public_web: enrichPublicWeb/);
assert.match(ui, /batch\.map\(\(item\) => \(\{ \.\.\.item, enrich_public_web: enrichPublicWeb \}\)\)/);
assert.match(ui, /PUBLIC_WEB_BULK_BATCH_SIZE = 2/);
assert.match(packageJson, /"public-web:intake:check":\s*"node .*scripts\/verify-public-web-intake-enrichment\.mjs"/);

const originalFetch = globalThis.fetch;
const originalEnv = {
  enabled: process.env.PUBLIC_WEB_CRAWL_ENABLED,
  hosts: process.env.PUBLIC_WEB_ALLOWED_HOSTS
};

function mockHtmlResponse(body, headers = { "content-type": "text/html; charset=utf-8" }, status = 200) {
  return new Response(body, { status, headers });
}

try {
  delete process.env.PUBLIC_WEB_CRAWL_ENABLED;
  process.env.PUBLIC_WEB_ALLOWED_HOSTS = "intake.example.test";
  let fetchCalls = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    fetchCalls.push(url);
    if (url === "https://intake.example.test/robots.txt") {
      return mockHtmlResponse("User-agent: ReturnPickBot\nAllow: /", { "content-type": "text/plain" });
    }
    if (url === "https://intake.example.test/product/123") {
      return mockHtmlResponse(`
        <meta property="og:title" content="실제 노트북 상품">
        <meta property="og:image" content="https://intake.example.test/images/123.jpg">
        <h1>실제 노트북 상품</h1>
        <p>판매가 999,000원</p>
        <p>${"상품 설명 ".repeat(60)}</p>
        <p>반품-최상 반품가 742,000원 재고 2개</p>
      `);
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  const disabled = await inspectPublicWebProductUrl({ url: "https://intake.example.test/product/123", category: "laptop" });
  assert.equal(disabled.status, "DISABLED");
  assert.equal(fetchCalls.length, 0);

  process.env.PUBLIC_WEB_CRAWL_ENABLED = "true";
  const inspected = await inspectPublicWebProductUrl({ url: "https://intake.example.test/product/123", category: "laptop" });
  assert.equal(inspected.status, "ok");
  assert.equal(inspected.enriched_metadata.title, "실제 노트북 상품");
  assert.equal(inspected.enriched_metadata.image_url, "https://intake.example.test/images/123.jpg");
  assert.equal(inspected.enriched_metadata.source_price, 999000);
  assert.equal(inspected.enriched_metadata.return_price, 742000);
  assert.equal(inspected.enriched_metadata.condition_grade, "최상");
  assert.equal(inspected.enriched_metadata.stock_count, 2);
  assert.ok(inspected.fields_filled.includes("return_price"));
  assert.equal(JSON.stringify(inspected.raw_json).includes("판매가 999,000원"), false);
  assert.deepEqual(fetchCalls, ["https://intake.example.test/robots.txt", "https://intake.example.test/product/123"]);

  process.env.PUBLIC_WEB_ALLOWED_HOSTS = "blocked-intake.example.test";
  fetchCalls = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    fetchCalls.push(url);
    if (url === "https://blocked-intake.example.test/robots.txt") {
      return mockHtmlResponse("User-agent: ReturnPickBot\nDisallow: /", { "content-type": "text/plain" });
    }
    throw new Error(`robots should block detail fetch: ${url}`);
  };
  const blocked = await inspectPublicWebProductUrl({ url: "https://blocked-intake.example.test/product/123", category: "laptop" });
  assert.equal(blocked.status, "ROBOTS_DISALLOWED");
  assert.deepEqual(fetchCalls, ["https://blocked-intake.example.test/robots.txt"]);

  process.env.PUBLIC_WEB_ALLOWED_HOSTS = "bare-intake.example.test";
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "https://bare-intake.example.test/robots.txt") {
      return mockHtmlResponse("User-agent: ReturnPickBot\nAllow: /", { "content-type": "text/plain" });
    }
    return mockHtmlResponse("<title>페이지 제목</title><p>판매가 999,000원</p>");
  };
  const bare = await inspectPublicWebProductUrl({ url: "https://bare-intake.example.test/product/123", category: "laptop" });
  assert.equal(bare.status, "ok");
  assert.equal(bare.enriched_metadata.title, "페이지 제목");
  assert.equal(bare.enriched_metadata.condition_grade, null);
  assert.equal(bare.fields_filled.includes("condition_grade"), false);

  process.env.PUBLIC_WEB_ALLOWED_HOSTS = "timeout-intake.example.test";
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "https://timeout-intake.example.test/robots.txt") {
      return mockHtmlResponse("User-agent: ReturnPickBot\nAllow: /", { "content-type": "text/plain" });
    }
    const stream = new ReadableStream({ start() {} });
    return new Response(stream, { headers: { "content-type": "text/html; charset=utf-8" } });
  };
  const timeoutStartedAt = performance.now();
  const timedOut = await inspectPublicWebProductUrl({
    url: "https://timeout-intake.example.test/product/123",
    category: "laptop",
    deadlineAt: Date.now() + 1_500
  });
  assert.equal(timedOut.status, "FETCH_TIMEOUT");
  assert.ok(performance.now() - timeoutStartedAt < 2_500, "body deadline should bound inspection time");

  process.env.PUBLIC_WEB_ALLOWED_HOSTS = "throttle-intake.example.test";
  const detailTimes = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "https://throttle-intake.example.test/robots.txt") {
      return mockHtmlResponse("User-agent: ReturnPickBot\nAllow: /", { "content-type": "text/plain" });
    }
    detailTimes.push(Date.now());
    return mockHtmlResponse("<title>상품</title><p>판매가 999,000원</p>");
  };
  const throttleDeadline = Date.now() + 5_000;
  const throttled = await Promise.all([
    inspectPublicWebProductUrl({ url: "https://throttle-intake.example.test/product/1", category: "laptop", deadlineAt: throttleDeadline }),
    inspectPublicWebProductUrl({ url: "https://throttle-intake.example.test/product/2", category: "laptop", deadlineAt: throttleDeadline })
  ]);
  assert.equal(throttled[0]?.status, "ok");
  assert.equal(throttled[1]?.status, "ok");
  assert.equal(detailTimes.length, 2);
  assert.ok(Math.abs(detailTimes[1] - detailTimes[0]) >= 900, "concurrent detail requests must reserve the origin delay");
} finally {
  globalThis.fetch = originalFetch;
  if (originalEnv.enabled === undefined) delete process.env.PUBLIC_WEB_CRAWL_ENABLED;
  else process.env.PUBLIC_WEB_CRAWL_ENABLED = originalEnv.enabled;
  if (originalEnv.hosts === undefined) delete process.env.PUBLIC_WEB_ALLOWED_HOSTS;
  else process.env.PUBLIC_WEB_ALLOWED_HOSTS = originalEnv.hosts;
}

const retryFetch = globalThis.fetch;
const retryEnv = {
  enabled: process.env.PUBLIC_WEB_CRAWL_ENABLED,
  hosts: process.env.PUBLIC_WEB_ALLOWED_HOSTS
};
try {
  process.env.PUBLIC_WEB_CRAWL_ENABLED = "true";
  process.env.PUBLIC_WEB_ALLOWED_HOSTS = "robots-timeout-intake.example.test";
  let robotsAttempts = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "https://robots-timeout-intake.example.test/robots.txt") {
      robotsAttempts += 1;
      if (robotsAttempts === 1) return new Promise(() => {});
      return mockHtmlResponse("User-agent: ReturnPickBot\nAllow: /", { "content-type": "text/plain" });
    }
    return mockHtmlResponse("<title>재시도 상품</title><p>판매가 999,000원</p>");
  };

  const firstAttempt = await inspectPublicWebProductUrl({
    url: "https://robots-timeout-intake.example.test/product/123",
    category: "laptop",
    deadlineAt: Date.now() + 150
  });
  assert.equal(firstAttempt.status, "FETCH_TIMEOUT");

  const secondAttempt = await inspectPublicWebProductUrl({
    url: "https://robots-timeout-intake.example.test/product/123",
    category: "laptop",
    deadlineAt: Date.now() + 2_500
  });
  assert.equal(secondAttempt.status, "ok");
  assert.equal(robotsAttempts, 2, "a timed-out robots request must be evicted so the next attempt refetches");
} finally {
  globalThis.fetch = retryFetch;
  if (retryEnv.enabled === undefined) delete process.env.PUBLIC_WEB_CRAWL_ENABLED;
  else process.env.PUBLIC_WEB_CRAWL_ENABLED = retryEnv.enabled;
  if (retryEnv.hosts === undefined) delete process.env.PUBLIC_WEB_ALLOWED_HOSTS;
  else process.env.PUBLIC_WEB_ALLOWED_HOSTS = retryEnv.hosts;
}

const routeEnvKeys = [
  "NODE_ENV",
  "ADMIN_PASSWORD",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RETURNPICK_DEMO_MODE",
  "PUBLIC_WEB_CRAWL_ENABLED",
  "PUBLIC_WEB_ALLOWED_HOSTS"
];
const routeEnv = Object.fromEntries(routeEnvKeys.map((key) => [key, process.env[key]]));
const routeFetch = globalThis.fetch;
const routeTempDir = fs.mkdtempSync(path.join(os.tmpdir(), "returnpick-intake-"));
try {
  process.chdir(routeTempDir);
  process.env.NODE_ENV = "test";
  process.env.NEXT_PUBLIC_SITE_URL = "https://returnpick.test";
  process.env.RETURNPICK_DEMO_MODE = "false";
  process.env.PUBLIC_WEB_CRAWL_ENABLED = "true";
  process.env.PUBLIC_WEB_ALLOWED_HOSTS = "www.coupang.com,img.coupang.com";
  delete process.env.ADMIN_PASSWORD;
  delete process.env.NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const { POST: intakePost } = await import("../app/api/admin/products/link-intake/route.ts");
  const fetchLog = [];
  const productPageHits = new Map();
  globalThis.fetch = async (input) => {
    const url = String(input);
    fetchLog.push(url);
    if (url === "https://link.coupang.com/a/abc123") {
      return new Response("", { status: 302, headers: { location: "https://www.coupang.com/vp/products/123" } });
    }
    if (url === "https://link.coupang.com/a/def456") {
      return new Response("", { status: 302, headers: { location: "https://www.coupang.com/vp/products/456" } });
    }
    if (url === "https://link.coupang.com/a/ghi789") {
      return new Response("", { status: 302, headers: { location: "https://www.coupang.com/vp/products/789" } });
    }
    if (url === "https://link.coupang.com/a/jkl790") {
      return new Response("", { status: 302, headers: { location: "https://www.coupang.com/vp/products/790" } });
    }
    if (url === "https://www.coupang.com/robots.txt") {
      return mockHtmlResponse("User-agent: ReturnPickBot\nAllow: /", { "content-type": "text/plain" });
    }
    if (/^https:\/\/www\.coupang\.com\/vp\/products\/(123|456|789|790)$/.test(url)) {
      const hitCount = (productPageHits.get(url) ?? 0) + 1;
      productPageHits.set(url, hitCount);
      if (hitCount === 1) return new Response("", { status: 403 });
      const productId = url.match(/\/vp\/products\/(123|456|789|790)$/)?.[1] ?? "123";
      const pageTitle = productId === "789" ? "제목".repeat(150) : productId === "790" ? "수동 이미지 우선 상품" : "실제 페이지 제목";
      const pageImage = productId === "789" ? "https://evil.example.test/789.jpg" : `https://img.coupang.com/${productId}.jpg`;
      return mockHtmlResponse(`
        <meta property="og:title" content="${pageTitle}">
        <meta property="og:image" content="${pageImage}">
        <title>${pageTitle}</title>
        <p>판매가 999,000원</p>
      `);
    }
    throw new Error(`unexpected route fetch: ${url}`);
  };

  function intakeRequest(code, productId, title, options = {}) {
    return new Request("https://returnpick.test/api/admin/products/link-intake", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        category: "laptop",
        affiliate_url: `https://link.coupang.com/a/${code}`,
        coupang_url: `https://www.coupang.com/vp/products/${productId}`,
        ...(options?.imageUrl ? { image_url: options.imageUrl } : {}),
        enrich_public_web: true
      })
    });
  }

  const insertedResponse = await intakePost(intakeRequest("abc123", "123", "입력 상품 제목"));
  const insertedBody = await insertedResponse.json();
  assert.equal(insertedResponse.status, 201);
  assert.equal(insertedBody.product.title, "실제 페이지 제목");
  assert.equal(insertedBody.product.image_url, "https://img.coupang.com/123.jpg");
  assert.equal(insertedBody.product.sourcing_status, "needs_review");
  assert.equal(insertedBody.product.is_published, false);
  assert.equal(insertedBody.product.new_price, null);
  assert.equal(insertedBody.public_web_enrichment.status, "ok");
  assert.ok(insertedBody.public_web_enrichment.fields_filled.includes("title"));
  assert.ok(insertedBody.public_web_enrichment.fields_filled.includes("image_url"));
  assert.ok(fetchLog.includes("https://www.coupang.com/vp/products/123"), "the exact supplied product URL must be inspected");
  assert.ok(insertedBody.product.raw_json.public_web_inspection, "structured inspection provenance must be retained");
  assert.equal(JSON.stringify(insertedBody.product.raw_json).includes("판매가 999,000원"), false, "raw HTML must not be retained");

  const conflictResponse = await intakePost(intakeRequest("def456", "456", "다른 입력 상품"));
  const conflictBody = await conflictResponse.json();
  assert.equal(conflictResponse.status, 409);
  assert.equal(conflictBody.error, "EXISTING_PRODUCT_CONFLICT");
  assert.equal(conflictBody.reason, "EXISTING_TITLE_CATEGORY");

  const invalidMetadataResponse = await intakePost(intakeRequest("ghi789", "789", "관리자 입력 상품"));
  const invalidMetadataBody = await invalidMetadataResponse.json();
  assert.equal(invalidMetadataResponse.status, 201, JSON.stringify(invalidMetadataBody));
  assert.equal(invalidMetadataBody.product.title, "관리자 입력 상품");
  assert.equal(invalidMetadataBody.product.image_url, null);
  assert.equal(invalidMetadataBody.public_web_enrichment.fields_filled.includes("title"), false, "invalid page titles must not be reported as applied");
  assert.equal(invalidMetadataBody.public_web_enrichment.fields_filled.includes("image_url"), false, "rejected page images must not be reported as applied");
  assert.ok(invalidMetadataBody.public_web_enrichment.fields_filled.includes("source_price"));

  const manualImageResponse = await intakePost(intakeRequest("jkl790", "790", "수동 이미지 상품", { imageUrl: "https://img.coupang.com/manual.jpg" }));
  const manualImageBody = await manualImageResponse.json();
  assert.equal(manualImageResponse.status, 201);
  assert.equal(manualImageBody.product.image_url, "https://img.coupang.com/manual.jpg");
  assert.equal(manualImageBody.public_web_enrichment.fields_filled.includes("image_url"), false, "manual image precedence must not report a web image as applied");
} finally {
  globalThis.fetch = routeFetch;
  process.chdir(projectRoot);
  for (const key of routeEnvKeys) {
    if (routeEnv[key] === undefined) delete process.env[key];
    else process.env[key] = routeEnv[key];
  }
  fs.rmSync(routeTempDir, { recursive: true, force: true });
}

console.log("Public-web intake enrichment checks passed: opt-in, robots/allowlist gates, review-only persistence, bounded output, and bulk/UI propagation are present.");
