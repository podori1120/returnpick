#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./public-web-test-loader.mjs", import.meta.url);
const { searchPublicWebProducts } = await import("../lib/providers/publicWebProvider.ts");

const root = resolve(import.meta.dirname, "..");
const provider = readFileSync(resolve(root, "lib/providers/publicWebProvider.ts"), "utf8");
const readme = readFileSync(resolve(root, "README.md"), "utf8");

const requiredProviderSignals = [
  "MAX_PUBLIC_WEB_DETAIL_PAGES = 3",
  "enrichProductDetails",
  "FETCHED_DETAIL",
  "detail_page_fetched_count",
  "readMetaContent",
  "readHtmlTitle",
  "web_return_info",
  "isLikelyProductCard",
  "product_without_return_evidence",
  "offerPrice == null",
  'stage: "detail"',
  'redirect: "manual"',
  "safeAllowlistedPublicUrl",
  "isPathAllowedByRobots",
  "waitForOriginRateLimit",
  "readTextWithLimit"
];

for (const signal of requiredProviderSignals) {
  if (!provider.includes(signal)) throw new Error(`missing provider detail-enrichment guard: ${signal}`);
}

for (const signal of ["collectJsonLdProducts", "application\\/ld\\+json", "readJsonLdOfferPrice", "json_ld:", "seenProductKeys"]) {
  if (!provider.includes(signal)) throw new Error(`missing structured public-web product signal: ${signal}`);
}

if (!readme.includes("검색 결과에서 발견한 allowlist 상품 링크 중 최대 3개의 상세 페이지")) {
  throw new Error("README does not document bounded public-web detail enrichment");
}

if (!readme.includes("candidate_kind=product_without_return_evidence") || !readme.includes("쿠팡 robots.txt")) {
  throw new Error("README does not document price/spec-only candidates and Coupang robots policy");
}

function mockHtmlResponse(body, headers = { "content-type": "text/html; charset=utf-8" }, status = 200) {
  return new Response(body, { status, headers });
}

const originalFetch = globalThis.fetch;
const originalEnv = {
  enabled: process.env.PUBLIC_WEB_CRAWL_ENABLED,
  hosts: process.env.PUBLIC_WEB_ALLOWED_HOSTS,
  templates: process.env.PUBLIC_WEB_SEARCH_TEMPLATES
};
const fetchCalls = [];

process.env.PUBLIC_WEB_CRAWL_ENABLED = "true";
process.env.PUBLIC_WEB_ALLOWED_HOSTS = "catalog.example.test";
process.env.PUBLIC_WEB_SEARCH_TEMPLATES = "https://catalog.example.test/search?q={keyword}";
globalThis.fetch = async (input) => {
  const url = String(input);
  fetchCalls.push(url);
  if (url === "https://catalog.example.test/robots.txt") {
    return mockHtmlResponse("User-agent: ReturnPickBot\nAllow: /\nUser-agent: *\nDisallow: /", { "content-type": "text/plain" });
  }
  if (url === "https://catalog.example.test/search?q=%EB%85%B8%ED%8A%B8%EB%B6%81") {
    return mockHtmlResponse(`
      <a href="/product/1001">LG 그램 노트북 16GB 512GB</a>
      <a href="/product/1002">QHD 모니터 27인치 144Hz</a>
      <a href="/product/1003">로보락 S8 로봇청소기</a>
      <a href="/article/20260803">2026 운영 안내 공지</a>
      <a href="/product/1004">LG 공기청정기</a>
      <script type="application/ld+json">
        {"@graph":[
          {"@type":"Product","name":"가격 없는 상품","url":"https://catalog.example.test/product/no-offer"},
          {"@type":"Product","name":"다이슨 무선청소기","url":"https://catalog.example.test/product/with-offer","offers":{"price":"299000","priceCurrency":"KRW"}}
        ]}
      </script>
    `);
  }
  if (url === "https://catalog.example.test/product/1001") return mockHtmlResponse("<title>LG 그램 16GB 512GB</title><p>사무용 노트북 상세 정보</p>");
  if (url === "https://catalog.example.test/product/1002") return mockHtmlResponse("<title>QHD 모니터 반품-최상</title><p>반품가 599,000원 재고 1개</p>");
  if (url === "https://catalog.example.test/product/1003") return mockHtmlResponse("<title>로보락 S8 로봇청소기</title><p>일반 상품 상세 정보</p>");
  if (url === "https://catalog.example.test/product/1004") throw new Error("detail page cap should prevent the fourth detail request");
  throw new Error(`unexpected catalog fetch: ${url}`);
};

