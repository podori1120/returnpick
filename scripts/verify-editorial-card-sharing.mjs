import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const packageJson = JSON.parse(read("package.json"));
const card = read("components/ApprovalSampleCard.tsx");
const share = read("components/EditorialShareBar.tsx");
const route = read("app/api/events/route.ts");

assert.equal(packageJson.scripts?.["editorial-card-sharing:check"], "node scripts/verify-editorial-card-sharing.mjs", "package.json must expose the editorial card sharing check");
assert.match(card, /import EditorialShareBar from "@\/components\/EditorialShareBar"/);
assert.match(card, /import \{ getSiteUrl \} from "@\/lib\/siteUrl"/);
assert.match(card, /home: \{[\s\S]*?shareContext: "editorial_home_card"/);
assert.match(card, /deals: \{[\s\S]*?shareContext: "editorial_deals_card"/);
assert.match(card, /picks: \{[\s\S]*?shareContext: "editorial_picks_card"/);
assert.match(card, /<EditorialShareBar[\s\S]*?sharePath=\{approvalSampleProduct\.detailPath\}/);
assert.match(card, /canonicalUrl=\{`\$\{getSiteUrl\(\)\}\$\{approvalSampleProduct\.detailPath\}`\}/);

assert.match(share, /editorial_home_card/);
assert.match(share, /editorial_deals_card/);
assert.match(share, /editorial_picks_card/);
assert.match(share, /web_editorial_card_share_home/);
assert.match(share, /web_editorial_card_share_deals/);
assert.match(share, /web_editorial_card_share_picks/);
assert.match(share, /navigator\.share/);
assert.match(share, /navigator\.clipboard/);
assert.match(share, /url\.origin !== window\.location\.origin/);
assert.match(share, /novatech-s1-window-cleaner/);
assert.doesNotMatch(share, /https?:\/\/link\.coupang\.com/i, "share UI must not embed a direct affiliate destination");

assert.match(route, /context: "editorial_home_card"[\s\S]*?web_editorial_card_share_home/);
assert.match(route, /context: "editorial_deals_card"[\s\S]*?web_editorial_card_share_deals/);
assert.match(route, /context: "editorial_picks_card"[\s\S]*?web_editorial_card_share_picks/);
assert.match(route, /referrerUrl\.origin !== getPublicRequestOrigin\(request\)/);
assert.match(route, /return matchesManualTrackingPath\(surface, referrerUrl\.pathname\)/);
assert.match(route, /context: "editorial_pick"/);
assert.match(route, /shareCopyChannels: \["web_editorial_share"\]/);

console.log("editorial card sharing contract passed: three fixed card contexts, same-origin detail share URL, existing editorial share preserved");
