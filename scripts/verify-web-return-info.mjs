import assert from "node:assert/strict";
import {
  extractListedPriceCandidatesFromText,
  extractListedPriceFromText,
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
assert.equal(extractListedPriceFromText("새상품 판매가 1,200,000원"), 1200000);
assert.equal(extractListedPriceFromText("할인 가격 74.2만원"), 742000);
assert.equal(extractListedPriceFromText("노트북 1,200,000원"), null);
assert.equal(extractListedPriceFromText("노트북 모델번호 123456"), null);
assert.deepEqual(
  extractListedPriceCandidatesFromText("새상품 판매가 1,200,000원 추천 마우스 판매가 19,900원"),
  [1200000, 19900]
);
assert.equal(extractListedPriceFromText("쿠폰 할인가 99만원"), null);
assert.equal(extractListedPriceFromText("반품-최상 상품가 99만원"), null);
assert.equal(extractListedPriceFromText("할인가 99만원 쿠폰 적용"), null);
assert.equal(extractListedPriceFromText("판매가 99만원 배송비 3,000원"), null);
assert.equal(extractListedPriceFromText("판매가 99만원 배송 별도"), null);
assert.equal(extractListedPriceFromText("판매가 99만원 설치 별도"), null);
assert.equal(extractListedPriceFromText("판매가 99만원 추가금 3만원"), null);
assert.equal(extractListedPriceFromText("return product 판매가 99만원"), null);
assert.equal(extractListedPriceFromText("refurbished 판매가 99만원"), null);
assert.equal(extractListedPriceFromText("판매가 99만원 refurbished"), null);
assert.equal(extractListedPriceFromText("판매가 99만원 additional cost"), null);
assert.equal(extractListedPriceFromText("additional cost 판매가 99만원"), null);
assert.equal(extractListedPriceFromText("additional-cost 판매가 99만원"), null);
assert.equal(extractListedPriceFromText("판매가 99만원 additional-cost"), null);
assert.equal(extractListedPriceFromText("판매가 99만원 return product"), null);
assert.equal(extractListedPriceFromText("repackaged 판매가 99만원"), null);
assert.equal(extractListedPriceFromText("판매가 99만원 repackaged"), null);
assert.equal(extractListedPriceFromText("repackaging 판매가 99만원"), null);
assert.equal(extractListedPriceFromText("판매가 99만원 repackaging"), null);
assert.equal(extractListedPriceFromText("install 판매가 99만원"), null);
assert.equal(extractListedPriceFromText("판매가 99만원 install"), null);
assert.equal(extractListedPriceFromText("delivery charge 판매가 99만원"), null);
assert.equal(extractListedPriceFromText("판매가 99만원 delivery charge"), null);
assert.equal(extractListedPriceFromText("배송 포함 판매가 99만원"), null);
assert.equal(extractListedPriceFromText("판매가 99만원 당일 배송"), null);
assert.equal(extractListedPriceFromText("설치 포함 판매가 99만원"), null);
assert.equal(extractListedPriceFromText("판매가 99만원 당일 설치"), null);
assert.equal(extractListedPriceFromText("returns 판매가 99만원"), null);
assert.equal(extractListedPriceFromText("판매가 99만원 returns"), null);
assert.equal(extractListedPriceFromText("installed 판매가 99만원"), null);
assert.equal(extractListedPriceFromText("판매가 99만원 installed"), null);
assert.equal(extractListedPriceFromText("coupon 판매가 99만원"), null);
assert.equal(extractListedPriceFromText("판매가 99만원 coupon applied"), null);
assert.equal(extractListedPriceFromText("반품 상품 특별 판매가 990,000원"), null);
assert.equal(extractListedPriceFromText("판매가 99만원 반품 상품"), null);
assert.equal(extractListedPriceFromText('<span hidden>판매가 99만원</span>'), null);
assert.equal(extractListedPriceFromText('<span style="display:none">판매가 99만원</span>'), null);
assert.equal(extractListedPriceFromText("<div hidden><div>숨김 가격</div>판매가 99만원</div>"), null);
assert.equal(extractListedPriceFromText("<div style=display:none><div>숨김 가격</div>판매가 99만원</div>"), null);
assert.equal(extractListedPriceFromText('<div style="visibility:hidden">판매가 99만원</div>'), null);
assert.equal(extractListedPriceFromText("<div style=visibility:hidden>판매가 99만원</div>"), null);
assert.equal(extractListedPriceFromText('<div title=">" hidden>판매가 99만원</div>'), null);
assert.equal(extractListedPriceFromText("<div hidden/>판매가 99만원"), null);
assert.equal(extractListedPriceFromText('<span title="x > 판매가 92,000원">보이는 제목</span>'), null);
assert.equal(extractListedPriceFromText('<span aria-hidden="true">판매가 99만원</span>'), null);
assert.equal(extractListedPriceFromText("<!-- 판매가 99만원 --><script>판매가 98만원</script><style>.x{content:'판매가 97만원'}</style><noscript>판매가 96만원</noscript>"), null);
assert.equal(extractListedPriceFromText("<script><script>판매가 95만원</script>판매가 94만원</script>"), null);
assert.equal(extractListedPriceFromText("<style><style>판매가 93만원</style>판매가 92만원</style>"), null);
assert.equal(extractListedPriceFromText("<noscript><noscript>판매가 91만원</noscript>판매가 90만원</noscript>"), null);
assert.equal(extractListedPriceFromText("<template><span>판매가 89만원</span></template>"), null);
assert.equal(extractListedPriceFromText("<template><script>가짜 </template>A급 반품가 990,000원</script></template>"), null);
assert.equal(extractListedPriceFromText("<!-- 설명 > 판매가 88만원"), null);
assert.equal(extractListedPriceFromText('<span>판매가 99만원</span>'), 990000);
const rawTextEvidenceMarkup = `<script>const marker = "<template>";</script><p>반품-최상 반품가 777,000원 재고 2개</p><div>${"설명 ".repeat(40)}</div><p>새상품 판매가 999,000원</p>`;
const rawTextEvidence = extractReturnInfoFromText(rawTextEvidenceMarkup);
assert.equal(rawTextEvidence.isReturnCandidate, true);
assert.equal(rawTextEvidence.condition_grade, "최상");
assert.equal(rawTextEvidence.return_price, 777000);
assert.equal(rawTextEvidence.stock_count, 2);
assert.equal(extractListedPriceFromText(rawTextEvidenceMarkup), 999000);

const gradeBoundPrice = extractReturnInfoFromText("노트북 반품-최상 800,000원");
assert.equal(gradeBoundPrice.return_price, null);

const explicitReturnWithRegularPrice = extractReturnInfoFromText("노트북 반품-최상 반품가 800,000원 새상품 판매가 1,000,000원");
assert.equal(explicitReturnWithRegularPrice.return_price, 800000);

const gradeWithRegularPrice = extractReturnInfoFromText("노트북 반품-최상 새상품 판매가 1,200,000원");
assert.equal(gradeWithRegularPrice.return_price, null);

const gradeWithModelNumber = extractReturnInfoFromText("노트북 반품-최상 모델번호 123456");
assert.equal(gradeWithModelNumber.return_price, null);
const urlOnlyEvidence = extractReturnInfoFromText("노트북 https://catalog.example.test/return-policy");
assert.equal(urlOnlyEvidence.isReturnCandidate, false);
for (const urlToken of [
  "//catalog.example.test/return-policy",
  "catalog.example.test/return-policy",
  "catalog.example.test:8443/return-policy?next=return#return-policy",
  "mailto:returns@example.test",
  "/return-policy?next=return#return-policy",
  "return-policy",
  "product/return-policy",
  "?next=return",
  "#return-policy"
]) {
  assert.equal(extractReturnInfoFromText(`노트북 ${urlToken}`).isReturnCandidate, false);
}
const ordinaryGrade = extractReturnInfoFromText("노트북 A급 like new B급");
assert.equal(ordinaryGrade.isReturnCandidate, false);
assert.equal(ordinaryGrade.condition_grade, null);
const returnPolicyText = extractReturnInfoFromText("노트북 무료 반품 A급, 무료 반품 정책과 환불 안내");
assert.equal(returnPolicyText.isReturnCandidate, false);
assert.equal(returnPolicyText.condition_grade, null);
assert.equal(returnPolicyText.return_price, null);
const returnPolicyFee = extractReturnInfoFromText("교환 및 반품 상품 안내: 반품 가격 30,000원 배송비는 고객 부담입니다.");
assert.equal(returnPolicyFee.isReturnCandidate, false);
assert.equal(returnPolicyFee.condition_grade, null);
assert.equal(returnPolicyFee.return_price, null);
const compactReturnShippingFee = extractReturnInfoFromText("반품가 30,000원은 반품 배송비입니다.");
assert.equal(compactReturnShippingFee.isReturnCandidate, false);
assert.equal(compactReturnShippingFee.return_price, null);
const spacedReturnShippingFee = extractReturnInfoFromText("반품 가격 30,000원은 회수 배송비입니다.");
assert.equal(spacedReturnShippingFee.isReturnCandidate, false);
assert.equal(spacedReturnShippingFee.return_price, null);
const parcelReturnShippingFee = extractReturnInfoFromText("반품가 30,000원은 반품 택배비입니다.");
assert.equal(parcelReturnShippingFee.isReturnCandidate, false);
assert.equal(parcelReturnShippingFee.return_price, null);
const parcelFeeThenProductReturn = extractReturnInfoFromText(
  `반품가 30,000원은 반품 택배비입니다. ${"상품 설명 ".repeat(30)} 반품-최상 반품가 742,000원 배송비는 고객 부담입니다.`
);
assert.equal(parcelFeeThenProductReturn.isReturnCandidate, true);
assert.equal(parcelFeeThenProductReturn.condition_grade, "최상");
assert.equal(parcelFeeThenProductReturn.return_price, 742000);
const englishReturnShippingFee = extractReturnInfoFromText("반품가 30,000원 (return shipping fee)");
assert.equal(englishReturnShippingFee.isReturnCandidate, false);
assert.equal(englishReturnShippingFee.return_price, null);
const feeThenProductReturn = extractReturnInfoFromText(
  "반품 배송비 안내: 반품가 30,000원. 반품-최상 반품가 742,000원 배송비는 고객 부담입니다."
);
assert.equal(feeThenProductReturn.isReturnCandidate, true);
assert.equal(feeThenProductReturn.condition_grade, "최상");
assert.equal(feeThenProductReturn.return_price, 742000);
const freePolicyThenProductReturn = extractReturnInfoFromText(
  "무료 반품 상품 반품 가격 30,000원. 반품-최상 반품가 742,000원 배송비는 고객 부담입니다."
);
assert.equal(freePolicyThenProductReturn.isReturnCandidate, true);
assert.equal(freePolicyThenProductReturn.condition_grade, "최상");
assert.equal(freePolicyThenProductReturn.return_price, 742000);
const itemReturnPriceWithShipping = extractReturnInfoFromText("반품-최상 반품가 742,000원 배송비는 고객 부담입니다.");
assert.equal(itemReturnPriceWithShipping.isReturnCandidate, true);
assert.equal(itemReturnPriceWithShipping.return_price, 742000);
const mixedPolicyAndItem = extractReturnInfoFromText(
  `교환 및 반품 상품 안내: 반품 가격 30,000원 배송비는 고객 부담입니다. ${"설명 ".repeat(40)} 반품-최상 반품가 742,000원`
);
assert.equal(mixedPolicyAndItem.isReturnCandidate, true);
assert.equal(mixedPolicyAndItem.condition_grade, "최상");
assert.equal(mixedPolicyAndItem.return_price, 742000);
const adjacentPolicyThenItem = extractReturnInfoFromText(
  "교환 및 반품 상품 안내: 반품 가격 30,000원 배송비는 고객 부담입니다. 반품-최상 반품가 742,000원"
);
assert.equal(adjacentPolicyThenItem.isReturnCandidate, true);
assert.equal(adjacentPolicyThenItem.condition_grade, "최상");
assert.equal(adjacentPolicyThenItem.return_price, 742000);
const adjacentItemThenPolicy = extractReturnInfoFromText(
  "반품-최상 반품가 742,000원. 교환 및 반품 상품 안내: 반품 가격 30,000원 배송비는 고객 부담입니다."
);
assert.equal(adjacentItemThenPolicy.isReturnCandidate, true);
assert.equal(adjacentItemThenPolicy.condition_grade, "최상");
assert.equal(adjacentItemThenPolicy.return_price, 742000);
const itemEvidenceAfterPolicySentence = extractReturnInfoFromText(
  "교환 및 반품 안내. 반품-최상 등급의 노트북이며 검수를 완료했습니다. 반품가 742,000원"
);
assert.equal(itemEvidenceAfterPolicySentence.isReturnCandidate, true);
assert.equal(itemEvidenceAfterPolicySentence.condition_grade, "최상");
assert.equal(itemEvidenceAfterPolicySentence.return_price, 742000);
const freeReturnGradePrice = extractReturnInfoFromText("무료 반품 A급 반품가 30,000원");
assert.equal(freeReturnGradePrice.isReturnCandidate, false);
assert.equal(freeReturnGradePrice.return_price, null);
const freeReturnSpacedPrice = extractReturnInfoFromText("무료 반품 상품 반품 가격 30,000원");
assert.equal(freeReturnSpacedPrice.isReturnCandidate, false);
assert.equal(freeReturnSpacedPrice.return_price, null);

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
