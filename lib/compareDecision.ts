import type { PublicDeal } from "./publicDeal";

export type ComparePriority = "balanced" | "lowest_price" | "return_safety";

export const comparePriorityOptions: ReadonlyArray<{
  id: ComparePriority;
  label: string;
  description: string;
}> = [
  {
    id: "balanced",
    label: "전체 균형",
    description: "점수·검수·가격을 함께 봅니다."
  },
  {
    id: "lowest_price",
    label: "최저 실구매가",
    description: "현재 구매가가 확인된 상품을 우선합니다."
  },
  {
    id: "return_safety",
    label: "반품 안정성",
    description: "반품 근거·검수 신뢰도·위험을 함께 봅니다."
  }
];

const conditionStrength: Record<PublicDeal["condition_grade"], number> = {
  미개봉: 40,
  최상: 34,
  상: 24,
  중: 10,
  알수없음: 4,
  확인필요: 5
};

const highImpactRiskFlags = new Set([
  "RISK_PANEL_DEFECT",
  "RISK_DOCK_STATION_UNKNOWN",
  "RISK_USED_BATTERY",
  "RISK_CONSUMABLES_UNKNOWN",
  "RISK_FILTER_COST",
  "RISK_HIGH_PRICE_RETURN"
]);

function hasVerifiedReturn(product: PublicDeal) {
  return Boolean(product.return_price && !["확인필요", "알수없음"].includes(product.condition_grade));
}

function safeMetric(product: PublicDeal) {
  const grade = conditionStrength[product.condition_grade] ?? 12;
  const returnEvidence = hasVerifiedReturn(product) ? 20 : product.return_price ? 8 : 0;
  const quality = Math.round(Math.max(0, Math.min(100, product.quality.confidence)) * 0.2);
  const score = Math.round(Math.max(0, Math.min(100, product.score ?? 0)) * 0.2);
  const riskCount = product.risk_flags.length;
  const highImpactRiskCount = product.risk_flags.filter((flag) => highImpactRiskFlags.has(flag)).length;
  const riskPenalty = Math.min(25, riskCount * 3 + highImpactRiskCount * 4);

  return Math.max(0, Math.min(100, grade + returnEvidence + quality + score - riskPenalty));
}

function usableProducts(products: readonly PublicDeal[]) {
  const inStock = products.filter((product) => product.stock_count !== 0);
  return inStock.length ? inStock : products;
}

function sortByPrice(left: PublicDeal, right: PublicDeal) {
  const leftPrice = left.deal_price ?? Number.POSITIVE_INFINITY;
  const rightPrice = right.deal_price ?? Number.POSITIVE_INFINITY;
  return leftPrice - rightPrice || (right.score ?? 0) - (left.score ?? 0) || left.id.localeCompare(right.id);
}

function sortByBalanced(left: PublicDeal, right: PublicDeal) {
  return (
    (right.score ?? 0) - (left.score ?? 0) ||
    right.quality.confidence - left.quality.confidence ||
    Number(hasVerifiedReturn(right)) - Number(hasVerifiedReturn(left)) ||
    (right.discount_rate ?? -1) - (left.discount_rate ?? -1) ||
    sortByPrice(left, right)
  );
}

function sortByReturnSafety(left: PublicDeal, right: PublicDeal) {
  return safeMetric(right) - safeMetric(left) || sortByBalanced(left, right);
}

export type CompareDecision = {
  priority: ComparePriority;
  label: string;
  description: string;
  product: PublicDeal | null;
  metric: number | null;
  reason: string;
};

export function getCompareDecision(products: readonly PublicDeal[], priority: ComparePriority = "balanced"): CompareDecision {
  const option = comparePriorityOptions.find((candidate) => candidate.id === priority) ?? comparePriorityOptions[0];
  const candidates = usableProducts(products);
  if (!candidates.length) {
    return {
      priority: option.id,
      label: option.label,
      description: option.description,
      product: null,
      metric: null,
      reason: "비교할 공개 상품이 없습니다."
    };
  }

  const pricedCandidates = candidates.filter((candidate) => candidate.deal_price != null);
  const hasPriceCandidate = priority === "lowest_price" && pricedCandidates.length > 0;
  const sorted = [...(hasPriceCandidate ? pricedCandidates : candidates)].sort(
    priority === "lowest_price" && hasPriceCandidate ? sortByPrice : priority === "return_safety" ? sortByReturnSafety : sortByBalanced
  );
  const product = sorted[0];
  const metric = priority === "return_safety" ? safeMetric(product) : priority === "lowest_price" ? product.deal_price : product.score;

  const reason =
    priority === "lowest_price"
      ? hasPriceCandidate
        ? "현재 구매가가 확인된 상품을 우선했습니다. 가격·재고·배송 조건은 구매처에서 다시 확인하세요."
        : "구매가가 확인된 후보가 없어 점수·검수 신뢰도를 보조 기준으로 표시했습니다. 구매처에서 가격을 먼저 확인하세요."
      : priority === "return_safety"
        ? "반품등급·반품가·검수 신뢰도와 위험 플래그를 함께 살폈습니다. 확인필요 정보는 안정성이 확인된 것으로 계산하지 않았습니다."
        : "리턴픽 점수·검수 신뢰도·반품 근거와 가격 매력을 함께 살폈습니다.";

  return {
    priority: option.id,
    label: option.label,
    description: option.description,
    product,
    metric: metric ?? null,
    reason
  };
}

export function getComparePriority(value: string | null | undefined): ComparePriority {
  return comparePriorityOptions.some((option) => option.id === value) ? (value as ComparePriority) : "balanced";
}
