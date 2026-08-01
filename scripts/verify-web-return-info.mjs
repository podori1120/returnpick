import assert from "node:assert/strict";
import {
  extractReturnInfoFromText,
  resolveConditionGrade,
  resolveWebReturnEvidence
} from "../lib/webReturnInfo.ts";

const best = extractReturnInfoFromText("노트북 반품-최상 800,000원 재고 1개");
assert.equal(best.isReturnCandidate, true);
assert.equal(best.condition_grade, "최상");
assert.equal(best.return_price, 800000);
assert.equal(best.stock_count, 1);

const upper = extractReturnInfoFromText("모니터 반품-상");
assert.equal(upper.condition_grade, "상");

const middle = extractReturnInfoFromText("청소기 반품-중");
assert.equal(middle.condition_grade, "중");

assert.equal(resolveConditionGrade("확인필요", "최상"), "최상");
assert.equal(resolveConditionGrade("알수없음", "상"), "상");
assert.equal(resolveConditionGrade("상", "최상"), "상");
assert.equal(resolveConditionGrade(undefined, null), "확인필요");

const noExplicitReturnPrice = extractReturnInfoFromText("반품 후보 상품 가격 확인 필요");
const resolvedWithoutPrice = resolveWebReturnEvidence(
  { condition_grade: "확인필요", return_price: null, stock_count: null },
  noExplicitReturnPrice
);
assert.equal(noExplicitReturnPrice.isReturnCandidate, true);
assert.equal(noExplicitReturnPrice.return_price, null);
assert.equal(resolvedWithoutPrice.return_price, null);

const regularPriceOnly = extractReturnInfoFromText("반품 후보 안내. 새상품 판매가 1,200,000원. 재고 2개");
assert.equal(regularPriceOnly.return_price, null);
assert.equal(regularPriceOnly.stock_count, 2);

const gradeBoundPrice = extractReturnInfoFromText("노트북 반품-최상 800,000원 새상품 판매가 1,000,000원");
assert.equal(gradeBoundPrice.return_price, 800000);

const providerValuesWin = resolveWebReturnEvidence(
  { condition_grade: "상", return_price: 700000, stock_count: 2 },
  best
);
assert.deepEqual(providerValuesWin, {
  condition_grade: "상",
  return_price: 700000,
  stock_count: 2
});

console.log("Web return evidence checks passed: Korean grade parsing, weak-grade fallback, and no inferred return price.");
