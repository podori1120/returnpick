import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [componentSource, dealCardSource, rankingRailSource, packageSource] = await Promise.all([
  readFile(new URL("../components/PriceTimingSignal.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/DealCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/DealRankingRail.tsx", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8")
]);

assert.match(componentSource, /export default function PriceTimingSignal/);
assert.match(componentSource, /data-price-timing-signal="true"/);
assert.match(componentSource, /freshness\.status !== "fresh"/);
assert.match(componentSource, /pricePosition\.currentPrice == null/);
assert.match(componentSource, /status === "lowest" \|\| status === "good"/);
assert.match(componentSource, /status === "unknown"/);
assert.match(componentSource, /icon: Info/);
assert.match(componentSource, /icon: Minus/);
assert.match(componentSource, /border-pine\/20 bg-pine\/5/);
assert.match(componentSource, /border-line bg-mist/);
assert.match(componentSource, /pricePosition\.label/);
assert.match(componentSource, /pricePosition\.description/);
assert.match(componentSource, /pricePosition\.currentPrice/);
assert.match(componentSource, /pricePosition\.averagePrice/);
assert.match(componentSource, /pricePosition\.lowestPrice/);
assert.match(componentSource, /pricePosition\.sampleCount/);
assert.match(componentSource, /ReturnPick 자체 최근 관찰 기준이며 시장 전체 최저가를 뜻하지 않습니다\./);
assert.doesNotMatch(componentSource, /Math\.|pricePosition\.(currentPrice|averagePrice|lowestPrice)\s*[+\-*\/]/);

for (const source of [dealCardSource, rankingRailSource]) {
  assert.match(source, /<PriceTimingSignal freshness=\{freshness\} pricePosition=\{pricePosition\} \/>/);
  assert.match(source, /getRecentPricePosition\(/);
  assert.match(source, /getProductPriceSource\(product\)/);
  assert.match(source, /snapshots \?\? product\.product_snapshots/);
  assert.match(source, /freshness/);
  assert.match(source, /AffiliateButton/);
  assert.match(source, /CompareButton/);
  assert.match(source, /SavedDealButton/);
  assert.ok(source.includes("href={`/deals/${product.id}`}"));
  assert.match(source, /href="\/disclosure"/);
}

assert.match(rankingRailSource, /freshness\.status === "fresh" && pricePosition\.currentPrice != null/);

const packageJson = JSON.parse(packageSource);
assert.equal(packageJson.scripts["price-timing-signal:check"], "node scripts/verify-price-timing-signal.mjs");

console.log("price timing signal: 40 checks passed");
