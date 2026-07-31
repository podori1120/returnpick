import { getDealPrice, getDiscountRate, getPrimaryUseCase, getReferencePrice } from "@/lib/dealIntelligence";
import { formatPercent, formatPrice } from "@/lib/format";
import { isUsableAffiliateUrl } from "@/lib/coupangLink";
import { getDealFreshness } from "@/lib/dealFreshness";
import { getPriceReferenceInfo } from "@/lib/priceReference";
import { getDealQuality } from "@/lib/quality";
import { getLatestScore } from "@/lib/scoring";
import type { ProductWithScore, RiskFlag } from "@/lib/types";

const riskLabels: Record<RiskFlag, string> = {
  RISK_CONDITION_UNKNOWN: "반품등급 확인 필요",
  RISK_PRICE_UNKNOWN: "가격 기준 확인 필요",
  RISK_BAD_PRICE_VS_NAVER: "네이버 최저가 대비 불리할 수 있음",
  RISK_FREEDOS: "Windows 설치 비용 확인",
  RISK_LOW_RAM: "RAM 용량 부족 가능성",
  RISK_GAMING_USED: "고성능/게이밍 제품은 사용 흔적 확인",
  RISK_HIGH_PRICE_RETURN: "고가 반품 상품",
  RISK_PANEL_DEFECT: "패널 불량 여부 확인",
  RISK_DOCK_STATION_UNKNOWN: "도킹스테이션 구성 확인",
  RISK_USED_BATTERY: "배터리 상태 확인",
  RISK_CONSUMABLES_UNKNOWN: "소모품 구성 확인",
  RISK_FILTER_COST: "필터 교체 비용 확인",
  RISK_STOCK_ONE: "재고 1개라 가격 변동 가능"
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

export function getPurchaseDecision(product: ProductWithScore) {
  const score = getLatestScore(product);
  const quality = getDealQuality(product);
  const referencePrice = getReferencePrice(product);
  const referenceInfo = getPriceReferenceInfo(product);
  const dealPrice = getDealPrice(product);
  const discountRate = getDiscountRate(product);
  const useCase = getPrimaryUseCase(product);
  const riskFlags = score?.risk_flags ?? [];
  const hasVerifiedReturn = Boolean(product.return_price && !["확인필요", "알수없음"].includes(product.condition_grade));
  const hasAffiliate = isUsableAffiliateUrl(product.affiliate_url);
  const freshness = getDealFreshness(product);

  let confidence = Math.round(((score?.total_score ?? 55) * 0.62) + (quality.confidence * 0.38));
  if (discountRate != null && discountRate >= 0.2) confidence += 6;
  if (discountRate != null && discountRate < 0.1) confidence -= 8;
  if (hasVerifiedReturn) confidence += 5;
  if (!hasAffiliate) confidence -= 12;
  if (!product.return_price) confidence -= 12;
  if (product.stock_count === 1) confidence -= 3;
  if (freshness.status === "stale") confidence -= 8;
  if (freshness.status === "unknown") confidence -= 5;
  confidence = clamp(confidence);

  const verdict =
    confidence >= 86
      ? "지금 가격 확인할 만한 딜"
      : confidence >= 74
        ? "구매 후보로 충분"
        : confidence >= 60
          ? "조건 확인 후 판단"
          : "보류 권장";

  const tone = confidence >= 74 ? "ready" : confidence >= 60 ? "check" : "hold";

  const goodSignals = unique([
    discountRate != null && discountRate > 0 ? `기준가 대비 ${formatPercent(discountRate)} 차이` : "",
    hasVerifiedReturn ? `반품등급 ${product.condition_grade} / 반품가 ${formatPrice(product.return_price)}` : "",
    product.naver_lowest_price ? `네이버 기준가 ${formatPrice(product.naver_lowest_price)} 참고` : `${referenceInfo.label}로 보수 계산`,
    useCase ? `${useCase.label} 용도 적합도 ${useCase.score}점` : "",
    product.stock_count && product.stock_count > 1 ? `재고 ${product.stock_count}개 확인` : "",
    score?.reasons?.[0] ?? ""
  ]).slice(0, 4);

  const cautions = unique([
    !product.return_price ? "반품가를 쿠팡에서 최종 확인하세요." : "",
    !hasVerifiedReturn ? "반품등급은 구매 직전 쿠팡 화면에서 다시 확인하세요." : "",
    !product.naver_lowest_price ? "네이버 최저가 기준이 없어 가격 비교를 보수적으로 봐야 합니다." : "",
    product.stock_count === 1 ? "재고 1개 상품은 가격과 재고가 빠르게 바뀔 수 있습니다." : "",
    !hasAffiliate ? "구매 링크가 준비되지 않아 관리자 확인이 필요합니다." : "",
    freshness.status === "stale" ? `마지막 관찰 후 ${freshness.ageHours ?? 0}시간이 지나 최신 조건을 재확인해야 합니다.` : "",
    freshness.status === "unknown" ? "가격·재고 관찰 시각이 없어 쿠팡에서 최신 조건을 먼저 확인해야 합니다." : "",
    ...riskFlags.map((flag) => riskLabels[flag])
  ]).slice(0, 5);

  const nextSteps = [
    "쿠팡 새 탭에서 현재 가격, 재고, 반품등급을 다시 확인",
    "구성품, 박스 훼손, AS 조건을 상품 페이지에서 확인",
    cautions.length ? "주의 항목이 받아들일 수 있는 수준인지 판단" : "가격이 유지되면 바로 구매 후보로 검토"
  ];

  return {
    confidence,
    verdict,
    tone,
    goodSignals,
    cautions,
    nextSteps,
    dealPrice,
    referencePrice,
    discountRate,
    primaryUseCase: useCase,
    hasAffiliate,
    freshness
  };
}
