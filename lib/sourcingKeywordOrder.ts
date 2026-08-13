import type { SourcingKeyword } from "@/lib/types";

export type SourcingMode = "auto" | "public_web_only";
export const DATASTORE_SOURCING_KEYWORD_ORDER_VERSION = "datastore_created_at_desc_v1";
export const PUBLIC_WEB_SOURCING_KEYWORD_ORDER_VERSION = "min_price_desc_category_balanced_v2";

function comparableMinimumPrice(keyword: SourcingKeyword) {
  return typeof keyword.min_price === "number" && Number.isFinite(keyword.min_price) && keyword.min_price >= 0 ? keyword.min_price : null;
}

function compareMinimumPrice(left: number | null, right: number | null) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return right - left;
}

type PrioritizedKeyword = {
  keyword: SourcingKeyword;
  index: number;
  minimumPrice: number | null;
};

type KeywordGroup = {
  firstIndex: number;
  highestMinimumPrice: number | null;
  items: PrioritizedKeyword[];
};

/**
 * Keep the bounded public-web intake category-diverse while prioritizing the
 * higher-value configured searches. A missing or invalid minimum is deliberately
 * sorted last within its category; this is only a scheduling priority and never
 * turns an observed price into a trusted price.
 */
export function orderPublicWebSourcingKeywords(keywords: readonly SourcingKeyword[]) {
  const groups = new Map<SourcingKeyword["category"], KeywordGroup>();

  keywords.forEach((keyword, index) => {
    const item = { keyword, index, minimumPrice: comparableMinimumPrice(keyword) };
    const group = groups.get(keyword.category);
    if (group) {
      group.items.push(item);
      if (item.minimumPrice != null && (group.highestMinimumPrice == null || item.minimumPrice > group.highestMinimumPrice)) {
        group.highestMinimumPrice = item.minimumPrice;
      }
      return;
    }

    groups.set(keyword.category, {
      firstIndex: index,
      highestMinimumPrice: item.minimumPrice,
      items: [item]
    });
  });

  const orderedGroups = [...groups.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((left, right) => compareMinimumPrice(left.minimumPrice, right.minimumPrice) || left.index - right.index)
    }))
    .sort(
      (left, right) =>
        compareMinimumPrice(left.highestMinimumPrice, right.highestMinimumPrice) || left.firstIndex - right.firstIndex
    );

  const ordered: SourcingKeyword[] = [];
  for (let round = 0; ; round += 1) {
    let emitted = false;
    for (const group of orderedGroups) {
      const item = group.items[round];
      if (!item) continue;
      ordered.push(item.keyword);
      emitted = true;
    }
    if (!emitted) return ordered;
  }
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
