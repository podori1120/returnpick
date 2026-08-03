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
  "extractListedPriceCandidatesFromText",
  "extractListedPriceFromText",
  "stripSecondaryDetailSections",
  "rawTextTagNames",
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

for (const signal of ["collectJsonLdProducts", "jsonLdMimeType", "readJsonLdOfferPrice", "json_ld:", "seenProductKeys"]) {
  if (!provider.includes(signal)) throw new Error(`missing structured public-web product signal: ${signal}`);
}

if (!provider.includes("application/ld+json")) throw new Error("missing JSON-LD MIME type guard");

if (!provider.includes("extractVisibleJsonLdBlocks")) throw new Error("missing visible JSON-LD suppression guard");

if (!readme.includes("검색 결과에서 발견한 allowlist 상품 링크 중 최대 3개의 상세 페이지")) {
  throw new Error("README does not document bounded public-web detail enrichment");
}

if (!readme.includes("candidate_kind=product_without_return_evidence") || !readme.includes("쿠팡 robots.txt") || !readme.includes("서로 다른 라벨 가격이 여러 개")) {
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
    const rawOverCapCard = `<a href="/product/raw-over-cap">LG 그램 노트북 16GB 판매가 88,000원<!-- 가짜 </a> --><template><script>${"z".repeat(200)} 가짜 </template> ${"q".repeat(1300)}</script></template><script>${"x".repeat(1600)} 가짜 </a></script></a>`;
    const duplicateOverCapCard = `<a href="/return-policy">LG 공기청정기 20L 판매가 86,000원<script>${"y".repeat(1600)}</script></a>`;
    const duplicateShortCard = '<a href="/return-policy">LG 공기청정기 20L A급 판매가 87,000원 https://catalog.example.test/return-policy //catalog.example.test/return-policy catalog.example.test/return-policy mailto:returns@example.test /return-policy</a>';
    return mockHtmlResponse(`
      <a href="/product/1001">LG 그램 노트북 16GB 512GB 판매가 1,099,000원 <div hidden><div>숨김 가격</div>판매가 99,000원</div><span style=display:none>판매가 88,000원</span><span style=visibility:hidden>판매가 87,000원</span><script><script>판매가 86,000원</script>판매가 85,000원</script></a>
      <a href="/product/1002">QHD 모니터 27인치 144Hz 판매가 990,000원 쿠폰 적용 배송비 3,000원</a>
      <a href="/product/1003">로보락 S8 로봇청소기 판매가 950,000원</a>
      <a href="/product/1005" hidden>LG 그램 노트북 판매가 99,000원</a>
      <a href="/product/1006" title=">" hidden>LG 그램 노트북 판매가 98,000원</a>
      <div hidden><a href="/product/1007">LG 그램 노트북 판매가 97,000원</a></div>
      <!-- <a href="/product/1008">LG 그램 노트북 판매가 96,000원</a> -->
      <script><a href="/product/1009">LG 그램 노트북 판매가 95,000원</a></script>
      <style><a href="/product/1010">LG 그램 노트북 판매가 94,000원</a></style>
      <noscript><a href="/product/1011">LG 그램 노트북 판매가 93,000원</a></noscript>
      <a href="/product/1012" title='href="/product/9999"'>LG 그램 노트북 판매가 92,000원</a>
      <a href="/product/1013" title="x > 판매가 91,000원">LG 그램 노트북 16GB 512GB</a>
      <a href="/product/1014">install refurbished repackaging coupon additional-cost LG 그램 노트북 16GB 판매가 90,000원 additional-cost repackaging install</a>
      <div title="<a href='/product/phantom'>Laptop 16GB 판매가 990,000원</a>"></div>
      <div hidden><script type="application/ld+json">{"@type":"Product","name":"숨김 JSON 상품","url":"https://catalog.example.test/product/hidden-jsonld","offers":{"price":"990000","priceCurrency":"KRW"}}</script></div>
      <script type="application/ld+json" hidden>{"@type":"Product","name":"숨김 script 상품","url":"https://catalog.example.test/product/hidden-script-jsonld","offers":{"price":"980000","priceCurrency":"KRW"}}</script>
      <!-- <script type="application/ld+json">{"@type":"Product","name":"주석 JSON 상품","url":"https://catalog.example.test/product/comment-jsonld","offers":{"price":"970000","priceCurrency":"KRW"}}</script> -->
      <div title="<script type='application/ld+json'>{&quot;@type&quot;:&quot;Product&quot;,&quot;name&quot;:&quot;속성 JSON 상품&quot;}</script>"></div>
      <template><a href="/product/template-card">LG 그램 노트북 판매가 96,000원</a><script type="application/ld+json">{"@type":"Product","name":"템플릿 JSON 상품","url":"https://catalog.example.test/product/template-jsonld","offers":{"price":"960000","priceCurrency":"KRW"}}</script></template>
      ${rawOverCapCard}
      ${duplicateOverCapCard}
      ${duplicateShortCard}
      <a href="/article/20260803">2026 운영 안내 공지</a>
      <a href="/return-policy">LG 공기청정기 20L</a>
      <script type="application/ld+json">
        {"@graph":[
          {"@type":"Product","name":"가격 없는 상품","url":"https://catalog.example.test/product/no-offer"},
          {"@type":"Product","name":"다이슨 무선청소기","url":"https://catalog.example.test/product/returned-item","description":"https://catalog.example.test/return-policy //catalog.example.test/return-policy catalog.example.test/return-policy mailto:returns@example.test /return-policy A급","offers":{"price":"299000","priceCurrency":"KRW"}}
        ]}
      </script>
    `);
  }
  if (url === "https://catalog.example.test/product/1001") return mockHtmlResponse("<title>LG 그램 16GB 512GB</title><p>사무용 노트북 상세 정보 판매가 999,000원</p>");
  if (url === "https://catalog.example.test/product/1002") return mockHtmlResponse("<title>QHD 모니터 반품-최상</title><p>반품가 599,000원 재고 1개</p>");
  if (url === "https://catalog.example.test/product/1003") return mockHtmlResponse(`<title>로보락 S8 로봇청소기</title><div style=display:none><div>숨김 가격</div>판매가 99,000원</div><div style="visibility:hidden">판매가 88,000원</div><div title=">" hidden>판매가 87,000원</div><template><p>판매가 86,000원 A급 like new</p><script type="application/ld+json">{"@type":"Product","name":"템플릿 상세 JSON","offers":{"price":"850000"}}</script></template><script><script>판매가 84,000원</script>판매가 83,000원</script><style><style>판매가 82,000원</style>판매가 81,000원</style><noscript><noscript>판매가 80,000원</noscript>판매가 79,000원</noscript><aside>추천 마우스 반품 A급 반품가 19,900원 판매가 19,900원</aside><div>${"설명 ".repeat(40)}</div><p>일반 상품 상세 정보 정가 899,000원 할인가 880,000원 A급 like new https://catalog.example.test/return-policy //catalog.example.test/return-policy catalog.example.test/return-policy mailto:returns@example.test /return-policy</p><script>const marker = "<template>";</script><div hidden/>판매가 78,000원<div class="recommend"/>반품-최상 반품가 111,000원 재고 1개`);
  if (url === "https://catalog.example.test/product/1004") throw new Error("detail page cap should prevent the fourth detail request");
  throw new Error(`unexpected catalog fetch: ${url}`);
};

