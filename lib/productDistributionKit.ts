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
  blogger: {
    publisherUrl: string;
    trackedUrl: string;
    title: string;
    body: string;
    html: string;
  };
};

function trackedDetailUrl(productId: string, source: "telegram" | "naver_blog" | "blogger") {
  const url = new URL(`${getSiteUrl().replace(/\/$/, "")}/deals/${productId}`);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", source === "telegram" ? "channel" : "owned");
  url.searchParams.set("utm_campaign", PRODUCT_DISTRIBUTION_CAMPAIGN);
  return url.toString();
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getBloggerPublisherUrl() {
  const raw = process.env.BLOGGER_BLOG_URL?.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname) return "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
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

function buildBloggerHtml(product: ProductWithScore, detailUrl: string, warnings: string[]) {
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
  const priceCaution = "가격, 재고, 배송 정보, 반품 조건은 확인 시점과 구매 시점에 달라질 수 있습니다. 최종 구매 전 쿠팡 상품 페이지에서 다시 확인하세요.";

  return [
    "<article>",
    `<p><strong>[제휴 안내]</strong> ${escapeHtml(AFFILIATE_DISCLOSURE)}</p>`,
    `<h1>${escapeHtml(product.title)}</h1>`,
    `<p>${escapeHtml(`${getCategoryLabel(product.category)} 상품을 구매 전에 확인한 내용을 정리했습니다.`)}</p>`,
    "<h2>현재 확인 요약</h2>",
    "<ul>",
    `<li>${escapeHtml(priceLabel)}: ${escapeHtml(formatPrice(dealPrice))}</li>`,
    `<li>반품 정보: ${escapeHtml(getReturnEvidenceLabel(product))}</li>`,
    `<li>리턴픽 판단: ${escapeHtml(decision.verdict)}</li>`,
    `<li>점수: ${escapeHtml(`${score?.total_score ?? "확인필요"}점`)}</li>`,
    `<li>기준가 대비 차이: ${escapeHtml(formatPercent(discountRate))}</li>`,
    "</ul>",
    "<h2>살펴볼 이유</h2>",
    `<ul>${(reasons.length ? reasons : ["가격·스펙·구매 전 주의사항을 한 화면에서 확인할 수 있습니다."]).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>`,
    "<h2>구매 전 확인할 점</h2>",
    `<ul>${(cautions.length ? cautions : ["가격, 재고, 배송, 반품 조건은 구매 직전 쿠팡 상품 페이지에서 확인하세요."]).map((caution) => `<li>${escapeHtml(caution)}</li>`).join("")}</ul>`,
    `<p><strong>리턴픽 상세 검수와 현재 쿠팡 조건 확인:</strong> <a href="${escapeHtml(detailUrl)}">${escapeHtml(detailUrl)}</a></p>`,
    `<p>${escapeHtml(priceCaution)}</p>`,
    `<p>${escapeHtml(AFFILIATE_DISCLOSURE)}</p>`,
    "</article>"
  ].join("");
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
  const bloggerUrl = trackedDetailUrl(product.id, "blogger");
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
    },
    blogger: {
      publisherUrl: getBloggerPublisherUrl(),
      trackedUrl: bloggerUrl,
      title: `[리턴픽 검수] ${product.title} 구매 전 확인 요약`,
      body: buildBlogBody(product, bloggerUrl, warnings),
      html: buildBloggerHtml(product, bloggerUrl, warnings)
    }
  };
}
