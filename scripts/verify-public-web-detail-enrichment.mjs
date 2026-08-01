#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

console.log("Public web detail enrichment checks passed: bounded detail pages, robots/allowlist guards, redirect blocking, and evidence metadata.");
