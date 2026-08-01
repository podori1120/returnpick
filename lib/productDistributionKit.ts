import { approvalSampleProduct } from "@/lib/approvalSample";
import { getCategoryLabel } from "@/lib/category";
import { getDealPrice, getDiscountRate, getPrimaryUseCase } from "@/lib/dealIntelligence";
import { formatPercent, formatPrice } from "@/lib/format";
import { getDealPriceLabel, getDealQuality, getCustomerPublishReadiness, getReturnEvidenceLabel } from "@/lib/quality";
import { getPurchaseDecision } from "@/lib/purchaseDecision";
import { isPublicDealReady } from "@/lib/publicDeal";
import { buildTelegramMessage } from "@/lib/telegram";
import { getLatestScore } from "@/lib/scoring";
import { getSiteUrl } from "@/lib/siteUrl";
import type { ProductWithScore } from "@/lib/types";

export const PRODUCT_DISTRIBUTION_CAMPAIGN = "deal_distribution";
export const AFFILIATE_DISCLOSURE = "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";

export type ProductDistributionKit = {
  productId: string;
  productName: string;
  categoryLabel: string;
  publicUrl: string;
  disclosure: string;
  priceLabel: string;
  priceText: string;
  returnEvidenceLabel: string;
  verdict: string;
  score: number | null;
  warnings: string[];
  telegram: {
    trackedUrl: string;
    message: string;
  };
  naverBlog: {
    publisherUrl: string;
    trackedUrl: string;
    title: string;
    body: string;
  };
};

function trackedDetailUrl(productId: string, source: "telegram" | "naver_blog") {
  const url = new URL(`${getSiteUrl().replace(/\/$/, "")}/deals/${productId}`);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", source === "telegram" ? "channel" : "owned");
  url.searchParams.set("utm_campaign", PRODUCT_DISTRIBUTION_CAMPAIGN);
  return url.toString();
}

function unique(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function buildBlogBody(product: ProductWithScore, detailUrl: string, warnings: string[]) {
  const score = getLatestScore(product);
  const decision = getPurchaseDecision(product);
  const quality = getDealQuality(product);
  const primaryUseCase = getPrimaryUseCase(product);
  const dealPrice = getDealPrice(product);
  const discountRate = getDiscountRate(product);
  const priceLabel = getDealPriceLabel(product);
  const reasons = unique([
    ...decision.goodSignals,
    ...(score?.reasons ?? []),
    primaryUseCase ? primaryUseCase.reason : ""
  ]).slice(0, 4);
  const cautions = unique([
    ...warnings,
    ...decision.cautions,
    ...quality.warnings
  ]).slice(0, 6);

  return [
    `[제휴 안내] ${AFFILIATE_DISCLOSURE}`,
    "",
    `${getCategoryLabel(product.category)} ${product.title}을(를) 구매 전에 확인한 내용을 정리했습니다.`,
    "",
    "현재 확인 요약",
    `- ${priceLabel}: ${formatPrice(dealPrice)}`,
    `- 반품 정보: ${getReturnEvidenceLabel(product)}`,
    `- 리턴픽 판단: ${decision.verdict}`,
    `- 점수: ${score?.total_score ?? "확인필요"}점`,
    `- 기준가 대비 차이: ${formatPercent(discountRate)}`,
    "",
    "살펴볼 이유",
    ...(reasons.length ? reasons.map((reason) => `- ${reason}`) : ["- 가격·스펙·구매 전 주의사항을 한 화면에서 확인할 수 있습니다."]),
    "",
    "구매 전 확인할 점",
    ...(cautions.length ? cautions.map((caution) => `- ${caution}`) : ["- 가격, 재고, 배송, 반품 조건은 구매 직전 쿠팡 상품 페이지에서 확인하세요."]),
    "",
    "리턴픽 상세 검수와 현재 쿠팡 조건 확인",
    detailUrl,
    "",
    "가격과 재고, 배송 정보, 반품등급은 수시로 바뀔 수 있습니다. 최종 구매 전 쿠팡 상품 페이지에서 다시 확인하세요.",
    AFFILIATE_DISCLOSURE
  ].join("\n");
}

export function getProductDistributionReadiness(product: ProductWithScore) {
  const readiness = getCustomerPublishReadiness(product);
  return {
    ready: isPublicDealReady(product) && readiness.ready,
    blockers: readiness.blockers,
    warnings: readiness.warnings
  };
}

export function buildProductDistributionKit(product: ProductWithScore): ProductDistributionKit {
  const readiness = getProductDistributionReadiness(product);
  if (!readiness.ready) throw new Error("PRODUCT_NOT_PUBLIC_READY");

  const score = getLatestScore(product);
  const decision = getPurchaseDecision(product);
  const quality = getDealQuality(product);
  const dealPrice = getDealPrice(product);
  const priceLabel = getDealPriceLabel(product);
  const telegramUrl = trackedDetailUrl(product.id, "telegram");
  const blogUrl = trackedDetailUrl(product.id, "naver_blog");
  const warnings = unique([...readiness.warnings, ...decision.cautions, ...quality.warnings]).slice(0, 6);

  return {
    productId: product.id,
    productName: product.title,
    categoryLabel: getCategoryLabel(product.category),
    publicUrl: `${getSiteUrl().replace(/\/$/, "")}/deals/${product.id}`,
    disclosure: AFFILIATE_DISCLOSURE,
    priceLabel,
    priceText: formatPrice(dealPrice),
    returnEvidenceLabel: getReturnEvidenceLabel(product),
    verdict: decision.verdict,
    score: score?.total_score ?? null,
    warnings,
    telegram: {
      trackedUrl: telegramUrl,
      message: buildTelegramMessage(product, { detailUrl: telegramUrl })
    },
    naverBlog: {
      publisherUrl: approvalSampleProduct.registeredNaverBlogUrl,
      trackedUrl: blogUrl,
      title: `[리턴픽 검수] ${product.title} 구매 전 가격·반품 체크`,
      body: buildBlogBody(product, blogUrl, warnings)
    }
  };
}
