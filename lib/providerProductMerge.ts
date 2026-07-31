import type { ProviderProduct } from "@/lib/providers/types";

export type ProviderProductBatch = {
  provider: string;
  products: ProviderProduct[];
};

export type ProviderProductMergeResult = {
  products: ProviderProduct[];
  providers: string[];
  fetchedCount: number;
  deduplicatedCount: number;
};

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/[^0-9a-z가-힣]+/g, " ").replace(/\s+/g, " ").trim();
}

function sourceProductKey(product: ProviderProduct) {
  if (!product.source_product_id) return null;
  return `${product.source.toLowerCase()}:${product.source_product_id.trim().toLowerCase()}`;
}

function titleProductKey(product: ProviderProduct) {
  const title = normalizeTitle(product.title);
  return title ? `${product.category}:${title}` : null;
}

function hasReturnEvidence(product: ProviderProduct) {
  const webReturnInfo = product.raw_json?.web_return_info;
  return (
    product.return_price != null ||
    (product.condition_grade != null && !["확인필요", "알수없음"].includes(product.condition_grade)) ||
    (webReturnInfo != null && typeof webReturnInfo === "object" && !Array.isArray(webReturnInfo) && webReturnInfo.is_return_candidate === true)
  );
}

function evidenceScore(product: ProviderProduct) {
  let score = 0;
  if (hasReturnEvidence(product)) score += 20;
  if (product.return_price != null) score += 8;
  if (product.stock_count != null) score += 2;
  if (product.image_url) score += 1;
  if (product.affiliate_url) score += 1;
  return score;
}

function mergeDuplicateProducts(current: ProviderProduct, incoming: ProviderProduct) {
  const preferred = evidenceScore(incoming) > evidenceScore(current) ? incoming : current;
  const fallback = preferred === incoming ? current : incoming;
  const currentSourceKey = sourceProductKey(current);
  const incomingSourceKey = sourceProductKey(incoming);

  return {
    ...fallback,
    ...preferred,
    brand: preferred.brand ?? fallback.brand ?? null,
    model_name: preferred.model_name ?? fallback.model_name ?? null,
    image_url: preferred.image_url ?? fallback.image_url ?? null,
    source_url: preferred.source_url ?? fallback.source_url ?? null,
    coupang_url: preferred.coupang_url ?? fallback.coupang_url ?? null,
    affiliate_url: preferred.affiliate_url ?? fallback.affiliate_url ?? null,
    source_price: preferred.source_price ?? fallback.source_price ?? null,
    return_price: preferred.return_price ?? fallback.return_price ?? null,
    new_price: preferred.new_price ?? fallback.new_price ?? null,
    stock_count: preferred.stock_count ?? fallback.stock_count ?? null,
    raw_json: {
      ...(fallback.raw_json ?? {}),
      ...(preferred.raw_json ?? {}),
      provider_merge: {
        preferred_source: preferred.source,
        supporting_source: fallback.source,
        matched_by: currentSourceKey && currentSourceKey === incomingSourceKey ? "source_product_id" : "exact_normalized_title"
      }
    }
  } satisfies ProviderProduct;
}

export function mergeProviderProductBatches(batches: ProviderProductBatch[]): ProviderProductMergeResult {
  const products: ProviderProduct[] = [];
  const providers: string[] = [];
  const sourceIndex = new Map<string, number>();
  const titleIndex = new Map<string, number>();
  let fetchedCount = 0;
  let deduplicatedCount = 0;

  for (const batch of batches) {
    if (batch.products.length > 0 && !providers.includes(batch.provider)) providers.push(batch.provider);
    fetchedCount += batch.products.length;

    for (const product of batch.products) {
      const sourceKey = sourceProductKey(product);
      const titleKey = titleProductKey(product);
      const existingIndex = (sourceKey ? sourceIndex.get(sourceKey) : undefined) ?? (titleKey ? titleIndex.get(titleKey) : undefined);

      if (existingIndex == null) {
        const nextIndex = products.length;
        products.push(product);
        if (sourceKey) sourceIndex.set(sourceKey, nextIndex);
        if (titleKey) titleIndex.set(titleKey, nextIndex);
        continue;
      }

      deduplicatedCount += 1;
      const merged = mergeDuplicateProducts(products[existingIndex], product);
      products[existingIndex] = merged;
      const mergedSourceKey = sourceProductKey(merged);
      const mergedTitleKey = titleProductKey(merged);
      if (sourceKey) sourceIndex.set(sourceKey, existingIndex);
      if (titleKey) titleIndex.set(titleKey, existingIndex);
      if (mergedSourceKey) sourceIndex.set(mergedSourceKey, existingIndex);
      if (mergedTitleKey) titleIndex.set(mergedTitleKey, existingIndex);
    }
  }

  return { products, providers, fetchedCount, deduplicatedCount };
}
