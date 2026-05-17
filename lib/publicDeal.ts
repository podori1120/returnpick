import { getCategoryLabel } from "@/lib/category";
import { getDealPrice, getDiscountRate, getPrimaryUseCase, getReferencePrice } from "@/lib/dealIntelligence";
import { getDealQuality } from "@/lib/quality";
import { getLatestScore } from "@/lib/scoring";
import type { Category, ConditionGrade, RiskFlag, Verdict, ProductWithScore, JsonValue } from "@/lib/types";

export type PublicDeal = {
  id: string;
  title: string;
  category: Category;
  category_label: string;
  brand: string | null;
  model_name: string | null;
  image_url: string | null;
  affiliate_url: string | null;
  condition_grade: ConditionGrade;
  stock_count: number | null;
  source_price: number | null;
  return_price: number | null;
  new_price: number | null;
  naver_lowest_price: number | null;
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

export function toPublicDeal(product: ProductWithScore): PublicDeal {
  const score = getLatestScore(product);
  const quality = getDealQuality(product);
  const useCase = getPrimaryUseCase(product);

  return {
    id: product.id,
    title: product.title,
    category: product.category,
    category_label: getCategoryLabel(product.category),
    brand: product.brand,
    model_name: product.model_name,
    image_url: product.image_url,
    affiliate_url: product.affiliate_url,
    condition_grade: product.condition_grade,
    stock_count: product.stock_count,
    source_price: product.source_price,
    return_price: product.return_price,
    new_price: product.new_price,
    naver_lowest_price: product.naver_lowest_price,
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
