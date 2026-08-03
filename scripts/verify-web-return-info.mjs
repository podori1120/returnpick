import assert from "node:assert/strict";
import {
  extractReturnInfoFromText,
  mergeStoredWebReturnInfo,
  resolveConditionGrade,
  resolveStoredWebReturnInfo,
  resolveWebReturnEvidence
} from "../lib/webReturnInfo.ts";

const best = extractReturnInfoFromText("노트북 반품-최상 반품가 800,000원 재고 1개");
assert.equal(best.isReturnCandidate, true);
assert.equal(best.condition_grade, "최상");
assert.equal(best.return_price, 800000);
assert.equal(best.stock_count, 1);

const upper = extractReturnInfoFromText("모니터 반품-상");
assert.equal(upper.condition_grade, "상");

const middle = extractReturnInfoFromText("청소기 반품-중");
assert.equal(middle.condition_grade, "중");

const refurb = extractReturnInfoFromText("리퍼브 반품-최상급 반품가 74.2만원 잔여 2개");
assert.equal(refurb.isReturnCandidate, true);
assert.equal(refurb.condition_grade, "최상");
assert.equal(refurb.return_price, 742000);
assert.equal(refurb.stock_count, 2);

const display = extractReturnInfoFromText("전시상품 박스 훼손 B급 1개 남음");
assert.equal(display.isReturnCandidate, true);
assert.equal(display.condition_grade, "중");
assert.equal(display.stock_count, 1);

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

const gradeBoundPrice = extractReturnInfoFromText("노트북 반품-최상 800,000원");
assert.equal(gradeBoundPrice.return_price, null);

const explicitReturnWithRegularPrice = extractReturnInfoFromText("노트북 반품-최상 반품가 800,000원 새상품 판매가 1,000,000원");
assert.equal(explicitReturnWithRegularPrice.return_price, 800000);

const gradeWithRegularPrice = extractReturnInfoFromText("노트북 반품-최상 새상품 판매가 1,200,000원");
assert.equal(gradeWithRegularPrice.return_price, null);

const gradeWithModelNumber = extractReturnInfoFromText("노트북 반품-최상 모델번호 123456");
assert.equal(gradeWithModelNumber.return_price, null);

const gradeWithSpacedRegularPrice = extractReturnInfoFromText("노트북 반품-최상 새 상품 판매 가격 1,200,000원");
assert.equal(gradeWithSpacedRegularPrice.return_price, null);

const onlinePrice = extractReturnInfoFromText("반품-최상 온라인 최저가 99만원");
assert.equal(onlinePrice.return_price, null);

const couponPrice = extractReturnInfoFromText("반품-최상 쿠폰 할인가 99만원");
assert.equal(couponPrice.return_price, null);

const punctuatedGradePrice = extractReturnInfoFromText("노트북 반품-최상 · 74.2만원");
assert.equal(punctuatedGradePrice.return_price, null);

const suffixNormalPrice = extractReturnInfoFromText("노트북 반품-최상 · 99만원 (정상가)");
assert.equal(suffixNormalPrice.return_price, null);

const suffixSalePrice = extractReturnInfoFromText("노트북 반품-최상 · 99만원 판매가");
assert.equal(suffixSalePrice.return_price, null);

const suffixCouponPrice = extractReturnInfoFromText("노트북 반품-최상 · 99만원 쿠폰 할인가");
assert.equal(suffixCouponPrice.return_price, null);

const unlabelledGradePrice = extractReturnInfoFromText("노트북 반품-최상 800,000원");
assert.equal(unlabelledGradePrice.condition_grade, "최상");
assert.equal(unlabelledGradePrice.return_price, null);

const providerValuesWin = resolveWebReturnEvidence(
  { condition_grade: "상", return_price: 700000, stock_count: 2 },
  best
);
assert.deepEqual(providerValuesWin, {
  condition_grade: "상",
  return_price: 700000,
  stock_count: 2
});

const productWithoutReturnEvidence = resolveStoredWebReturnInfo("LG 그램 16GB 512GB", {
  is_return_candidate: false,
  condition_grade: "확인필요",
  return_price: null,
  stock_count: null,
  evidence: [],
  confidence: 0
});
assert.equal(productWithoutReturnEvidence.isReturnCandidate, false);
assert.equal(productWithoutReturnEvidence.condition_grade, "확인필요");
assert.equal(productWithoutReturnEvidence.return_price, null);

const explicitFalseWithReturnWord = resolveStoredWebReturnInfo("반품 노트북 반품-최상", {
  is_return_candidate: false,
  condition_grade: "확인필요",
  return_price: null,
  stock_count: null,
  evidence: [],
  confidence: 0
});
assert.equal(explicitFalseWithReturnWord.isReturnCandidate, false);
assert.equal(explicitFalseWithReturnWord.condition_grade, "확인필요");
assert.equal(explicitFalseWithReturnWord.return_price, null);

const returnEvidenceInDetail = resolveStoredWebReturnInfo("로보락 S8", {
  is_return_candidate: false,
  evidence: [],
  detail_page: {
    is_return_candidate: true,
    condition_grade: "최상",
    return_price: 599000,
    stock_count: 1,
    evidence: ["상세 페이지에서 반품 등급과 반품가 확인"],
    confidence: 90
  }
});
assert.equal(returnEvidenceInDetail.isReturnCandidate, true);
assert.equal(returnEvidenceInDetail.condition_grade, "최상");
assert.equal(returnEvidenceInDetail.return_price, 599000);
assert.equal(returnEvidenceInDetail.stock_count, 1);

const preservedStoredInfo = mergeStoredWebReturnInfo(
  {
    candidate_kind: "product_without_return_evidence",
    detail_page: {
      is_return_candidate: true,
      return_price: 599000,
      evidence: ["detail evidence"]
    }
  },
  returnEvidenceInDetail
);
assert.equal(preservedStoredInfo.candidate_kind, "product_without_return_evidence");
assert.deepEqual(preservedStoredInfo.detail_page, {
  is_return_candidate: true,
  return_price: 599000,
  evidence: ["detail evidence"]
});

console.log("Web return evidence checks passed: Korean grade parsing, weak-grade fallback, and no inferred return price.");
