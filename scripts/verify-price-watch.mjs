import assert from "node:assert/strict";

globalThis.window = {
  localStorage: {
    values: new Map(),
    getItem(key) {
      return this.values.get(key) ?? null;
    },
    setItem(key, value) {
      this.values.set(key, value);
    }
  },
  dispatchEvent() {}
};

const { evaluatePriceWatch, getPriceWatchItems, setPriceWatchItems } = await import("../lib/priceWatch.ts");

assert.equal(evaluatePriceWatch(700000, 700000), "hit");
assert.equal(evaluatePriceWatch(699000, 700000), "hit");
assert.equal(evaluatePriceWatch(701000, 700000), "above");
assert.equal(evaluatePriceWatch(null, 700000), "unknown");
assert.equal(evaluatePriceWatch(700000, null), "unknown");
assert.equal(evaluatePriceWatch(700000, 0), "unknown");
assert.equal(evaluatePriceWatch(0, 700000), "unknown");

setPriceWatchItems([
  { productId: "product-a", title: "상품 A", targetPrice: 700000, createdAt: "2026-01-01T00:00:00.000Z" },
  { productId: "product-a", title: "중복 상품 A", targetPrice: 1, createdAt: "2026-01-01T00:00:00.000Z" },
  { productId: "", title: "잘못된 상품", targetPrice: 1, createdAt: "2026-01-01T00:00:00.000Z" }
]);
assert.deepEqual(getPriceWatchItems().map((item) => item.productId), ["product-a"]);

console.log("price watch rules: 8 passed");
