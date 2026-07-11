import { calculateDealScore } from "@/lib/scoring";
import { createDealScore, listProducts, updateProduct } from "@/lib/dataStore";
import { searchNaverShopping, type NaverShoppingItem } from "@/lib/providers/naverShoppingProvider";
import type { ProductWithScore } from "@/lib/types";

type NaverPriceBackfillDetail = {
  product_id: string;
  title: string;
  status: string;
  price?: number;
  query?: string;
  queries?: string[];
  reason?: string;
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

function relevance(product: ProductWithScore, item: NaverShoppingItem) {
  const haystack = `${item.title} ${item.brand ?? ""} ${item.maker ?? ""}`.toLowerCase();
  const tokens = specTokens(product)
    .concat(cleanTitle(product.title).split(/\s+/))
    .map((token) => token.toLowerCase())
    .filter((token) => token.length >= 2)
    .slice(0, 14);
  if (!tokens.length) return 0;
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

async function findNaverLowestPrice(product: ProductWithScore) {
  const queries = buildNaverPriceQueries(product);
  let apiStatus: "ok" | "API_NOT_CONFIGURED" | "error" | "no_match" = "no_match";
  let best: { price: number; query: string; item: NaverShoppingItem; relevance: number } | null = null;
  const errors: string[] = [];

  for (const query of queries) {
    const result = await searchNaverShopping(query);
    if (result.status === "API_NOT_CONFIGURED") return { status: "API_NOT_CONFIGURED" as const, queries, best: null, errors };
    if (result.status === "error") {
      apiStatus = "error";
      errors.push(result.error ?? "NAVER_ERROR");
      continue;
    }

    apiStatus = "ok";
    const ranked = result.items
      .filter((item) => typeof item.lprice === "number" && item.lprice > 0)
      .map((item) => ({ item, relevance: relevance(product, item) }))
      .filter((item) => item.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance || (a.item.lprice ?? 0) - (b.item.lprice ?? 0));

    for (const candidate of ranked.slice(0, 5)) {
      const price = candidate.item.lprice;
      if (!price) continue;
      if (!best || price < best.price) {
        best = { price, query, item: candidate.item, relevance: candidate.relevance };
      }
    }
  }

  return { status: best ? ("ok" as const) : apiStatus, queries, best, errors };
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
  return "NO_RELEVANT_PRICED_MATCH";
}

export async function backfillNaverLowestPrices(options?: { publishedOnly?: boolean; onlyMissing?: boolean; limit?: number }) {
  const products = await listProducts(options?.publishedOnly ? { published: true } : undefined);
  const targets = products
    .filter((product) => (options?.onlyMissing === false ? true : !product.naver_lowest_price))
    .filter((product) => product.sourcing_status !== "rejected" && product.sourcing_status !== "sold_out")
    .slice(0, Math.max(1, Math.min(100, options?.limit ?? 30)));

  let checked_count = 0;
  let updated_count = 0;
  let no_match_count = 0;
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
            naver_price_backfill: {
              status: "ok",
              query: result.best.query,
              price: result.best.price,
              matched_title: result.best.item.title,
              mall_name: result.best.item.mallName,
              relevance: result.best.relevance,
              updated_at: new Date().toISOString()
            }
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
      details.push({ product_id: product.id, title: product.title, status: "updated", price: result.best.price, query: result.best.query });
      continue;
    }

    if (result.status === "error") error_count += 1;
    else no_match_count += 1;

    try {
      await updateProduct(product.id, {
        raw_json: {
          ...(product.raw_json ?? {}),
          naver_price_backfill: {
            status: result.status,
            queries: result.queries,
            errors: result.errors,
            updated_at: new Date().toISOString()
          }
        }
      });
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
      status: result.status,
      reason: noMatchReason(result),
      query: firstQuery(result.queries),
      queries: result.queries
    });
  }

  return {
    status: error_count ? ("completed_with_errors" as const) : ("completed" as const),
    target_count: targets.length,
    checked_count,
    updated_count,
    no_match_count,
    error_count,
    details
  };
}
