import { calculateDealScore } from "@/lib/scoring";
import { createDealScore, listProducts, updateProduct } from "@/lib/dataStore";
import { getLowestPriceFromQueries, type NaverLowestPriceResult } from "@/lib/providers/naverShoppingProvider";
import { getNaverPriceTrust, withNaverPriceFingerprint } from "@/lib/naverPriceTrust";
import type { ProductWithScore } from "@/lib/types";

type NaverPriceBackfillDetail = {
  product_id: string;
  title: string;
  status: string;
  price?: number;
  query?: string;
  queries?: string[];
  reason?: string;
  matched_title?: string;
  match?: NaverLowestPriceResult["match"];
};

function cleanTitle(value: string) {
  return value
    .replace(/반품|리퍼|중고|미개봉|최상|상급|상태|확인필요|알수없음|쿠팡|파트너스/gi, " ")
    .replace(/[()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
}

function specTokens(product: ProductWithScore) {
  const specs = product.spec_json ?? {};
  return [
    product.brand,
    product.model_name,
    specs.ram,
    specs.ssd,
    specs.cpu,
    specs.gpu,
    specs.size,
    specs.resolution,
    specs.refresh_rate,
    specs.capacity
  ]
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
    .map(String)
    .filter((value) => value.length > 1);
}

export function buildNaverPriceQueries(product: ProductWithScore) {
  const title = cleanTitle(product.title);
  const tokens = specTokens(product);
  const queries = [
    [product.brand, product.model_name].filter(Boolean).join(" "),
    [product.brand, product.model_name, ...tokens.slice(2, 5)].filter(Boolean).join(" "),
    title,
    [product.brand, title].filter(Boolean).join(" ")
  ]
    .map((query) => query.replace(/\s+/g, " ").trim())
    .filter((query) => query.length >= 2)
    .slice(0, 4);

  return Array.from(new Set(queries));
}

function relevanceTokens(product: ProductWithScore) {
  return Array.from(
    new Set(
      specTokens(product)
        .concat(cleanTitle(product.title).split(/\s+/))
        .map((token) => token.toLowerCase())
        .filter((token) => token.length >= 2)
    )
  ).slice(0, 18);
}

async function findNaverLowestPrice(product: ProductWithScore) {
  const queries = buildNaverPriceQueries(product);
  const lookup = await getLowestPriceFromQueries(queries, {
    relevanceTokens: relevanceTokens(product),
    product: {
      category: product.category,
      title: product.title,
      brand: product.brand,
      model_name: product.model_name,
      spec_json: product.spec_json
    }
  });
  const best = lookup.price && lookup.query && lookup.item
    ? {
        price: lookup.price,
        query: lookup.query,
        item: lookup.item,
        relevance: lookup.match?.relevance_score ?? 0,
        match: lookup.match
      }
    : null;
  return { status: lookup.status, queries, best, errors: lookup.errors, match: lookup.match };
}

function backfillErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_NAVER_PRICE_BACKFILL_ERROR";
}

function firstQuery(queries: string[]) {
  return queries.find((query) => query.trim().length > 0);
}

function noMatchReason(result: Awaited<ReturnType<typeof findNaverLowestPrice>>) {
  if (result.status === "error") return result.errors.slice(0, 2).join(" | ") || "NAVER_SEARCH_ERROR";
  if (!result.queries.length) return "NO_NAVER_PRICE_QUERY";
  if ((result.match?.sku_rejected_count ?? 0) > 0) return "NAVER_SKU_UNVERIFIED";
  return "NO_RELEVANT_PRICED_MATCH";
}

export async function backfillNaverLowestPrices(options?: {
  publishedOnly?: boolean;
  onlyMissing?: boolean;
  clearExistingOnNoMatch?: boolean;
  limit?: number;
}) {
  const products = await listProducts(options?.publishedOnly ? { published: true } : undefined);
  const targets = products
    .filter((product) => (options?.onlyMissing === false ? true : ["missing", "unverified"].includes(getNaverPriceTrust(product).status)))
    .filter((product) => product.sourcing_status !== "rejected" && product.sourcing_status !== "sold_out")
    .slice(0, Math.max(1, Math.min(100, options?.limit ?? 30)));

  let checked_count = 0;
  let updated_count = 0;
  let no_match_count = 0;
  let cleared_price_count = 0;
  let error_count = 0;
  const details: NaverPriceBackfillDetail[] = [];

  for (const product of targets) {
    checked_count += 1;
    const result = await findNaverLowestPrice(product);

    if (result.status === "API_NOT_CONFIGURED") {
      details.push({
        product_id: product.id,
        title: product.title,
        status: "API_NOT_CONFIGURED",
        reason: "NAVER_API_NOT_CONFIGURED",
        query: firstQuery(result.queries),
        queries: result.queries
      });
      return {
        status: "API_NOT_CONFIGURED" as const,
        target_count: targets.length,
        checked_count,
        updated_count,
        no_match_count,
        cleared_price_count,
        error_count,
        details
      };
    }

    if (result.best) {
      let updated: Awaited<ReturnType<typeof updateProduct>>;
      try {
        updated = await updateProduct(product.id, {
          naver_lowest_price: result.best.price,
          raw_json: {
            ...(product.raw_json ?? {}),
            naver_price_backfill: withNaverPriceFingerprint({
              status: "ok",
              query: result.best.query,
              price: result.best.price,
              matched_title: result.best.item.title,
              matched_url: result.best.item.link,
              mall_name: result.best.item.mallName,
              brand: result.best.item.brand,
              maker: result.best.item.maker,
              categories: [result.best.item.category1, result.best.item.category2, result.best.item.category3, result.best.item.category4].filter(Boolean),
              relevance: result.best.relevance,
              match: result.best.match ?? null,
              updated_at: new Date().toISOString()
            }, product)
          }
        });
      } catch (error) {
        error_count += 1;
        details.push({
          product_id: product.id,
          title: product.title,
          status: "error",
          reason: `NAVER_PRICE_BACKFILL_UPDATE_FAILED: ${backfillErrorMessage(error)}`,
          price: result.best.price,
          query: result.best.query
        });
        continue;
      }

      try {
        await createDealScore(calculateDealScore(updated));
      } catch (error) {
        error_count += 1;
        details.push({
          product_id: product.id,
          title: product.title,
          status: "error",
          reason: `NAVER_PRICE_BACKFILL_SCORE_FAILED: ${backfillErrorMessage(error)}`,
          price: result.best.price,
          query: result.best.query
        });
        updated_count += 1;
        continue;
      }

      updated_count += 1;
      details.push({
        product_id: product.id,
        title: product.title,
        status: "updated",
        price: result.best.price,
        query: result.best.query,
        matched_title: result.best.item.title,
        match: result.best.match
      });
      continue;
    }

    if (result.status === "error") error_count += 1;
    else no_match_count += 1;

    const shouldClearExistingPrice =
      options?.clearExistingOnNoMatch === true &&
      result.status === "no_match" &&
      product.naver_lowest_price != null;

    try {
      const updated = await updateProduct(product.id, {
        ...(shouldClearExistingPrice ? { naver_lowest_price: null } : {}),
        raw_json: {
          ...(product.raw_json ?? {}),
          naver_price_backfill: withNaverPriceFingerprint({
            status: result.status,
            queries: result.queries,
            errors: result.errors,
            match: result.match ?? null,
            updated_at: new Date().toISOString()
          }, product)
        }
      });
      if (shouldClearExistingPrice) {
        cleared_price_count += 1;
        await createDealScore(calculateDealScore(updated));
      }
    } catch (error) {
      error_count += 1;
      details.push({
        product_id: product.id,
        title: product.title,
        status: "error",
        reason: `NAVER_PRICE_BACKFILL_LOG_FAILED: ${backfillErrorMessage(error)}`
      });
      continue;
    }

    details.push({
      product_id: product.id,
      title: product.title,
      status: shouldClearExistingPrice ? "cleared_price" : result.status,
      reason: noMatchReason(result),
      query: firstQuery(result.queries),
      queries: result.queries,
      match: result.match
    });
  }

  return {
    status: error_count ? ("completed_with_errors" as const) : ("completed" as const),
    target_count: targets.length,
    checked_count,
    updated_count,
    no_match_count,
    cleared_price_count,
    error_count,
    details
  };
}
