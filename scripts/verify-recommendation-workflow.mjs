import { readFileSync } from "node:fs";
import path from "node:path";
import {
  MAX_RECOMMENDATIONS,
  parseRecommendationParams,
  rankRecommendationProducts
} from "../lib/recommendation.ts";
import { getProductImpressionStorageKey } from "../lib/impressionTracking.ts";
import { matchesPriceBandValue, priceBandOptions } from "../lib/priceBand.ts";
import {
  commentOutRecommendationSitemapEntry,
  getRecommendationSitemapEntries,
  hasExactRecommendationSitemapEntry,
  removeRecommendationSitemapEntry
} from "./sitemapContract.mjs";

const root = process.cwd();

function readText(file) {
  return readFileSync(path.join(root, file), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(`Recommendation workflow check failed: ${message}`);
}

const useCaseScores = {
  "fit-strong": [{ id: "gaming", score: 95 }],
  "score-high": [{ id: "gaming", score: 88 }],
  confidence: [{ id: "gaming", score: 88 }],
  discount: [{ id: "gaming", score: 88 }],
  "fit-lower": [{ id: "gaming", score: 88 }],
  "not-use-case": [{ id: "office_student", score: 90 }],
  "below-score": [{ id: "gaming", score: 88 }],
  "outside-price": [{ id: "gaming", score: 88 }]
};

const prices = {
  "fit-strong": 500000,
  "score-high": 500000,
  confidence: 500000,
  discount: 500000,
  "fit-lower": 500000,
  "not-use-case": 500000,
  "below-score": 500000,
  "outside-price": 900000
};

const discounts = {
  "fit-strong": 0.01,
  "score-high": 0.05,
  confidence: 0.05,
  discount: 0.2,
  "fit-lower": 0.9,
  "not-use-case": 0.3,
  "below-score": 0.4,
  "outside-price": 0.5
};

const confidences = {
  "fit-strong": 50,
  "score-high": 80,
  confidence: 90,
  discount: 90,
  "fit-lower": 70,
  "not-use-case": 90,
  "below-score": 90,
  "outside-price": 90
};

const products = [
  { id: "fit-strong", category: "laptop", latest_score: { total_score: 70 } },
  { id: "score-high", category: "laptop", latest_score: { total_score: 95 } },
  { id: "confidence", category: "laptop", latest_score: { total_score: 95 } },
  { id: "discount", category: "laptop", latest_score: { total_score: 95 } },
  { id: "fit-lower", category: "laptop", latest_score: { total_score: 80 } },
  { id: "not-use-case", category: "laptop", latest_score: { total_score: 100 } },
  { id: "below-score", category: "laptop", latest_score: { total_score: 65 } },
  { id: "outside-price", category: "laptop", latest_score: { total_score: 100 } }
];

const dependencies = {
  categoryOptions: [{ value: "laptop" }, { value: "monitor" }],
  useCaseOptions: [{ id: "gaming" }, { id: "office_student" }],
  priceBandOptions: [{ id: "under_700k" }],
  getDealPrice: (product) => prices[product.id] ?? null,
  getDiscountRate: (product) => discounts[product.id] ?? null,
  getUseCaseMatches: (product) => useCaseScores[product.id] ?? [],
  matchesUseCase: (product, useCaseId) => (useCaseScores[product.id] ?? []).some((match) => match.id === useCaseId && match.score >= 60),
  matchesPriceBand: (product, priceBandId) => matchesPriceBandValue(prices[product.id] ?? 0, priceBandId),
  getQualityConfidence: (product) => confidences[product.id] ?? 0
};

const parsedFilters = parseRecommendationParams(
  { useCase: "gaming", category: ["laptop"], priceBand: "under_700k", minScore: "70" },
  dependencies
);
assert(parsedFilters.useCase === "gaming", "valid use case should be retained");
assert(parsedFilters.category === "laptop", "valid category should be retained");
assert(parsedFilters.priceBand === "under_700k", "valid price band should be retained");
assert(parsedFilters.minScore === 70, "valid minimum score should be retained");

const invalidFilters = parseRecommendationParams(
  { useCase: "unknown", category: "not-a-category", priceBand: "not-a-band", minScore: "not-a-score" },
  dependencies
);
assert(
  invalidFilters.useCase === undefined &&
    invalidFilters.category === undefined &&
    invalidFilters.priceBand === undefined &&
    invalidFilters.minScore === undefined,
  "invalid query values should safely fall back to no filter"
);

assert(priceBandOptions.find((band) => band.id === "under_300k")?.label === "30만원 미만", "price band labels should describe the actual lower bound");
assert(matchesPriceBandValue(299999, "under_300k"), "prices below 30만원 should match the first price band");
assert(!matchesPriceBandValue(300000, "under_300k"), "30만원 should not overlap with the first price band");
assert(matchesPriceBandValue(300000, "under_700k"), "30만원 should start the second price band");
assert(matchesPriceBandValue(699999, "under_700k"), "prices below 70만원 should match the second price band");
assert(!matchesPriceBandValue(700000, "under_700k"), "70만원 should not overlap with the second price band");
assert(matchesPriceBandValue(700000, "under_1200k"), "70만원 should start the third price band");
assert(matchesPriceBandValue(1199999, "under_1200k"), "prices below 120만원 should match the third price band");
assert(!matchesPriceBandValue(1200000, "under_1200k"), "120만원 should not overlap with the third price band");
assert(matchesPriceBandValue(1200000, "over_1200k"), "120만원 should start the premium price band");

const recommendationImpressionKey = getProductImpressionStorageKey("web_recommend", "recommendation_results");
const dealsImpressionKey = getProductImpressionStorageKey("web_deals_index", "deals_index");
assert(recommendationImpressionKey === "returnpick_impressed_deals:web_recommend:recommendation_results", "recommendation impressions should use a stable surface-specific storage key");
assert(recommendationImpressionKey !== dealsImpressionKey, "recommendation impressions should not share deduplication state with the deals index");

const filteredMatches = rankRecommendationProducts(products, parsedFilters, dependencies);
assert(filteredMatches.length === 5, "recommendation filtering should keep only the matching use case, price band, and score");
assert(filteredMatches[0]?.product.id === "fit-strong", "fit should rank before the raw deal score");
assert(filteredMatches[1]?.product.id === "discount", "discount should break equal-score and equal-confidence ties");
assert(filteredMatches.every((match) => match.product.id !== "not-use-case" && match.product.id !== "below-score" && match.product.id !== "outside-price"), "filtered results must exclude non-matches");

const boundedMatches = rankRecommendationProducts(products, {}, dependencies);
assert(boundedMatches.length === MAX_RECOMMENDATIONS, "recommendation results should be bounded to six");
assert(boundedMatches.every((match) => match.fitScore === null && match.conditionMatchScore === null), "without a purpose, category, or price filter, no suitability score should be claimed");

const categoryOnlyFilters = parseRecommendationParams({ category: "laptop" }, dependencies);
const categoryOnlyMatches = rankRecommendationProducts(products, categoryOnlyFilters, dependencies);
assert(categoryOnlyMatches[0]?.fitScore === null && categoryOnlyMatches[0]?.conditionMatchScore === 100, "category-only results should show condition match, not purpose fit");

const priceOnlyFilters = parseRecommendationParams({ priceBand: "under_700k" }, dependencies);
const priceOnlyMatches = rankRecommendationProducts(products, priceOnlyFilters, dependencies);
assert(priceOnlyMatches[0]?.fitScore === null && priceOnlyMatches[0]?.conditionMatchScore === 100, "price-only results should show condition match, not purpose fit");
assert(filteredMatches[0]?.fitScore !== null && filteredMatches[0]?.conditionMatchScore === null, "purpose-filtered results should show purpose fit only");

const route = readText("app/recommend/page.tsx");
const helper = readText("lib/recommendation.ts");
const home = readText("app/page.tsx");
const layout = readText("app/layout.tsx");
const sitemap = readText("app/sitemap.ts");
const packageJson = readText("package.json");
const readiness = readText("scripts/check-readiness.mjs");
const recommendationSitemapEntries = getRecommendationSitemapEntries(sitemap);
const commentedRecommendationSitemap = commentOutRecommendationSitemapEntry(sitemap);
const absentRecommendationSitemap = removeRecommendationSitemapEntry(sitemap);

assert(helper.includes("matchesUseCase") && helper.includes("matchesPriceBand") && helper.includes("getUseCaseMatches"), "the pure helper should use the approved matching contracts");
assert(helper.includes("getDealPrice") && helper.includes("getDiscountRate") && helper.includes("getQualityConfidence"), "the helper should expose deterministic price, discount, and confidence ranking inputs");
assert(helper.includes("slice(0, MAX_RECOMMENDATIONS)"), "the helper should cap recommendation results");
assert(route.includes('searchParams: Promise<Record<string, string | string[] | undefined>>'), "recommendation route should read shareable GET query parameters");
assert(route.includes('listProducts({ published: true })'), "recommendation route should load published catalog rows");
assert(route.includes("isPublicDealVisible(product)") && route.includes("isPublicDealReady(product)"), "recommendation route should gate results through public visibility and readiness");
assert(route.includes("<DealCard product={recommendation.product} />"), "recommendation route should reuse the existing DealCard CTA boundary");
assert(route.includes("<ProductImpressionTracker") && route.includes('channel="web_recommend"') && route.includes('context="recommendation_results"'), "recommendation results should enter the affiliate impression funnel");
assert(route.includes("recommendation.fitScore !== null") && route.includes("조건 일치도") && route.includes("resultMetricLabel"), "recommendation cards should label condition matches unless a purpose was selected");
assert(route.includes("판매 가격이 없거나 품절인 상품은 제외하고") && route.includes("반품등급·재고가 확인필요한 상품은 주의사항과 함께 표시합니다"), "recommendation copy should distinguish blocking price/stock states from confirmation-needed return information");
const eventTracker = readText("components/AffiliateEventTracker.tsx");
assert(eventTracker.includes("getProductImpressionStorageKey") && eventTracker.includes("const seenKey = getProductImpressionStorageKey(channel, context)"), "impression deduplication should be scoped by channel and context");
assert(route.includes("<AffiliateNotice />"), "recommendation route should show the affiliate disclosure");
assert(route.includes("<SearchIntentRail limit={4} />") && route.includes('<ApprovalSampleCard placement="picks" />'), "recommendation route should retain guide and editorial handoffs");
assert(route.includes("alternates: { canonical: canonicalUrl }") && route.includes('const canonicalUrl = `${siteUrl}/recommend`'), "recommendation route should publish a canonical /recommend URL");
assert(hasExactRecommendationSitemapEntry(sitemap) && recommendationSitemapEntries.length === 1, "recommendation route should appear exactly once in the executable sitemap with daily cadence and priority 0.86");
assert(commentedRecommendationSitemap !== sitemap && getRecommendationSitemapEntries(commentedRecommendationSitemap).length === 0, "commented recommendation sitemap entries should not satisfy the sitemap contract");
assert(absentRecommendationSitemap !== sitemap && getRecommendationSitemapEntries(absentRecommendationSitemap).length === 0, "an absent recommendation sitemap entry should fail discovery parsing");
assert(home.includes('href="/recommend"') && home.includes("내 용도에 맞는 딜 찾기"), "home should expose the requested recommendation CTA");
assert(layout.includes('href="/recommend"') && layout.includes("맞춤 추천"), "primary navigation should expose the recommendation route");
assert(packageJson.includes('"recommendation:check": "node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/verify-recommendation-workflow.mjs"'), "package.json should wire recommendation:check");
assert(readiness.includes('"app/recommend/page.tsx"') && readiness.includes('"lib/recommendation.ts"') && readiness.includes('"lib/priceBand.ts"') && readiness.includes('"lib/impressionTracking.ts"') && readiness.includes('"scripts/verify-recommendation-workflow.mjs"'), "readiness should require the recommendation files and pure boundary helpers");
assert(readiness.includes("recommendation workflow:"), "readiness should contain the recommendation contract check");

console.log("Recommendation workflow checks passed.");
