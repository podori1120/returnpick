import { calculateDiscountRate } from "@/lib/format";
import { getAffiliateIdentityReadiness } from "@/lib/affiliateIdentity";
import { isApprovalSampleAffiliateUrl, isUsableAffiliateUrl } from "@/lib/coupangLink";
import { isUsableProductImageUrl } from "@/lib/productImageUrl";
import { getPriceReferenceInfo } from "@/lib/priceReference";
import { getLatestScore } from "@/lib/scoring";
import type { ProductWithScore } from "@/lib/types";

export type DealQualityStatus = "ready" | "manual_check" | "watch_price" | "hold";

export interface DealQuality {
  status: DealQualityStatus;
  label: string;
  confidence: number;
  priority: number;
  blockers: string[];
  warnings: string[];
}

export interface CustomerPublishReadiness {
  ready: boolean;
  blockers: string[];
  warnings: string[];
}

export function hasVerifiedReturnEvidence(product: Pick<ProductWithScore, "return_price" | "condition_grade">) {
  return Boolean(product.return_price && !["확인필요", "알수없음"].includes(product.condition_grade));
}

export function getReturnEvidenceLabel(product: Pick<ProductWithScore, "return_price" | "condition_grade">) {
  if (hasVerifiedReturnEvidence(product)) return "반품 근거 확인";
  if (product.return_price) return "반품등급 확인필요";
  if (product.condition_grade === "확인필요" || product.condition_grade === "알수없음") return "반품 정보 확인필요";
  return "반품가 확인필요";
}

export function getDealPriceLabel(product: Pick<ProductWithScore, "return_price" | "source_price" | "new_price">) {
  if (product.return_price) return "반품가";
  if (product.source_price) return "현재 판매가";
  if (product.new_price) return "새상품가";
  return "가격";
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function getDealQuality(product: ProductWithScore): DealQuality {
  const score = getLatestScore(product);
  const blockers: string[] = [];
  const warnings: string[] = [];
  const riskFlags = score?.risk_flags ?? [];
  const referenceInfo = getPriceReferenceInfo(product);
  const referencePrice = referenceInfo.value;
  const trustedNaverPrice = referenceInfo.naverTrust.trustedPrice;
  const dealPrice = product.return_price ?? product.source_price ?? product.new_price;
  const discountRate = calculateDiscountRate(referencePrice, dealPrice);

  if (!dealPrice) blockers.push("판매 가격 확인 필요");
  if (trustedNaverPrice && dealPrice && dealPrice > trustedNaverPrice) blockers.push("네이버 최저가 대비 가격 불리");
  if (product.condition_grade === "중" && (dealPrice ?? 0) >= 1_000_000) blockers.push("고가 반품-중 조합");

  if (!product.return_price) warnings.push("반품가 확인 필요");
  if (product.condition_grade === "확인필요" || product.condition_grade === "알수없음") warnings.push("반품등급 확인 필요");
  if (!isUsableAffiliateUrl(product.affiliate_url)) warnings.push("파트너스 URL 보완 권장");
  if (referenceInfo.naverTrust.status === "unverified") warnings.push("네이버 최저가 동일 상품 검증 필요");
  if (referenceInfo.naverTrust.status === "missing") warnings.push("네이버 최저가 없음");
  if (product.stock_count === 0) blockers.push("품절 확인");
  if (product.stock_count == null) warnings.push("재고 확인 필요");
  if (product.stock_count === 1) warnings.push("재고 1개");
  if (riskFlags.includes("RISK_FREEDOS")) warnings.push("FreeDOS 설치 비용 확인");
  if (riskFlags.includes("RISK_USED_BATTERY")) warnings.push("배터리 상태 확인");
  if (riskFlags.includes("RISK_PANEL_DEFECT")) warnings.push("패널 상태 확인");
  if (riskFlags.includes("RISK_DOCK_STATION_UNKNOWN")) warnings.push("도킹스테이션 구성품 확인");
  if (riskFlags.includes("RISK_FILTER_COST")) warnings.push("필터 비용 확인");

  let confidence = 100;
  confidence -= blockers.length * 22;
  confidence -= warnings.length * 7;
  confidence -= Math.max(0, riskFlags.length - 1) * 3;
  if ((score?.total_score ?? 0) < 65) confidence -= 15;
  if (discountRate != null && discountRate < 0.1) confidence -= 10;
  confidence = clamp(confidence);

  const priority =
    (score?.total_score ?? 0) +
    (discountRate != null ? Math.max(0, discountRate) * 80 : 0) +
    (product.stock_count === 1 ? 8 : 0) -
    blockers.length * 10;

  if (blockers.length >= 2) {
    return { status: "hold", label: "보류 우선", confidence, priority, blockers, warnings };
  }
  if (blockers.length === 1) {
    return { status: "manual_check", label: "수동 확인", confidence, priority, blockers, warnings };
  }
  if (!trustedNaverPrice || discountRate == null || discountRate < 0.12) {
    return { status: "watch_price", label: "가격 관찰", confidence, priority, blockers, warnings };
  }
  return { status: "ready", label: "게시 적합", confidence, priority, blockers, warnings };
}

export function getCustomerPublishReadiness(product: ProductWithScore): CustomerPublishReadiness {
  const quality = getDealQuality(product);
  const blockers = new Set<string>();
  const warnings = new Set<string>();

  if (!isUsableAffiliateUrl(product.affiliate_url)) {
    blockers.add(isApprovalSampleAffiliateUrl(product.affiliate_url) ? "승인용 샘플 링크 사용 중" : "상품별 파트너스 링크 필요");
  } else {
    const affiliateIdentity = getAffiliateIdentityReadiness(product);
    if (!affiliateIdentity.ready && affiliateIdentity.blocker) blockers.add(affiliateIdentity.blocker);
  }
  for (const blocker of quality.blockers) blockers.add(blocker);
  if (!isUsableProductImageUrl(product.image_url)) {
    blockers.add(product.image_url ? "상품 이미지 URL 확인 필요" : "상품 이미지 확인 필요");
  }
  for (const warning of quality.warnings) warnings.add(warning);
  if (!product.public_note?.trim()) warnings.add("공개 설명 보강 권장");

  return {
    ready: blockers.size === 0,
    blockers: Array.from(blockers),
    warnings: Array.from(warnings)
  };
}