try {
  const result = await searchPublicWebProducts("노트북", "laptop");
  assert.equal(result.status, "ok");
  assert.equal(result.products.length, 8);
  assert.equal(result.meta?.detail_page_fetched_count, 3);
  assert.equal(fetchCalls.filter((url) => /\/product\//.test(url)).length, 3);

  const noReturn = result.products.find((product) => product.source_product_id?.endsWith("/1001"));
  assert.ok(noReturn);
  assert.equal(noReturn.condition_grade, "확인필요");
  assert.equal(noReturn.source_price, 1099000);
  assert.equal(noReturn.new_price, null);
  assert.equal(noReturn.return_price, null);
  assert.equal(noReturn.raw_json?.candidate_kind, "product_without_return_evidence");
  assert.equal(noReturn.raw_json?.price_analysis?.listed_price, 1099000);
  assert.equal(noReturn.raw_json?.web_return_info?.detail_page?.listed_price, 999000);

  const detailUpgrade = result.products.find((product) => product.source_product_id?.endsWith("/1002"));
  assert.ok(detailUpgrade);
  assert.equal(detailUpgrade.condition_grade, "최상");
  assert.equal(detailUpgrade.return_price, 599000);
  assert.equal(detailUpgrade.source_price, null);
  assert.equal(detailUpgrade.raw_json?.price_analysis?.listed_price, null);
  assert.equal(detailUpgrade.raw_json?.web_return_info?.detail_page?.return_price, 599000);

  const detailListedPrice = result.products.find((product) => product.source_product_id?.endsWith("/1003"));
  assert.ok(detailListedPrice);
  assert.equal(detailListedPrice.source_price, 950000);
  assert.equal(detailListedPrice.new_price, null);
  assert.equal(detailListedPrice.return_price, null);
  assert.equal(detailListedPrice.condition_grade, "확인필요");
  assert.equal(detailListedPrice.raw_json?.price_analysis?.listed_price, 950000);
  assert.equal(detailListedPrice.raw_json?.web_return_info?.detail_page?.is_return_candidate, false);
  assert.equal(detailListedPrice.raw_json?.web_return_info?.detail_page?.listed_price, null);
  assert.deepEqual(detailListedPrice.raw_json?.web_return_info?.detail_page?.listed_price_candidates, [899000, 880000]);
  assert.equal(
    detailListedPrice.raw_json?.web_return_info?.detail_page?.listed_price_source,
    "ambiguous_multiple_labeled_prices"
  );

  const hiddenAnchor = result.products.find((product) => product.source_product_id?.endsWith("/1005"));
  assert.equal(hiddenAnchor, undefined);
  const quotedHiddenAnchor = result.products.find((product) => product.source_product_id?.endsWith("/1006"));
  assert.equal(quotedHiddenAnchor, undefined);
  for (const hiddenId of ["1007", "1008", "1009", "1010", "1011"]) {
    assert.equal(result.products.find((product) => product.source_product_id?.endsWith(`/${hiddenId}`)), undefined);
  }
  const attributeLikeHref = result.products.find((product) => product.source_product_id?.endsWith("/1012"));
  assert.ok(attributeLikeHref);
  assert.equal(attributeLikeHref.source_product_id?.endsWith("/9999"), false);
  const attributePrice = result.products.find((product) => product.source_product_id?.endsWith("/1013"));
  assert.ok(attributePrice);
  assert.equal(attributePrice.source_price, null);
  const englishContext = result.products.find((product) => product.source_product_id?.endsWith("/1014"));
  assert.ok(englishContext);
  assert.equal(englishContext.source_price, null);
  assert.equal(result.products.find((product) => product.source_product_id?.endsWith("/phantom")), undefined);
  assert.equal(result.products.find((product) => product.source_product_id?.endsWith("/raw-over-cap")), undefined);
  const urlOnlyReturnSignal = result.products.find((product) => product.source_product_id?.endsWith("/return-policy"));
  assert.ok(urlOnlyReturnSignal);
  assert.equal(urlOnlyReturnSignal.raw_json?.candidate_kind, "product_without_return_evidence");
  assert.equal(urlOnlyReturnSignal.source_price, 87000);
  assert.equal(urlOnlyReturnSignal.condition_grade, "확인필요");
  for (const hiddenJsonLdId of ["hidden-jsonld", "hidden-script-jsonld", "comment-jsonld"]) {
    assert.equal(result.products.find((product) => product.source_product_id?.endsWith(`/${hiddenJsonLdId}`)), undefined);
  }
  for (const hiddenTemplateId of ["template-card", "template-jsonld"]) {
    assert.equal(result.products.find((product) => product.source_product_id?.endsWith(`/${hiddenTemplateId}`)), undefined);
  }

  const returnPriceOnly = result.products.find((product) => product.source_product_id?.endsWith("/1002"));
  assert.ok(returnPriceOnly);
  assert.equal(returnPriceOnly.raw_json?.price_analysis?.listed_price, null);

  const jsonLdNoOffer = result.products.find((product) => product.source_product_id?.endsWith("/no-offer"));
  assert.equal(jsonLdNoOffer, undefined);
  const jsonLdOffer = result.products.find((product) => product.source_product_id?.endsWith("/returned-item"));
  assert.ok(jsonLdOffer);
  assert.equal(jsonLdOffer.source_price, 299000);
  assert.equal(jsonLdOffer.new_price, null);
  assert.equal(jsonLdOffer.return_price, null);
  assert.equal(jsonLdOffer.condition_grade, "확인필요");
  assert.equal(jsonLdOffer.raw_json?.candidate_kind, "product_without_return_evidence");
} finally {
  globalThis.fetch = originalFetch;
  if (originalEnv.enabled === undefined) delete process.env.PUBLIC_WEB_CRAWL_ENABLED;
  else process.env.PUBLIC_WEB_CRAWL_ENABLED = originalEnv.enabled;
  if (originalEnv.hosts === undefined) delete process.env.PUBLIC_WEB_ALLOWED_HOSTS;
  else process.env.PUBLIC_WEB_ALLOWED_HOSTS = originalEnv.hosts;
  if (originalEnv.templates === undefined) delete process.env.PUBLIC_WEB_SEARCH_TEMPLATES;
  else process.env.PUBLIC_WEB_SEARCH_TEMPLATES = originalEnv.templates;
}

process.env.PUBLIC_WEB_CRAWL_ENABLED = "true";
process.env.PUBLIC_WEB_ALLOWED_HOSTS = "raw-text.example.test";
process.env.PUBLIC_WEB_SEARCH_TEMPLATES = "https://raw-text.example.test/search?q={keyword}";
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.endsWith("/robots.txt")) return mockHtmlResponse("User-agent: ReturnPickBot\nAllow: /", { "content-type": "text/plain" });
  if (url.includes("/search?q=")) return mockHtmlResponse('<a href="/product/raw-text">노트북 판매가 890,000원<script>const marker = "<template>";</script></a>');
  return mockHtmlResponse(`<script>const marker = "<template>";</script><p>반품-최상 반품가 777,000원 재고 2개</p><div>${"설명 ".repeat(40)}</div><p>새상품 판매가 999,000원</p>`);
};
const rawTextResult = await searchPublicWebProducts("노트북", "laptop");
assert.equal(rawTextResult.status, "ok");
assert.equal(rawTextResult.products.length, 1);
assert.equal(rawTextResult.products[0]?.source_product_id?.endsWith("/raw-text"), true);
assert.equal(rawTextResult.products[0]?.source_price, 890000);
assert.equal(rawTextResult.products[0]?.return_price, 777000);
assert.equal(rawTextResult.products[0]?.condition_grade, "최상");
assert.equal(rawTextResult.products[0]?.stock_count, 2);
assert.equal(rawTextResult.products[0]?.raw_json?.web_return_info?.detail_page?.return_price, 777000);
assert.equal(rawTextResult.products[0]?.raw_json?.web_return_info?.detail_page?.listed_price, 999000);

