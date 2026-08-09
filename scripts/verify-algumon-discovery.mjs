#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseAlgumonCoupangDiscovery, MAX_ALGUMON_DISCOVERY_RESULTS } from "../lib/providers/algumonDiscoveryParser.ts";

function deal({ id, store = "쿠팡", title = "테스트 상품", ad = false, ended = false, extra = "" }) {
  return `{id:${id},siteName:"뽐뿌",siteIconUrl:"https://cdn.example/icon.png",siteType:"PPOMPPU",storeName:"${store}",rankNum:null,title:"${title}",thumbnailUrl:"https://cdn.example/image.jpg",price:"19,000원",deliveryInfo:"무료",perPriceText:"",outboundUrl:"/n/d/${id}?secret=must-not-leak",originalLikes:0,createdAt:"2026-08-09T09:00:00+09:00",ended:${ended},isAd:${ad}${extra}}`;
}

const escapedTitle = String.raw`한정판 \"쿠팡\" 상품\\세트`;
const fixture = [
  "<html><body><script>",
  "deals:{contents:[",
  deal({ id: 101, title: escapedTitle }),
  deal({ id: 102, store: "G마켓" }),
  deal({ id: 103, ad: true }),
  deal({ id: 101, title: "중복 상품" }),
  deal({ id: "abc", title: "잘못된 아이디" }),
  `{id:104,storeName:"쿠팡",title:"${"x".repeat(8_100)}",ended:false,isAd:false}`,
  ...Array.from({ length: 12 }, (_, index) => deal({ id: 200 + index, title: `정상 상품 ${index}` })),
  "]}},",
  "</script></body></html>"
].join("");

const records = parseAlgumonCoupangDiscovery(fixture);
assert.equal(records.length, MAX_ALGUMON_DISCOVERY_RESULTS);
assert.equal(records[0].dealId, "101");
assert.equal(records[0].title, '한정판 "쿠팡" 상품\\세트');
assert.equal(records[0].storeName, "쿠팡");
assert.equal(records.filter((record) => record.dealId === "101").length, 1);
assert.equal(records.some((record) => record.dealId === "102" || record.dealId === "103" || record.dealId === "104"), false);
assert.equal(parseAlgumonCoupangDiscovery('{id:999,storeName:"쿠팡",title:"종료 상태 누락",isAd:false}').length, 0);

for (const record of records) {
  assert.deepEqual(Object.keys(record).sort(), [
    "dealId",
    "deliveryInfoText",
    "displayedPriceText",
    "siteName",
    "sourceCreatedAt",
    "storeName",
    "title"
  ]);
  assert.equal("outboundUrl" in record, false);
  assert.equal("thumbnailUrl" in record, false);
}

assert.deepEqual(parseAlgumonCoupangDiscovery("x".repeat(750_001)), []);

const root = process.cwd();
const parserSource = fs.readFileSync(path.join(root, "lib", "providers", "algumonDiscoveryParser.ts"), "utf8");
const providerSource = fs.readFileSync(path.join(root, "lib", "providers", "publicWebProvider.ts"), "utf8");
const sourcingSource = fs.readFileSync(path.join(root, "lib", "sourcing.ts"), "utf8");
const qualitySource = fs.readFileSync(path.join(root, "lib", "quality.ts"), "utf8");

assert.equal(parserSource.includes("eval("), false);
assert.equal(parserSource.includes("new Function"), false);
assert.equal(parserSource.includes("outboundUrl"), false);
assert.equal(parserSource.includes("thumbnailUrl"), false);
assert.match(providerSource, /source: "algumon_discovery"/);
assert.match(providerSource, /title: `\[알구몬 후보 #\$\{record\.dealId\}\]/);
assert.match(providerSource, /source_title: record\.title/);
assert.match(providerSource, /source_url: page\.toString\(\)/);
assert.match(providerSource, /url\.protocol === "https:"/);
assert.match(providerSource, /if \(isAlgumonHost\(base\)\)/);
assert.match(providerSource, /allowedHosts\.has\(base\.hostname\.toLowerCase\(\)\)/);
assert.match(providerSource, /return isAlgumonDealSearchPage\(base\) \? extractAlgumonDiscoveryCards/);
assert.match(providerSource, /outbound_not_fetched: true/);
assert.match(providerSource, /requires_manual_coupang_url: true/);
assert.match(providerSource, /product\.source === "algumon_discovery"/);
assert.match(sourcingSource, /ALGUMON_DISCOVERY_MANUAL_REVIEW/);
assert.match(sourcingSource, /if \(isAlgumonDiscoveryProduct\(product\)\) return "needs_review"/);
assert.match(sourcingSource, /saved\.sourcing_status === "rejected"/);
assert.match(sourcingSource, /is_published: discoveryOnly \? false : saved\.is_published/);
assert.match(qualitySource, /product\.source === "algumon_discovery"/);
assert.match(qualitySource, /새 수동 상품으로 등록해야 합니다/);

const detailSkip = providerSource.indexOf('if (product.source === "algumon_discovery")');
const detailFetch = providerSource.indexOf("const response = await fetchWithTimeout(normalizedUrl", detailSkip);
assert.ok(detailSkip >= 0 && detailFetch > detailSkip, "Algumon discovery must be skipped before any detail fetch");

console.log(`Algumon discovery checks passed: ${records.length} bounded review-only records, isolated candidate titles and publish blocker, no ads, duplicates, images, outbound paths, or automatic detail visits.`);
