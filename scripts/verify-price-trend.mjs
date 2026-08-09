import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { getProductPriceSource, getRecentPricePosition, summarizePriceTrend, summarizeRecentPriceWindow } = await import("../lib/priceTrend.ts");

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

const summary = summarizePriceTrend([
  snapshot("newest", "2026-01-03T00:00:00.000Z", 700000),
  snapshot("oldest", "2026-01-01T00:00:00.000Z", 750000),
  snapshot("middle", "2026-01-02T00:00:00.000Z", 680000),
  Object.assign(snapshot("reference-only", "2026-01-04T00:00:00.000Z", null), { naver_lowest_price: 650000 })
]);

assert.deepEqual(summary.points.map((point) => point.id), ["oldest", "middle", "newest"]);
assert.equal(summary.lowestPrice, 680000);
assert.equal(summary.earliestPrice, 750000);
assert.equal(summary.latestPrice, 700000);
assert.equal(summary.delta, -50000);
assert.equal(summary.trend, "down");
assert.equal(summarizePriceTrend([]).trend, "unknown");

const recent = summarizeRecentPriceWindow([
  snapshot("too-old", "2025-12-31T00:00:00.000Z", 600000),
  snapshot("window-start", "2026-01-01T00:00:00.000Z", 750000),
  snapshot("window-low", "2026-01-10T00:00:00.000Z", 680000),
  snapshot("window-latest", "2026-01-20T00:00:00.000Z", 700000),
  snapshot("future", "2026-02-01T00:00:00.000Z", 500000)
], 30, new Date("2026-01-31T00:00:00.000Z"));
assert.deepEqual(recent.points.map((point) => point.id), ["window-start", "window-low", "window-latest"]);
assert.equal(recent.lowestPrice, 680000);
assert.equal(recent.averagePrice, 710000);
assert.equal(recent.latestPrice, 700000);
assert.equal(recent.latestObservedAt, "2026-01-20T00:00:00.000Z");
assert.equal(summarizeRecentPriceWindow([], 30, new Date("2026-01-31T00:00:00.000Z")).points.length, 0);

const mixedSource = summarizePriceTrend([
  snapshot("source-price", "2026-01-01T00:00:00.000Z", 750000),
  Object.assign(snapshot("return-price", "2026-01-02T00:00:00.000Z", null), { return_price: 680000 })
]);
assert.equal(mixedSource.delta, null);
assert.equal(mixedSource.trend, "unknown");
assert.deepEqual(
  summarizeRecentPriceWindow([
    snapshot("source-window", "2026-01-10T00:00:00.000Z", 700000),
    Object.assign(snapshot("return-window", "2026-01-11T00:00:00.000Z", null), { return_price: 650000 })
  ], 30, new Date("2026-01-31T00:00:00.000Z"), "source_price").points.map((point) => point.id),
  ["source-window"]
);

const recentSameSource = [
  snapshot("position-old", "2026-01-01T00:00:00.000Z", 800000),
  snapshot("position-low", "2026-01-10T00:00:00.000Z", 700000),
  snapshot("position-latest", "2026-01-20T00:00:00.000Z", 750000)
];
assert.equal(getRecentPricePosition(recentSameSource, 700000, "source_price", 30, new Date("2026-01-31T00:00:00.000Z")).status, "lowest");
assert.equal(getRecentPricePosition(recentSameSource, 710000, "source_price", 30, new Date("2026-01-31T00:00:00.000Z")).status, "good");
assert.equal(getRecentPricePosition(recentSameSource, 740000, "source_price", 30, new Date("2026-01-31T00:00:00.000Z")).status, "below_average");
assert.equal(getRecentPricePosition(recentSameSource, 800000, "source_price", 30, new Date("2026-01-31T00:00:00.000Z")).status, "average_or_above");
assert.equal(getRecentPricePosition([
  snapshot("mixed-source", "2026-01-01T00:00:00.000Z", 750000),
  Object.assign(snapshot("mixed-return", "2026-01-02T00:00:00.000Z", null), { return_price: 680000 })
], 680000, "source_price", 30, new Date("2026-01-31T00:00:00.000Z")).status, "unknown");
assert.equal(getProductPriceSource({ return_price: 400000, source_price: 500000, new_price: 600000 }), "return_price");
assert.equal(getProductPriceSource({ return_price: null, source_price: 500000, new_price: 600000 }), "source_price");
assert.equal(getProductPriceSource({ return_price: null, source_price: null, new_price: null }), null);

const [dealCardSource, priceHistorySource, decisionPanelSource] = await Promise.all([
  readFile(new URL("../components/DealCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/PriceHistory.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/PurchaseDecisionPanel.tsx", import.meta.url), "utf8")
]);
assert.match(dealCardSource, /freshness\.status === "fresh" && pricePosition\.status !== "unknown"/);
assert.match(priceHistorySource, /currentIsFresh/);
assert.match(priceHistorySource, /기준 혼합 가능/);
assert.match(decisionPanelSource, /decision\.freshness\.status === "fresh"/);
assert.match(decisionPanelSource, /pricePositionPositive/);

console.log("price trend rules: 28 passed");
