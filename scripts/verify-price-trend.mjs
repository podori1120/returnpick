import assert from "node:assert/strict";

const { summarizePriceTrend, summarizeRecentPriceWindow } = await import("../lib/priceTrend.ts");

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
assert.equal(recent.latestPrice, 700000);
assert.equal(recent.latestObservedAt, "2026-01-20T00:00:00.000Z");
assert.equal(summarizeRecentPriceWindow([], 30, new Date("2026-01-31T00:00:00.000Z")).points.length, 0);

const mixedSource = summarizePriceTrend([
  snapshot("source-price", "2026-01-01T00:00:00.000Z", 750000),
  Object.assign(snapshot("return-price", "2026-01-02T00:00:00.000Z", null), { return_price: 680000 })
]);
assert.equal(mixedSource.delta, null);
assert.equal(mixedSource.trend, "unknown");

console.log("price trend rules: 14 passed");
