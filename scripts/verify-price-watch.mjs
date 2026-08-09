import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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

const { evaluatePriceWatch, getPriceWatchItems, getPriceWatchPriceDelta, setPriceWatchItems } = await import("../lib/priceWatch.ts");

assert.equal(evaluatePriceWatch(700000, 700000), "hit");
assert.equal(evaluatePriceWatch(699000, 700000), "hit");
assert.equal(evaluatePriceWatch(701000, 700000), "above");
assert.equal(evaluatePriceWatch(null, 700000), "unknown");
assert.equal(evaluatePriceWatch(700000, null), "unknown");
assert.equal(evaluatePriceWatch(700000, 0), "unknown");
assert.equal(evaluatePriceWatch(0, 700000), "unknown");
assert.equal(getPriceWatchPriceDelta(690000, 700000), -10000);
assert.equal(getPriceWatchPriceDelta(710000, 700000), 10000);
assert.equal(getPriceWatchPriceDelta(null, 700000), null);

setPriceWatchItems([
  { productId: "product-a", title: "상품 A", targetPrice: 700000, baselinePrice: 750000, createdAt: "2026-01-01T00:00:00.000Z" },
  { productId: "product-a", title: "중복 상품 A", targetPrice: 1, createdAt: "2026-01-01T00:00:00.000Z" },
  { productId: "", title: "잘못된 상품", targetPrice: 1, createdAt: "2026-01-01T00:00:00.000Z" }
]);
assert.deepEqual(getPriceWatchItems().map((item) => item.productId), ["product-a"]);
assert.equal(getPriceWatchItems()[0].baselinePrice, 750000);

const boardSource = await readFile(new URL("../components/PriceWatchBoard.tsx", import.meta.url), "utf8");
const buttonSource = await readFile(new URL("../components/PriceWatchButton.tsx", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../app/watchlist/page.tsx", import.meta.url), "utf8");
const layoutSource = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
assert.match(boardSource, /\/api\/products\/compare\?ids=/);
assert.match(boardSource, /자동 문자·푸시·이메일 알림은 보내지 않으므로/);
assert.match(boardSource, /현재 공개 목록에서 다시 확인되지 않는 상품/);
assert.match(boardSource, /상품별 파트너스 링크가 확인되기 전에는 구매 버튼을 활성화하지 않습니다/);
assert.match(boardSource, /최신 확인가 다시 조회/);
assert.match(boardSource, /저장 당시 대비/);
assert.match(buttonSource, /baselinePrice: watch\?\.baselinePrice \?\? currentPrice/);
assert.match(pageSource, /robots: \{ index: false, follow: false \}/);
assert.match(layoutSource, /href="\/watchlist"[\s\S]*?가격 기준/);

console.log("price watch rules: 20 passed");
