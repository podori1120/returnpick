import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { getRecentPricePosition } from "../lib/priceTrend.ts";

// Next's @/ aliases are not resolvable by Node's strip-types loader, so publicDeal is covered by source contracts here.
const publicDealSource = await readFile(new URL("../lib/publicDeal.ts", import.meta.url), "utf8");
const priceWatchBoardSource = await readFile(new URL("../components/PriceWatchBoard.tsx", import.meta.url), "utf8");
const compareBoardSource = await readFile(new URL("../components/CompareBoard.tsx", import.meta.url), "utf8");

function snapshot(id, observed_at, price) {
  return {
    id,
    product_id: "product-1",
    observed_at,
    source_price: price,
    return_price: null,
    new_price: null,
    naver_lowest_price: null,
    stock_count: 1,
    condition_grade: "최상",
    change_flags: [],
    raw_json: {}
  };
}

const now = new Date("2026-01-31T00:00:00.000Z");
const freshSnapshots = [
  snapshot("old", "2026-01-01T00:00:00.000Z", 800000),
  snapshot("low", "2026-01-10T00:00:00.000Z", 700000),
  snapshot("latest", "2026-01-20T00:00:00.000Z", 750000)
];
const freshPosition = getRecentPricePosition(freshSnapshots, 700000, "source_price", 30, now);
assert.equal(freshPosition.status, "lowest");
assert.equal(freshPosition.label, "최근 관찰 최저");
assert.equal(freshPosition.currentPrice, 700000);
assert.equal(freshPosition.lowestPrice, 700000);
assert.equal(freshPosition.averagePrice, 750000);
assert.equal(freshPosition.sampleCount, 3);

const oneComparable = getRecentPricePosition([snapshot("only", "2026-01-20T00:00:00.000Z", 750000)], 750000, "source_price", 30, now);
assert.equal(oneComparable.status, "unknown");
assert.match(oneComparable.description, /2회 이상/);

const staleFixtureContract = /freshness\.status !== "fresh"/;
assert.match(publicDealSource, staleFixtureContract);
assert.match(publicDealSource, /status: "unknown" as const/);
assert.match(publicDealSource, /price_timing:/);
assert.match(publicDealSource, /getProductPriceSource\(product\)/);
assert.match(publicDealSource, /getRecentPricePosition\(/);
assert.match(publicDealSource, /freshness\.status !== "fresh"/);
assert.match(publicDealSource, /가격 시점 확인필요/);
assert.match(publicDealSource, /마지막 가격 관찰이 오래되었거나 확인되지 않아/);
assert.match(publicDealSource, /current_price: publicPriceTiming\.currentPrice/);
assert.match(publicDealSource, /lowest_price: publicPriceTiming\.lowestPrice/);
assert.match(publicDealSource, /average_price: publicPriceTiming\.averagePrice/);
assert.match(publicDealSource, /sample_count: publicPriceTiming\.sampleCount/);
assert.match(priceWatchBoardSource, /product\.price_timing\.status/);
assert.match(priceWatchBoardSource, /동일 기준 관찰/);
assert.match(compareBoardSource, /product\.price_timing\.status/);
assert.match(compareBoardSource, /\["가격 시점"/);
assert.match(compareBoardSource, /status === "unknown" \? "확인필요"/);

console.log("public price timing: 4 checks passed");
