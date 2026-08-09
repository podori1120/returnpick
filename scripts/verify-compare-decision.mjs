import { getCompareDecision, getComparePriority } from "../lib/compareDecision.ts";

function assert(condition, message) {
  if (!condition) throw new Error(`Compare decision check failed: ${message}`);
}

function product(overrides = {}) {
  return {
    id: overrides.id ?? "product",
    title: overrides.title ?? "테스트 상품",
    condition_grade: overrides.condition_grade ?? "상",
    return_price: overrides.return_price === null ? null : overrides.return_price ?? 500000,
    deal_price: overrides.deal_price === null ? null : overrides.deal_price ?? 500000,
    score: overrides.score ?? 80,
    discount_rate: overrides.discount_rate ?? 0.2,
    stock_count: overrides.stock_count ?? 3,
    quality: { confidence: overrides.qualityConfidence ?? 80 },
    risk_flags: overrides.risk_flags ?? []
  };
}

const highScore = product({ id: "high-score", score: 94, qualityConfidence: 92, deal_price: 900000 });
const lowestPrice = product({ id: "lowest-price", score: 78, qualityConfidence: 76, deal_price: 450000 });
const safest = product({ id: "safest", score: 82, qualityConfidence: 95, condition_grade: "미개봉", return_price: 600000, deal_price: 600000 });
const unknownReturn = product({ id: "unknown-return", score: 99, qualityConfidence: 99, condition_grade: "확인필요", return_price: null, deal_price: 400000, risk_flags: ["RISK_CONDITION_UNKNOWN"] });
const knownMiddle = product({ id: "known-middle", score: 70, qualityConfidence: 70, condition_grade: "중", return_price: 500000, deal_price: 500000 });
const noPrice = product({ id: "no-price", score: 84, qualityConfidence: 88, deal_price: null, return_price: null });
const soldOut = product({ id: "sold-out", deal_price: 100000, stock_count: 0 });

assert(getComparePriority("lowest_price") === "lowest_price", "known priority should be preserved");
assert(getComparePriority("unexpected") === "balanced", "unknown priority should fall back to balanced");
assert(getCompareDecision([], "return_safety").product === null, "empty comparison should have no winner");
assert(getCompareDecision([highScore, lowestPrice], "balanced").product?.id === "high-score", "balanced should favor the strongest score");
assert(getCompareDecision([highScore, lowestPrice], "lowest_price").product?.id === "lowest-price", "lowest price should favor the lowest confirmed purchase price");
assert(getCompareDecision([highScore, lowestPrice, safest], "return_safety").product?.id === "safest", "safety should favor verified condition and review evidence");
assert(getCompareDecision([soldOut, lowestPrice], "lowest_price").product?.id === "lowest-price", "sold-out products should not win when an in-stock candidate exists");
assert(getCompareDecision([unknownReturn, safest], "return_safety").product?.id === "safest", "unknown return data should not outrank verified condition evidence");
assert(getCompareDecision([unknownReturn, knownMiddle], "return_safety").product?.id === "known-middle", "unknown return data should not outrank a known middle condition");
assert(getCompareDecision([noPrice], "lowest_price").reason.includes("구매가가 확인된 후보가 없어"), "lowest-price mode should disclose its score fallback when no price exists");
assert(getCompareDecision([highScore], "balanced").reason.includes("리턴픽 점수"), "balanced decision should explain its inputs");
assert(getCompareDecision([highScore], "return_safety").reason.includes("확인필요 정보"), "safety decision should disclose unknown-data handling");

console.log("compare decision rules: 11 passed");
