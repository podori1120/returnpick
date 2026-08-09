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

const { evaluatePriceWatch, getPriceWatchItems, getPriceWatchNotificationKey, getPriceWatchNotificationKeys, getPriceWatchPriceDelta, hasPriceWatchNotificationBeenSent, markPriceWatchNotificationSent, setPriceWatchItems } = await import("../lib/priceWatch.ts");

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
assert.equal(getPriceWatchNotificationKey({ productId: "product-a", targetPrice: 700000 }, 690000), "product-a:700000:690000");
assert.equal(getPriceWatchNotificationKey({ productId: "product-a", targetPrice: 700000 }, null), null);
assert.equal(hasPriceWatchNotificationBeenSent("product-a:700000:690000"), false);
markPriceWatchNotificationSent("product-a:700000:690000");
assert.equal(hasPriceWatchNotificationBeenSent("product-a:700000:690000"), true);
assert.deepEqual(getPriceWatchNotificationKeys(), ["product-a:700000:690000"]);
for (let index = 0; index < 60; index += 1) {
  markPriceWatchNotificationSent(`product-${index}:700000:690000`);
}
assert.equal(hasPriceWatchNotificationBeenSent("product-a:700000:690000"), true);

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
assert.match(boardSource, /문자·이메일 없이/);
assert.match(boardSource, /브라우저 알림 켜기/);
assert.match(boardSource, /new window\.Notification/);
assert.match(boardSource, /getPriceWatchNotificationKey/);
assert.match(boardSource, /목표가 도달한 상품/);
assert.match(boardSource, /현재 공개 목록에서 다시 확인되지 않는 상품/);
assert.match(boardSource, /상품별 파트너스 링크가 확인되기 전에는 구매 버튼을 활성화하지 않습니다/);
assert.match(boardSource, /최신 확인가 다시 조회/);
assert.match(boardSource, /저장 당시 대비/);
assert.match(buttonSource, /baselinePrice: watch\?\.baselinePrice \?\? currentPrice/);
assert.match(buttonSource, /목표가 도달 브라우저 알림은 가격 기준함에서 직접 허용한 경우에만/);
assert.match(pageSource, /robots: \{ index: false, follow: false \}/);
assert.match(layoutSource, /href="\/watchlist"[\s\S]*?가격 기준/);

console.log("price watch rules: 27 passed");