process.env.PUBLIC_WEB_CRAWL_ENABLED = "true";
process.env.PUBLIC_WEB_ALLOWED_HOSTS = "recommendation-price.example.test";
process.env.PUBLIC_WEB_SEARCH_TEMPLATES = "https://recommendation-price.example.test/search?q={keyword}";
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.endsWith("/robots.txt")) return mockHtmlResponse("User-agent: ReturnPickBot\nAllow: /", { "content-type": "text/plain" });
  if (url.includes("/search?q=")) return mockHtmlResponse('<a href="/product/recommendation-price">노트북 16GB 모델</a>');
  return mockHtmlResponse(`<section><h2>상품 상세</h2><p>노트북 16GB 모델 반품-최상 반품가 742,000원</p><p>${"설명 ".repeat(40)}</p><p>판매가 999,000원</p><div><h2>추천 상품</h2><p>추천 키보드 반품-최상 반품가 19,900원 판매가 18,900원</p></div></section><aside><p>추천 마우스 판매가 19,900원</p></aside><section><h2>추천 상품</h2><p>추천 모니터 판매가 18,900원</p></section>`);
};
const recommendationPriceResult = await searchPublicWebProducts("노트북", "laptop");
assert.equal(recommendationPriceResult.status, "ok");
assert.equal(recommendationPriceResult.products.length, 1);
assert.equal(recommendationPriceResult.products[0]?.source_price, 999000);
assert.equal(recommendationPriceResult.products[0]?.return_price, 742000);
assert.equal(recommendationPriceResult.products[0]?.condition_grade, "최상");
assert.equal(recommendationPriceResult.products[0]?.raw_json?.web_return_info?.detail_page?.listed_price, 999000);
assert.equal(recommendationPriceResult.products[0]?.raw_json?.web_return_info?.detail_page?.return_price, 742000);
assert.equal(recommendationPriceResult.products[0]?.raw_json?.web_return_info?.detail_page?.is_return_candidate, true);
assert.deepEqual(recommendationPriceResult.products[0]?.raw_json?.web_return_info?.detail_page?.listed_price_candidates, [999000]);
const malformedDetailMarkup = `${"<div>".repeat(100000)}<p>노트북 판매가 890,000원</p>`;
process.env.PUBLIC_WEB_CRAWL_ENABLED = "true";
process.env.PUBLIC_WEB_ALLOWED_HOSTS = "malformed-detail.example.test";
process.env.PUBLIC_WEB_SEARCH_TEMPLATES = "https://malformed-detail.example.test/search?q={keyword}";
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.endsWith("/robots.txt")) return mockHtmlResponse("User-agent: ReturnPickBot\nAllow: /", { "content-type": "text/plain" });
  if (url.includes("/search?q=")) return mockHtmlResponse('<a href="/product/malformed-detail">노트북 판매가 890,000원</a>');
  return mockHtmlResponse(malformedDetailMarkup);
};
const malformedStartedAt = performance.now();
const malformedResult = await searchPublicWebProducts("노트북", "laptop");
const malformedElapsedMs = performance.now() - malformedStartedAt;
assert.equal(malformedResult.status, "ok");
assert.equal(malformedResult.products.length, 1);
assert.ok(malformedElapsedMs < 5000, `malformed detail parsing took ${Math.round(malformedElapsedMs)}ms`);

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

console.log("Public web detail enrichment checks passed: behavioral candidate extraction, structured price gates, bounded detail pages, malformed HTML work bounds, robots/allowlist guards, redirect blocking, size limits, and evidence metadata.");
