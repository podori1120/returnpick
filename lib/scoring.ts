import { calculateDiscountRate } from "@/lib/format";
import type { DealScore, ProductWithScore, RiskFlag, SourcedProduct, Verdict } from "@/lib/types";

const conditionScores: Record<string, number> = {
  미개봉: 20,
  최상: 17,
  상: 10,
  중: 3,
  알수없음: 2,
  확인필요: 5
};

const verdictRanks: Verdict[] = ["비추", "보류", "조건부 추천", "추천", "강력추천"];

function scorePrice(discountRate: number | null, hasEnoughPrice: boolean) {
  if (!hasEnoughPrice) return 5;
  if (discountRate == null || discountRate <= 0) return 0;
  if (discountRate < 0.05) return 3;
  if (discountRate < 0.1) return 8;
  if (discountRate < 0.15) return 13;
  if (discountRate < 0.2) return 18;
  if (discountRate < 0.3) return 24;
  return 30;
}

function verdictFromScore(score: number): Verdict {
  if (score >= 85) return "강력추천";
  if (score >= 75) return "추천";
  if (score >= 65) return "조건부 추천";
  if (score >= 50) return "보류";
  return "비추";
}

function capVerdict(verdict: Verdict, max: Verdict) {
  return verdictRanks[Math.min(verdictRanks.indexOf(verdict), verdictRanks.indexOf(max))];
}

function includesText(product: SourcedProduct, tokens: string[]) {
  const haystack = `${product.title} ${product.public_note ?? ""} ${product.admin_memo ?? ""}`.toLowerCase();
  return tokens.some((token) => haystack.includes(token.toLowerCase()));
}

