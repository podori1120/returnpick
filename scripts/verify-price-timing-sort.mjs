import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { getRecentPriceTimingRank } = await import("../lib/priceTrend.ts");

const position = (status, currentPrice = 100000) => ({ status, currentPrice });

assert.equal(getRecentPriceTimingRank(position("lowest"), true), 4);
assert.equal(getRecentPriceTimingRank(position("good"), true), 3);
assert.equal(getRecentPriceTimingRank(position("below_average"), true), 2);
assert.equal(getRecentPriceTimingRank(position("average_or_above"), true), 1);
assert.equal(getRecentPriceTimingRank(position("unknown"), true), 0);
assert.equal(getRecentPriceTimingRank(position("lowest"), false), 0);
assert.equal(getRecentPriceTimingRank(position("good", null), true), 0);

const pageSource = await readFile(new URL("../app/deals/page.tsx", import.meta.url), "utf8");
const trendSource = await readFile(new URL("../lib/priceTrend.ts", import.meta.url), "utf8");
assert.match(pageSource, /sort === "timing"/);
assert.match(pageSource, /value="timing">가격 시점 좋은 순/);
assert.match(pageSource, /sort: "timing"/);
assert.match(pageSource, /getRecentPriceTimingRank\(position, getDealFreshness\(product\)\.status === "fresh"\)/);
assert.match(trendSource, /if \(!isFresh \|\| position\.currentPrice == null\) return 0/);

console.log("price timing sort rules: 7 passed");
