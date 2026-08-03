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
const comparePicker = readText("components/CompareProductPicker.tsx");
const compareButton = readText("components/CompareButton.tsx");
const compareRoute = readText("app/api/products/compare/route.ts");
const searchSuggestionsRoute = readText("app/api/products/search-suggestions/route.ts");
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
  "compare product picker search contract",
  includesAll(comparePicker, [
    "role=\"combobox\"",
    "role=\"listbox\"",
    "aria-activedescendant",
    "AbortController",
    "controller.abort()",
    "window.setTimeout",
    "search-suggestions?q=",
    "surface=compare",
    "onSelect(item)"
  ]) && !comparePicker.includes("router.push") && !comparePicker.includes("window.location"),
  "the picker debounces public suggestions, supports keyboard listbox selection, aborts stale requests, and does not navigate"
);

check(
  "compare picker eligibility gate",
  includesAll(searchSuggestionsRoute, [
    "const surface = url.searchParams.get(\"surface\")",
    "const visibilityFilter = surface === \"compare\" ? isPublicCompareDeal : isPublicDealVisible",
    ".filter(visibilityFilter)"
  ]) &&
    includesAll(compareRoute, [
      'import { isPublicCompareDeal, toPublicDeal } from "@/lib/publicDeal"',
      ".filter((product) => isPublicCompareDeal(product) && idSet.has(normalizeCompareProductId(product.id)))",
      ".sort((a, b) => ids.indexOf(normalizeCompareProductId(a.id)) - ids.indexOf(normalizeCompareProductId(b.id)))",
      ".map(toPublicDeal)"
    ]),
  "compare search suggestions and compare lookup share the same fresh, non-demo, customer-ready eligibility gate"
);

check(
  "compare picker integration",
  (compareBoard.match(/<CompareProductPicker\b/g) ?? []).length === 2 &&
    includesAll(compareBoard, [
      "from \"@/components/CompareProductPicker\";",
      "function addCompareProduct",
      'from "@/lib/compareIdentity"',
      "compareProductIdsEqual",
      "onSelect={addCompareProduct}",
      "const current = readCompareItems();",
      "const normalizedId = normalizeCompareProductId(product.id)",
      "current.some((item) => compareProductIdsEqual(item.id, normalizedId))",
      "current.length >= maxCompareItems",
      "const next = [...current, { id: normalizedId, title: product.title }]",
      "writeCompareItems(next)",
      "setItems(next)",
      "setPickerStatus"
    ]),
  "the picker is rendered in both board states and selected public ids use existing storage with duplicate and 12-item-cap feedback"
);

check(
  "compare cross-surface capacity",
  includesAll(compareBoard, ["MAX_COMPARE_ITEMS", "const maxCompareItems = MAX_COMPARE_ITEMS"]) &&
    includesAll(compareButton, ["MAX_COMPARE_ITEMS", "items.length >= MAX_COMPARE_ITEMS", "비교함은 최대"]) &&
    !compareButton.includes("slice(0, 6)"),
  "detail-page compare additions share the 12-item cap and refuse overflow without discarding existing selections"
);

check(
  "compare URL ids parsing",
  includesAll(compareBoard, [
    "new URL(window.location.href)",
    "searchParams.get(\"ids\")",
    ".split(\",\")",
    ".map(normalizeCompareProductId)",
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
    "isPublicCompareDeal",
    ".map(normalizeCompareProductId)",
    ".filter((product) => isPublicCompareDeal(product) && idSet.has(normalizeCompareProductId(product.id)))",
    "import { MAX_COMPARE_ITEMS, normalizeCompareProductId } from \"@/lib/compareIdentity\"",
    "const maxCompareItems = MAX_COMPARE_ITEMS"
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
  packageJson?.scripts?.["compare:check"] === "node scripts/verify-compare-sharing.mjs" &&
    typeof packageJson?.scripts?.["compare:identity:check"] === "string" &&
    packageJson.scripts["compare:identity:check"].includes("scripts/verify-compare-identity.mjs"),
  "compare sharing and mixed-case identity checks are wired as npm scripts"
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
