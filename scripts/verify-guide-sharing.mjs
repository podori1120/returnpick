import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const packageJson = JSON.parse(read("package.json"));
const highValuePage = read("app/guide/high-value/page.tsx");
const searchGuidePage = read("app/guide/search/[slug]/page.tsx");
const shareComponent = read("components/GuideShareBar.tsx");
const eventRoute = read("app/api/events/route.ts");
const landingSource = read("lib/searchLandings.ts");

assert.equal(packageJson.scripts?.["guide-sharing:check"], "node scripts/verify-guide-sharing.mjs", "package.json must expose the guide-sharing contract check");
assert.match(highValuePage, /const highValueLandingSlugs = \[([\s\S]*?)\] as const;/, "high-value hub must keep an explicit curated slug list");
const slugBlock = highValuePage.match(/const highValueLandingSlugs = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
const slugs = [...slugBlock.matchAll(/"([a-z0-9-]+)"/g)].map((match) => match[1]);
assert.ok(slugs.length >= 18, "high-value hub must expose a broad but bounded set of existing product guides");
assert.equal(new Set(slugs).size, slugs.length, "high-value guide slugs must be unique");
for (const slug of slugs) {
  assert.match(landingSource, new RegExp(`slug: "${slug}"`), `high-value slug must resolve through searchLandings: ${slug}`);
}

assert.match(highValuePage, /GuideShareBar/);
assert.match(highValuePage, /sharePath="\/guide\/high-value"/);
assert.match(highValuePage, /context="high_value_guide"/);
assert.match(searchGuidePage, /GuideShareBar/);
assert.match(searchGuidePage, /context="search_guide"/);
assert.match(searchGuidePage, /`\/guide\/search\/\$\{landing\.slug\}`/);

assert.match(shareComponent, /navigator\.share/);
assert.match(shareComponent, /copyToClipboard/);
assert.match(shareComponent, /navigator\.clipboard/);
assert.match(shareComponent, /eventType: "share_copy"/);
assert.match(shareComponent, /utmSource: "guide_share"/);
assert.match(shareComponent, /web_high_value_guide_share/);
assert.match(shareComponent, /web_search_guide_share/);
assert.match(shareComponent, /sharePathPattern/);
assert.match(shareComponent, /url\.origin !== window\.location\.origin/);
assert.doesNotMatch(shareComponent, /https?:\/\//i, "share component must not embed an external destination");
assert.doesNotMatch(shareComponent, /link\.coupang\.com/i, "share component must not embed a direct affiliate URL");

assert.match(eventRoute, /context: "high_value_guide"/);
assert.match(eventRoute, /context: "search_guide"/);
assert.match(eventRoute, /pathnamePrefix: "\/guide\/search\/"/);
assert.match(eventRoute, /web_high_value_guide_share/);
assert.match(eventRoute, /web_search_guide_share/);
assert.match(eventRoute, /getSearchIntentLanding/);
assert.match(eventRoute, /matchesManualTrackingPath/);
assert.match(eventRoute, /return matchesManualTrackingPath\(surface, referrerUrl\.pathname\)/);
assert.doesNotMatch(eventRoute, /matchesManualTrackingPath\(surface, new URL\(request\.url\)\.pathname\)/, "manual event path must be validated from the same-origin referrer, not the /api/events endpoint path");
assert.match(eventRoute, /body\.event_type === "share_copy"/);
assert.match(eventRoute, /context: "editorial_pick"/);

console.log(`guide sharing contract passed: ${slugs.length} curated guides, same-origin share/copy allowlist, no direct affiliate destination`);
