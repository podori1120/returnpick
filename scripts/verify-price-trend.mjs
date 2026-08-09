import assert from "node:assert/strict";

const { summarizePriceTrend } = await import("../lib/priceTrend.ts");

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

const mixedSource = summarizePriceTrend([
  snapshot("source-price", "2026-01-01T00:00:00.000Z", 750000),
  Object.assign(snapshot("return-price", "2026-01-02T00:00:00.000Z", null), { return_price: 680000 })
]);
assert.equal(mixedSource.delta, null);
assert.equal(mixedSource.trend, "unknown");

console.log("price trend rules: 9 passed");