try {
  const result = await searchPublicWebProducts("노트북", "laptop");
  assert.equal(result.status, "ok");
  assert.equal(result.products.length, 5);
  assert.equal(result.meta?.detail_page_fetched_count, 3);
  assert.equal(fetchCalls.filter((url) => /\/product\//.test(url)).length, 3);

  const noReturn = result.products.find((product) => product.source_product_id?.endsWith("/1001"));
  assert.ok(noReturn);
  assert.equal(noReturn.condition_grade, "확인필요");
  assert.equal(noReturn.return_price, null);
  assert.equal(noReturn.raw_json?.candidate_kind, "product_without_return_evidence");

  const detailUpgrade = result.products.find((product) => product.source_product_id?.endsWith("/1002"));
  assert.ok(detailUpgrade);
  assert.equal(detailUpgrade.condition_grade, "최상");
  assert.equal(detailUpgrade.return_price, 599000);
  assert.equal(detailUpgrade.raw_json?.web_return_info?.detail_page?.return_price, 599000);

  const jsonLdNoOffer = result.products.find((product) => product.source_product_id?.endsWith("/no-offer"));
  assert.equal(jsonLdNoOffer, undefined);
  const jsonLdOffer = result.products.find((product) => product.source_product_id?.endsWith("/with-offer"));
  assert.ok(jsonLdOffer);
  assert.equal(jsonLdOffer.new_price, 299000);
  assert.equal(jsonLdOffer.return_price, null);
} finally {
  globalThis.fetch = originalFetch;
  if (originalEnv.enabled === undefined) delete process.env.PUBLIC_WEB_CRAWL_ENABLED;
  else process.env.PUBLIC_WEB_CRAWL_ENABLED = originalEnv.enabled;
  if (originalEnv.hosts === undefined) delete process.env.PUBLIC_WEB_ALLOWED_HOSTS;
  else process.env.PUBLIC_WEB_ALLOWED_HOSTS = originalEnv.hosts;
  if (originalEnv.templates === undefined) delete process.env.PUBLIC_WEB_SEARCH_TEMPLATES;
  else process.env.PUBLIC_WEB_SEARCH_TEMPLATES = originalEnv.templates;
}

async function assertProviderStatus(host, expectedStatus, responseFactory) {
  process.env.PUBLIC_WEB_CRAWL_ENABLED = "true";
  process.env.PUBLIC_WEB_ALLOWED_HOSTS = host;
  process.env.PUBLIC_WEB_SEARCH_TEMPLATES = `https://${host}/search?q={keyword}`;
  globalThis.fetch = responseFactory;
  const result = await searchPublicWebProducts("노트북", "laptop");
  assert.equal(result.status, expectedStatus);
  assert.equal(result.products.length, 0);
}

await assertProviderStatus("blocked.example.test", "ROBOTS_DISALLOWED", async (input) => {
  const url = String(input);
  if (url.endsWith("/robots.txt")) return mockHtmlResponse("User-agent: ReturnPickBot\nDisallow: /", { "content-type": "text/plain" });
  throw new Error(`blocked host should not fetch search page: ${url}`);
});

await assertProviderStatus("redirect.example.test", "REDIRECT_BLOCKED", async (input) => {
  const url = String(input);
  if (url.endsWith("/robots.txt")) return mockHtmlResponse("User-agent: ReturnPickBot\nAllow: /", { "content-type": "text/plain" });
  return mockHtmlResponse("", { location: "https://redirect.example.test/elsewhere" }, 302);
});

await assertProviderStatus("large.example.test", "CONTENT_TOO_LARGE", async (input) => {
  const url = String(input);
  if (url.endsWith("/robots.txt")) return mockHtmlResponse("User-agent: ReturnPickBot\nAllow: /", { "content-type": "text/plain" });
  return mockHtmlResponse("too large", { "content-type": "text/html", "content-length": "800000" });
});

console.log("Public web detail enrichment checks passed: behavioral candidate extraction, structured price gates, bounded detail pages, robots/allowlist guards, redirect blocking, size limits, and evidence metadata.");
