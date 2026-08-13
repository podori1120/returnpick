import type { SourcingKeyword } from "@/lib/types";

export type SourcingMode = "auto" | "public_web_only";
export const DATASTORE_SOURCING_KEYWORD_ORDER_VERSION = "datastore_created_at_desc_v1";
export const PUBLIC_WEB_SOURCING_KEYWORD_ORDER_VERSION = "min_price_desc_v1";

function comparableMinimumPrice(keyword: SourcingKeyword) {
  return typeof keyword.min_price === "number" && Number.isFinite(keyword.min_price) && keyword.min_price >= 0 ? keyword.min_price : null;
}

/**
 * Keep the bounded public-web intake focused on the higher-value configured
 * searches first. A missing minimum is deliberately sorted last; this is only
 * a scheduling priority and never turns an observed price into a trusted price.
 */
export function orderPublicWebSourcingKeywords(keywords: readonly SourcingKeyword[]) {
  return keywords
    .map((keyword, index) => ({ keyword, index, minimumPrice: comparableMinimumPrice(keyword) }))
    .sort((left, right) => {
      if (left.minimumPrice == null && right.minimumPrice == null) return left.index - right.index;
      if (left.minimumPrice == null) return 1;
      if (right.minimumPrice == null) return -1;
      return right.minimumPrice - left.minimumPrice || left.index - right.index;
    })
    .map(({ keyword }) => keyword);
}

export function getOrderedSourcingKeywords(keywords: readonly SourcingKeyword[], sourceMode: SourcingMode) {
  return sourceMode === "public_web_only" ? orderPublicWebSourcingKeywords(keywords) : [...keywords];
}

export function getSourcingKeywordOrderVersion(sourceMode: SourcingMode) {
  return sourceMode === "public_web_only" ? PUBLIC_WEB_SOURCING_KEYWORD_ORDER_VERSION : DATASTORE_SOURCING_KEYWORD_ORDER_VERSION;
}

export function getSourcingKeywordOrderSnapshot(keywords: readonly SourcingKeyword[], sourceMode: SourcingMode) {
  return JSON.stringify(
    getOrderedSourcingKeywords(keywords, sourceMode).map((keyword) => [
      keyword.id,
      keyword.category,
      keyword.keyword,
      keyword.min_price,
      keyword.max_price,
      keyword.min_discount_rate
    ])
  );
}
