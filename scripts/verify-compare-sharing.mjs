#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const results = [];

function readText(file) {
  try {
    return readFileSync(path.join(root, file), "utf8");
  } catch {
    return "";
  }
}

function includesAll(text, fragments) {
  return fragments.every((fragment) => text.includes(fragment));
}

function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail });
}

const compareBoard = readText("components/CompareBoard.tsx");
const compareRoute = readText("app/api/products/compare/route.ts");
const eventRoute = readText("app/api/events/route.ts");
const packageText = readText("package.json");
let packageJson = {};
try {
  packageJson = JSON.parse(packageText);
} catch {
  packageJson = {};
}

const shareBlockStart = compareBoard.indexOf("function buildShareUrl");
const shareBlockEnd = compareBoard.indexOf("if (loading)", shareBlockStart);
const shareBlock = shareBlockStart >= 0 && shareBlockEnd > shareBlockStart ? compareBoard.slice(shareBlockStart, shareBlockEnd) : "";

check(
  "compare URL ids parsing",
  includesAll(compareBoard, [
    "new URL(window.location.href)",
    "searchParams.get(\"ids\")",
    ".split(\",\")",
    "uuidPattern.test(id)",
    ".slice(0, maxCompareItems)",
    "mergeCompareItems(sharedItems, readCompareItems())"
  ]),
  "shared ids are parsed in an effect, restricted to UUIDs, capped at 12, and merged ahead of local storage"
);

check(
  "compare share URL",
  includesAll(shareBlock, [
    "new URL(\"/compare\", window.location.origin)",
    "searchParams.set(\"ids\", shareableProductIds.join(\",\"))",
    "return shareUrl.toString()"
  ]),
  "the share target is a same-origin /compare URL containing public product ids"
);

check(
  "share and clipboard fallback",
  includesAll(shareBlock, [
    "typeof navigator.share === \"function\"",
    "navigator.share({",
    "navigator.clipboard?.writeText",
    "navigator.clipboard.writeText(shareUrl)"
  ]) && compareBoard.includes("role=\"status\""),
  "Web Share is preferred and clipboard writeText is used when it is unavailable"
);

check(
  "share tracking contract",
  includesAll(compareBoard, [
    "trackAffiliateEvent({ eventType: \"share_copy\", channel: \"web_compare\", context: \"compare_share\" })",
    "비교 링크를 복사했습니다.",
    "공유에 실패했습니다.",
    "shareError.name === \"AbortError\""
  ]),
  "successful share/copy is tracked and status feedback distinguishes failure from cancellation"
);

check(
  "share query excludes affiliate data",
  shareBlock.includes("searchParams.set(\"ids\", shareableProductIds.join(\",\"))") &&
    !shareBlock.includes("searchParams.set(\"affiliate_url\"") &&
    !shareBlock.includes("searchParams.set(\"title\""),
  "the query string is populated only with product UUIDs, never affiliate URLs or product titles"
);

check(
  "public compare API gate",
  includesAll(compareRoute, [
    "listProducts({ published: true })",
    "function isPublicCompareProduct(product: ProductWithScore)",
    "!isDemoProduct(product)",
    "isPublicDealReady(product)",
    "getDealFreshness(product).status !== \"stale\"",
    ".filter((product) => isPublicCompareProduct(product) && idSet.has(product.id))",
    "const maxCompareItems = 12"
  ]),
  "published, non-demo, public-ready, and non-stale filtering remains enforced by the compare API"
);

check(
  "server share tracking contract",
  includesAll(eventRoute, [
    'context: "compare_share"',
    'pathname: "/compare"',
    'shareCopyChannels: ["web_compare"]',
    'const isCompareShare = surface.context === "compare_share" && body.event_type === "share_copy"',
    "if (!isCompareShare && !isCoupangPartnersLink(process.env.NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL)) return false;",
    "referrerUrl.pathname === surface.pathname"
  ]),
  "share_copy is accepted only from the same-origin /compare surface and does not depend on the approval sample link"
);

check(
  "package script",
  packageJson?.scripts?.["compare:check"] === "node scripts/verify-compare-sharing.mjs",
  "npm run compare:check points to this static contract check"
);

console.log("ReturnPick compare sharing contract check");
console.log("=".repeat(48));
for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name} - ${result.detail}`);
}
console.log("=".repeat(48));
const failures = results.filter((result) => !result.ok);
console.log(`summary: ${results.length - failures.length} pass, ${failures.length} fail`);
if (failures.length) process.exitCode = 1;