function getNumberFromSpec(product: SourcedProduct, key: string) {
  const value = product.spec_json?.[key];
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.match(/\d+(\.\d+)?/)?.[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function scoreSpecs(product: SourcedProduct, riskFlags: RiskFlag[], reasons: string[]) {
  let score = 12;

  if (product.category === "laptop") {
    const ram = getNumberFromSpec(product, "ram");
    const ssd = getNumberFromSpec(product, "ssd");
    const gpu = String(product.spec_json?.gpu ?? "");
    const os = String(product.spec_json?.os ?? "");
    score = 10;
    if (ram && ram >= 16) {
      score += 4;
      reasons.push("RAM 16GB 이상이면 일반 업무와 학습용으로 여유가 있습니다.");
    }
    if (ram && ram <= 8) riskFlags.push("RISK_LOW_RAM");
    if (ssd && (ssd >= 512 || String(product.spec_json?.ssd).toUpperCase().includes("1TB"))) score += 3;
    if (/RTX\s?(3050|3060|4050|4060|4070)/i.test(gpu)) {
      score += 2;
      riskFlags.push("RISK_GAMING_USED");
    }
    if (/FreeDOS/i.test(os)) riskFlags.push("RISK_FREEDOS");
    return Math.min(score, 20);
  }

  if (product.category === "monitor") {
    score = 12;
    const resolution = String(product.spec_json?.resolution ?? "");
    const refresh = getNumberFromSpec(product, "refresh_rate");
    if (["QHD", "UHD", "4K", "WQHD"].includes(resolution)) score += 4;
    if (refresh && refresh >= 144) score += 3;
    if (includesText(product, ["패널 불량", "빛샘", "멍", "흠집"])) riskFlags.push("RISK_PANEL_DEFECT");
    return Math.min(score, 20);
  }

  if (product.category === "robot_vacuum") {
    score = 11;
    if (product.spec_json?.dock_station) score += 4;
    else riskFlags.push("RISK_DOCK_STATION_UNKNOWN");
    if (product.spec_json?.mop) score += 3;
    if (product.spec_json?.auto_empty) score += 2;
    return Math.min(score, 20);
  }

  if (product.category === "cordless_vacuum") {
    score = 10;
    if (product.spec_json?.stand) score += 3;
    if (product.spec_json?.battery) score += 2;
    else riskFlags.push("RISK_USED_BATTERY");
    if (product.spec_json?.filter) score += 2;
    else riskFlags.push("RISK_CONSUMABLES_UNKNOWN");
    return Math.min(score, 20);
  }

  if (product.category === "air_purifier") {
    score = 11;
    if (product.spec_json?.coverage) score += 3;
    if (product.spec_json?.filter) score += 2;
    else riskFlags.push("RISK_FILTER_COST");
    return Math.min(score, 20);
  }

  if (product.category === "dehumidifier") {
    score = 11;
    if (product.spec_json?.capacity) score += 4;
    if (includesText(product, ["연속배수", "호스"])) score += 2;
    return Math.min(score, 20);
  }

  return score;
}

function scoreCategoryRisk(product: SourcedProduct, riskFlags: RiskFlag[]) {
  let score = 8;
  if (product.category === "monitor" && riskFlags.includes("RISK_PANEL_DEFECT")) score -= 4;
  if (product.category === "laptop" && riskFlags.includes("RISK_GAMING_USED")) score -= 2;
  if (["robot_vacuum", "cordless_vacuum"].includes(product.category)) score -= 1;
  return Math.max(0, Math.min(score, 10));
}

function scoreHiddenCost(product: SourcedProduct, riskFlags: RiskFlag[]) {
  let score = 10;
  if (riskFlags.includes("RISK_FREEDOS")) score -= 4;
  if (riskFlags.includes("RISK_USED_BATTERY")) score -= 3;
  if (riskFlags.includes("RISK_CONSUMABLES_UNKNOWN")) score -= 2;
  if (riskFlags.includes("RISK_FILTER_COST")) score -= 2;
  if (riskFlags.includes("RISK_DOCK_STATION_UNKNOWN")) score -= 2;
  return Math.max(0, score);
}

function scoreBrand(product: SourcedProduct) {
  const text = `${product.brand ?? ""} ${product.title}`.toLowerCase();
  if (["samsung", "삼성", "lg", "apple", "애플", "dyson", "다이슨"].some((brand) => text.includes(brand))) return 5;
  if (["lenovo", "레노버", "asus", "hp", "msi", "roborock", "로보락", "winix", "위닉스"].some((brand) => text.includes(brand))) return 4;
  return 3;
}

export function calculateDealScore(product: SourcedProduct): DealScore {
  const riskFlags: RiskFlag[] = [];
  const reasons: string[] = [];

  const referencePrice = product.naver_lowest_price ?? product.new_price ?? product.source_price;
  const dealPrice = product.return_price ?? product.source_price;
  const hasEnoughPrice = Boolean(referencePrice && dealPrice);
  const discountRate = calculateDiscountRate(referencePrice, dealPrice);
  const priceScore = scorePrice(discountRate, hasEnoughPrice);

  if (!hasEnoughPrice) riskFlags.push("RISK_PRICE_UNKNOWN");
  if (product.return_price == null) riskFlags.push("RISK_PRICE_UNKNOWN");
  if (product.naver_lowest_price && dealPrice && dealPrice > product.naver_lowest_price) {
    riskFlags.push("RISK_BAD_PRICE_VS_NAVER");
  }
  if (discountRate != null && discountRate >= 0.2) {
    reasons.push("기준 가격 대비 할인 폭이 커서 검토할 가치가 높습니다.");
  }

  const conditionScore = conditionScores[product.condition_grade] ?? 5;
  if (product.condition_grade === "확인필요") riskFlags.push("RISK_CONDITION_UNKNOWN");

  const specScore = scoreSpecs(product, riskFlags, reasons);
  const categoryRiskScore = scoreCategoryRisk(product, riskFlags);
  const hiddenCostScore = scoreHiddenCost(product, riskFlags);
  const asScore = scoreBrand(product);
  let timingScore = 4;
  if (product.stock_count === 1) {
    timingScore = 5;
    riskFlags.push("RISK_STOCK_ONE");
  } else if (product.stock_count == null) {
    timingScore = 3;
  }

  if (product.condition_grade === "중" && (dealPrice ?? 0) >= 1_000_000) {
    riskFlags.push("RISK_HIGH_PRICE_RETURN");
  }

  const totalScore = Math.max(
    0,
    Math.min(100, priceScore + conditionScore + specScore + categoryRiskScore + hiddenCostScore + asScore + timingScore)
  );

  let verdict = verdictFromScore(totalScore);
  if (product.condition_grade === "확인필요") verdict = capVerdict(verdict, "조건부 추천");
  if (product.return_price == null) verdict = capVerdict(verdict, "보류");
  if (riskFlags.includes("RISK_BAD_PRICE_VS_NAVER")) verdict = capVerdict(verdict, "보류");
  if (riskFlags.includes("RISK_HIGH_PRICE_RETURN")) verdict = capVerdict(verdict, "조건부 추천");
  if (riskFlags.includes("RISK_FREEDOS") && includesText(product, ["초보", "입문"])) verdict = capVerdict(verdict, "조건부 추천");
  if (
    discountRate != null &&
    discountRate < 0.1 &&
    ["RISK_USED_BATTERY", "RISK_CONSUMABLES_UNKNOWN", "RISK_FILTER_COST", "RISK_DOCK_STATION_UNKNOWN"].some((flag) =>
      riskFlags.includes(flag as RiskFlag)
    )
  ) {
    verdict = capVerdict(verdict, "보류");
  }

  if (reasons.length === 0) {
    reasons.push("가격, 상태, 스펙을 함께 확인한 뒤 승인 여부를 판단해야 합니다.");
  }

  const now = new Date().toISOString();
  return {
    id: "",
    product_id: product.id,
    total_score: totalScore,
    price_score: priceScore,
    condition_score: conditionScore,
    spec_score: specScore,
    category_risk_score: categoryRiskScore,
    hidden_cost_score: hiddenCostScore,
    as_score: asScore,
    timing_score: timingScore,
    verdict,
    reasons,
    risk_flags: Array.from(new Set(riskFlags)),
    score_detail: {
      reference_price: referencePrice ?? null,
      deal_price: dealPrice ?? null,
      discount_rate: discountRate,
      applied_caps: {
        condition_unknown: product.condition_grade === "확인필요",
        return_price_missing: product.return_price == null,
        bad_price_vs_naver: riskFlags.includes("RISK_BAD_PRICE_VS_NAVER")
      }
    },
    created_at: now,
    updated_at: now
  };
}

export function getLatestScore(product: ProductWithScore) {
  if (product.latest_score) return product.latest_score;
  return [...(product.deal_scores ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}
