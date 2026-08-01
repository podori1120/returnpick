import { getCategoryLabel } from "@/lib/category";
import { getDealPrice, getDiscountRate, getPrimaryUseCase, getReferencePrice } from "@/lib/dealIntelligence";
import { getCustomerPublishReadiness, getDealQuality } from "@/lib/quality";
import { getLatestScore } from "@/lib/scoring";
import { getNaverPriceTrust, type NaverPriceTrustStatus } from "@/lib/naverPriceTrust";
import type { Category, ConditionGrade, RiskFlag, Verdict, ProductWithScore, JsonValue } from "@/lib/types";

export type PublicDeal = {
  id: string;
  title: string;
  category: Category;
  category_label: string;
  brand: string | null;
  model_name: string | null;
  image_url: string | null;
  source_url: string | null;
  coupang_url: string | null;
  affiliate_url: string | null;
  condition_grade: ConditionGrade;
  stock_count: number | null;
  source_price: number | null;
  return_price: number | null;
  new_price: number | null;
  naver_lowest_price: number | null;
  naver_price_status: NaverPriceTrustStatus;
  deal_price: number | null;
  reference_price: number | null;
  discount_rate: number | null;
  score: number | null;
  verdict: Verdict | null;
  reasons: string[];
  risk_flags: RiskFlag[];
  spec_json: Record<string, JsonValue>;
  quality: {
    label: string;
    status: string;
    confidence: number;
  };
  primary_use_case: {
    id: string;
    label: string;
    score: number;
    reason: string;
  } | null;
  detail_url: string;
};

function isTruthyFlag(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

/** Synthetic catalog rows are useful for local UI checks, but never represent a publishable deal. */
export function isDemoProduct(product: Pick<ProductWithScore, "source" | "source_product_id" | "raw_json">) {
  const source = product.source.trim().toLowerCase();
  const provider = typeof product.raw_json?.provider === "string" ? product.raw_json.provider.toLowerCase() : "";
  const demoSeed = product.raw_json?.demo_seed;

  return (
    !source ||
    source === "mock" ||
    source.includes("mock") ||
    source.includes("demo") ||
    provider.includes("mock") ||
    provider.includes("demo") ||
    demoSeed === true ||
    typeof demoSeed === "string" ||
    product.source_product_id?.startsWith("seed-") === true
  );
}

/** Defaults to on for `next dev`, while production is an unconditional no-demo surface. */
export function isLocalDemoModeEnabled() {
  if (process.env.NODE_ENV === "production") return false;
  const configured = process.env.RETURNPICK_DEMO_MODE;
  return configured ? isTruthyFlag(configured) : true;
}

export function isPublicDealReady(product: ProductWithScore) {
  return !isDemoProduct(product) && product.is_published && product.sourcing_status === "published" && getCustomerPublishReadiness(product).ready;
}

/** Public pages may show clearly labelled fixtures only in a local development session. */
export function isPublicDealVisible(product: ProductWithScore) {
  if (isDemoProduct(product)) {
    return isLocalDemoModeEnabled() && product.is_published && product.sourcing_status === "published";
  }
  return isPublicDealReady(product);
}

export function toPublicDeal(product: ProductWithScore): PublicDeal {
  const score = getLatestScore(product);
  const quality = getDealQuality(product);
  const useCase = getPrimaryUseCase(product);
  const naverPrice = getNaverPriceTrust(product);

  return {
    id: product.id,
    title: product.title,
    category: product.category,
    category_label: getCategoryLabel(product.category),
    brand: product.brand,
    model_name: product.model_name,
    image_url: product.image_url,
    source_url: product.source_url,
    coupang_url: product.coupang_url,
    affiliate_url: product.affiliate_url,
    condition_grade: product.condition_grade,
    stock_count: product.stock_count,
    source_price: product.source_price,
    return_price: product.return_price,
    new_price: product.new_price,
    naver_lowest_price: naverPrice.trustedPrice,
    naver_price_status: naverPrice.status,
    deal_price: getDealPrice(product),
    reference_price: getReferencePrice(product),
    discount_rate: getDiscountRate(product),
    score: score?.total_score ?? null,
    verdict: score?.verdict ?? null,
    reasons: score?.reasons ?? [],
    risk_flags: score?.risk_flags ?? [],
    spec_json: product.spec_json,
    quality: {
      label: quality.label,
      status: quality.status,
      confidence: quality.confidence
    },
    primary_use_case: useCase,
    detail_url: `/deals/${product.id}`
  };
}
