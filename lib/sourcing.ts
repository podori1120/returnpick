import { calculateDiscountRate } from "@/lib/format";
import { withNaverPriceFingerprint } from "@/lib/naverPriceTrust";
import { getPriceReferenceInfo } from "@/lib/priceReference";
import { calculateDealScore } from "@/lib/scoring";
import { parseSpecsFromTitle } from "@/lib/specParser";
import {
  createDealScore,
  createSourcingRun,
  ensureDefaultSourcingKeywords,
  listKeywords,
  updateProduct,
  updateSourcingRun,
  upsertSourcedProduct
} from "@/lib/dataStore";
import { isCoupangUrl, isUsableAffiliateUrl } from "@/lib/coupangLink";
import { createCoupangDeeplink, searchCoupangProducts } from "@/lib/providers/coupangPartnersProvider";
import { searchMockProducts } from "@/lib/providers/mockProvider";
import { searchNaverReturnCandidates } from "@/lib/providers/naverCandidateProvider";
import { getLowestPriceFromQueries } from "@/lib/providers/naverShoppingProvider";
import { searchPublicWebProducts } from "@/lib/providers/publicWebProvider";
import type { ProviderProduct, ProviderSearchResult } from "@/lib/providers/types";
import { mergeProviderProductBatches } from "@/lib/providerProductMerge";
import type { JsonValue, SourcedProduct, SourcingKeyword, SourcingStatus } from "@/lib/types";
import { extractReturnInfoFromText, toReturnInfoJson } from "@/lib/webReturnInfo";

function isWithinKeywordPrice(product: ProviderProduct, keyword: SourcingKeyword) {
  const price = product.return_price ?? product.source_price ?? product.new_price;
  if (!price) return true;
  if (keyword.min_price != null && price < keyword.min_price) return false;
  if (keyword.max_price != null && price > keyword.max_price) return false;
  return true;
}

function classifyProduct(product: SourcedProduct, minDiscountRate: number | null): SourcingStatus {
  const score = calculateDealScore(product);
  const reference = getPriceReferenceInfo(product).value;
  const deal = product.return_price ?? product.source_price ?? product.new_price;
  const discountRate = calculateDiscountRate(reference, deal);
  const meaningfulDiscount = discountRate != null && discountRate >= (minDiscountRate ?? 0.12);

  if (score.risk_flags.includes("RISK_BAD_PRICE_VS_NAVER") && score.total_score < 50) return "rejected";
  if (score.total_score >= 65 || meaningfulDiscount) return "needs_review";
  return "candidate";
}

type AffiliateEnrichment = {
  affiliateUrl: string | null;
  deeplinkLog: Record<string, JsonValue>;
};

type NaverPriceEnrichment = {
  price: number | null;
  priceLog: Record<string, JsonValue>;
};

export type RunSourcingOptions = {
  useMockFallback?: boolean;
  keywordLimit?: number | null;
  keywordOffset?: number | null;
  timeBudgetMs?: number | null;
};

const defaultSourcingTimeBudgetMs = 52000;
const minSourcingTimeBudgetMs = 5000;
const maxSourcingTimeBudgetMs = 55000;

function normalizePositiveInteger(value: number | null | undefined) {
  if (value == null) return null;
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeOffset(value: number | null | undefined, total: number) {
  if (!total) return 0;
  const parsed = Math.floor(Number(value ?? 0));
  if (!Number.isFinite(parsed)) return 0;
  return ((parsed % total) + total) % total;
}

function normalizeTimeBudgetMs(value: number | null | undefined) {
  const parsed = normalizePositiveInteger(value) ?? defaultSourcingTimeBudgetMs;
  return Math.max(minSourcingTimeBudgetMs, Math.min(maxSourcingTimeBudgetMs, parsed));
}

function cleanNaverTitle(value: string) {
  return value
    .replace(/반품|리퍼|중고|미개봉|최상|상급|상태|확인필요|알수없음|쿠팡|파트너스/gi, " ")
    .replace(/[()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function specTokens(specJson: Record<string, JsonValue>) {
  return ["ram", "ssd", "cpu", "gpu", "size", "resolution", "refresh_rate", "capacity", "coverage"]
    .map((key) => specJson[key])
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
    .map(String)
    .filter((value) => value.length > 1);
}

function buildNaverQueries(product: ProviderProduct, specJson: Record<string, JsonValue>) {
  const title = cleanNaverTitle(product.title);
  const specs = specTokens(specJson);
  const queries = [
    [product.brand, product.model_name].filter(Boolean).join(" "),
    [product.brand, product.model_name, ...specs.slice(0, 4)].filter(Boolean).join(" "),
    title,
    [product.brand, title].filter(Boolean).join(" "),
    product.title
  ];

  return Array.from(
    new Set(
      queries
        .map((query) => query.replace(/\s+/g, " ").trim())
        .filter((query) => query.length >= 2)
        .map((query) => query.slice(0, 120))
    )
  ).slice(0, 5);
}

function buildNaverRelevanceTokens(product: ProviderProduct, specJson: Record<string, JsonValue>) {
  const titleTokens = cleanNaverTitle(product.title)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 8);

  return Array.from(
    new Set(
      [product.brand, product.model_name, ...specTokens(specJson), ...titleTokens]
        .filter((value): value is string => typeof value === "string")
        .map(String)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
    )
  ).slice(0, 18);
}

async function enrichAffiliateUrl(product: ProviderProduct): Promise<AffiliateEnrichment> {
  if (isUsableAffiliateUrl(product.affiliate_url)) {
    return {
      affiliateUrl: product.affiliate_url ?? null,
      deeplinkLog: {
        status: "provided",
        source_url: product.affiliate_url ?? null
      }
    };
  }

  const originalUrl = [product.coupang_url, product.source_url].find((url) => isCoupangUrl(url)) ?? null;
  if (!originalUrl) {
    return {
      affiliateUrl: product.affiliate_url ?? null,
      deeplinkLog: {
        status: "not_applicable",
        source_url: product.source_url ?? product.coupang_url ?? null
      }
    };
  }

  const result = await createCoupangDeeplink(originalUrl);
  if (result.status === "ok" && result.url) {
    return {
      affiliateUrl: result.url,
      deeplinkLog: {
        status: "created",
        source_url: originalUrl,
        affiliate_url: result.url
      }
    };
  }

  return {
    affiliateUrl: product.affiliate_url ?? null,
    deeplinkLog: {
      status: result.status,
      source_url: originalUrl,
      error: result.status === "error" ? result.error ?? "COUPANG_DEEPLINK_ERROR" : null
    }
  };
}

async function enrichNaverLowestPrice(product: ProviderProduct, specJson: Record<string, JsonValue>): Promise<NaverPriceEnrichment> {
  const queries = buildNaverQueries(product, specJson);
  const relevanceTokens = buildNaverRelevanceTokens(product, specJson);
  const result = await getLowestPriceFromQueries(queries, {
    relevanceTokens,
    product: {
      category: product.category,
      title: product.title,
      brand: product.brand,
      model_name: product.model_name,
      spec_json: specJson
    }
  });

  return {
    price: result.price,
    priceLog: withNaverPriceFingerprint({
      status: result.status,
      queries,
      relevance_tokens: relevanceTokens,
      selected_query: result.query,
      price: result.price,
      matched_title: result.item?.title ?? null,
      matched_url: result.item?.link ?? null,
      mall_name: result.item?.mallName ?? null,
      brand: result.item?.brand ?? null,
      maker: result.item?.maker ?? null,
      categories: result.item
        ? [result.item.category1, result.item.category2, result.item.category3, result.item.category4].filter(Boolean)
        : [],
      match: result.match ?? null,
      errors: result.errors,
      updated_at: new Date().toISOString()
    }, {
      category: product.category,
      title: product.title,
      brand: product.brand ?? null,
      model_name: product.model_name ?? null,
      spec_json: specJson
    })
  };
}

async function enrichAndSaveProduct(product: ProviderProduct, keyword: SourcingKeyword) {
  const specJson = parseSpecsFromTitle(product.title, product.category);
  const [naverPrice, affiliate] = await Promise.all([enrichNaverLowestPrice(product, specJson), enrichAffiliateUrl(product)]);
  const webReturnInfo = extractReturnInfoFromText(
    product.title,
    product.raw_json?.web_return_info ? JSON.stringify(product.raw_json.web_return_info) : null
  );
  const inferredCondition = product.condition_grade ?? webReturnInfo.condition_grade ?? "확인필요";
  const inferredReturnPrice = product.return_price ?? webReturnInfo.return_price ?? (webReturnInfo.isReturnCandidate ? product.source_price ?? null : null);
  const inferredStock = product.stock_count ?? webReturnInfo.stock_count ?? null;

  const { product: saved, inserted } = await upsertSourcedProduct({
    ...product,
    keyword: keyword.keyword,
    affiliate_url: affiliate.affiliateUrl,
    naver_lowest_price: naverPrice.price,
    condition_grade: inferredCondition,
    return_price: inferredReturnPrice,
    stock_count: inferredStock,
    spec_json: specJson,
    raw_json: {
      ...(product.raw_json ?? {}),
      web_return_info: toReturnInfoJson(webReturnInfo),
      naver_lowest_price: naverPrice.price,
      naver_price_lookup: naverPrice.priceLog,
      coupang_deeplink: affiliate.deeplinkLog
    },
    sourcing_status: "candidate",
    is_published: false,
    is_rejected: false
  });

  const status =
    saved.sourcing_status === "published" || saved.sourcing_status === "approved"
      ? saved.sourcing_status
      : classifyProduct(saved, keyword.min_discount_rate);
  const updated = await updateProduct(saved.id, {
    sourcing_status: status,
    is_rejected: status === "rejected",
    rejection_reason: status === "rejected" ? "네이버 최저가 대비 가격 매력이 낮습니다." : null
  });

  try {
    const score = calculateDealScore(updated);
    await createDealScore(score);
    return { product: updated, inserted, score, scoreError: null };
  } catch (error) {
    return {
      product: updated,
      inserted,
      score: null,
      scoreError: error instanceof Error && error.message ? error.message.slice(0, 300) : "SOURCING_SCORE_SAVE_FAILED"
    };
  }
}

export async function runSourcing(options?: RunSourcingOptions) {
  const startedAt = Date.now();
  const useMockFallback = options?.useMockFallback ?? true;
  const keywordLimit = normalizePositiveInteger(options?.keywordLimit);
  const requestedKeywordOffset = options?.keywordOffset ?? 0;
  const timeBudgetMs = normalizeTimeBudgetMs(options?.timeBudgetMs);
  const run = await createSourcingRun({ status: "running" });
  const logs: Array<Record<string, JsonValue>> = [];
  let foundCount = 0;
  let insertedCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  let errorMessage: string | null = null;
  let activeKeywordCount = 0;
  let targetKeywordCount = 0;
  let processedKeywordCount = 0;
  let keywordStartOffset = 0;
  let nextKeywordOffset = 0;
  let stoppedByTimeBudget = false;

  try {
    const defaultKeywordSeed = await ensureDefaultSourcingKeywords();
    if (defaultKeywordSeed.inserted_count > 0) {
      logs.push({
        status: "default_keywords_seeded",
        inserted_count: defaultKeywordSeed.inserted_count
      });
    }

    const activeKeywords = await listKeywords({ activeOnly: true });
    activeKeywordCount = activeKeywords.length;
    keywordStartOffset = normalizeOffset(requestedKeywordOffset, activeKeywordCount);
    nextKeywordOffset = keywordStartOffset;
    const orderedKeywords = keywordStartOffset
      ? [...activeKeywords.slice(keywordStartOffset), ...activeKeywords.slice(0, keywordStartOffset)]
      : activeKeywords;
    const keywords = keywordLimit ? orderedKeywords.slice(0, keywordLimit) : orderedKeywords;
    targetKeywordCount = keywords.length;
    if (keywordStartOffset > 0) {
      logs.push({
        status: "keyword_offset_applied",
        keyword_start_offset: keywordStartOffset,
        active_keyword_count: activeKeywordCount
      });
    }
    if (keywordLimit && activeKeywordCount > targetKeywordCount) {
      logs.push({
        status: "keyword_limit_applied",
        keyword_limit: keywordLimit,
        active_keyword_count: activeKeywordCount,
        target_keyword_count: targetKeywordCount
      });
    }

    for (const keyword of keywords) {
      if (Date.now() - startedAt >= timeBudgetMs) {
        stoppedByTimeBudget = true;
        logs.push({
          status: "time_budget_reached",
          time_budget_ms: timeBudgetMs,
          elapsed_ms: Date.now() - startedAt,
          active_keyword_count: activeKeywordCount,
          keyword_start_offset: keywordStartOffset,
          next_keyword_offset: nextKeywordOffset,
          processed_keyword_count: processedKeywordCount,
          remaining_keyword_count: targetKeywordCount - processedKeywordCount
        });
        break;
      }
      processedKeywordCount += 1;
      nextKeywordOffset = activeKeywordCount ? (keywordStartOffset + processedKeywordCount) % activeKeywordCount : 0;
      try {
        let result = await searchCoupangProducts(keyword.keyword, keyword.category);
        let provider = "coupang_partners";
        const providerIssues: Array<Record<string, JsonValue>> = [];
        const providerContributions: Array<Record<string, JsonValue>> = [];

        const recordProviderResult = (source: string, sourceResult: ProviderSearchResult) => {
          providerContributions.push({
            provider: source,
            status: sourceResult.status,
            fetched: sourceResult.products.length,
            provider_meta: sourceResult.meta ?? null
          });
          if (sourceResult.status !== "error") return;
          errorCount += 1;
          const issue = {
            provider: source,
            provider_status: sourceResult.status,
            error: sourceResult.error ?? null,
            provider_meta: sourceResult.meta ?? null
          };
          providerIssues.push(issue);
          logs.push({
            keyword: keyword.keyword,
            category: keyword.category,
            status: "provider_error",
            ...issue
          });
        };

        recordProviderResult("coupang_partners", result);

        if (result.status === "API_NOT_CONFIGURED" || result.status === "error" || result.products.length === 0) {
          const naverResult = await searchNaverReturnCandidates(keyword.keyword, keyword.category);
          recordProviderResult("naver_shopping_candidate", naverResult);
          if (naverResult.status === "ok" && naverResult.products.length > 0) {
            result = naverResult;
            provider = "naver_shopping_candidate";
          }
        }

        const webResult = await searchPublicWebProducts(keyword.keyword, keyword.category);
        recordProviderResult("public_web", webResult);
        if (webResult.status === "ok" && webResult.products.length > 0) {
          const primaryProvider = provider;
          const primaryStatus = result.status;
          const primaryMeta = result.meta ?? null;
          const merged = mergeProviderProductBatches([
            { provider: primaryProvider, products: result.products },
            { provider: "public_web", products: webResult.products }
          ]);
          result = {
            status: "ok",
            products: merged.products,
            meta: {
              ...(webResult.meta ?? {}),
              primary_provider: primaryProvider,
              primary_status: primaryStatus,
              primary_meta: primaryMeta,
              supplemental_public_web_status: webResult.status,
              supplemental_public_web_meta: webResult.meta ?? null,
              merged_fetched_count: merged.fetchedCount,
              merged_deduplicated_count: merged.deduplicatedCount
            }
          };
          provider = merged.providers.join("+") || "public_web";
        } else if (
          [
            "ROBOTS_DISALLOWED",
            "ROBOTS_UNAVAILABLE",
            "INVALID_TEMPLATE",
            "UNSUPPORTED_CONTENT_TYPE",
            "CONTENT_TOO_LARGE",
            "REDIRECT_BLOCKED",
            "CRAWL_DELAY_TOO_HIGH"
          ].includes(webResult.status)
        ) {
          logs.push({
            keyword: keyword.keyword,
            category: keyword.category,
            provider: "public_web",
            status: webResult.status,
            error: webResult.error ?? null,
            provider_meta: webResult.meta ?? null
          });
        }

        if (
          (result.status === "API_NOT_CONFIGURED" ||
            result.status === "DISABLED" ||
            result.status === "ROBOTS_DISALLOWED" ||
            result.status === "CRAWL_DELAY_TOO_HIGH" ||
            result.status === "error" ||
            result.products.length === 0) &&
          useMockFallback
        ) {
          result = await searchMockProducts(keyword.keyword, keyword.category);
          provider = "mock";
          recordProviderResult("mock", result);
        }

        if (result.status === "error") {
          if (!providerIssues.length) errorCount += 1;
          logs.push({
            keyword: keyword.keyword,
            category: keyword.category,
            provider,
            status: result.status,
            error: result.error ?? null,
            provider_issues: providerIssues
          });
          continue;
        }

        const candidates = result.products.filter((product) => isWithinKeywordPrice(product, keyword));
        foundCount += candidates.length;

        for (const candidate of candidates) {
          try {
            const saved = await enrichAndSaveProduct(candidate, keyword);
            if (saved.inserted) insertedCount += 1;
            else updatedCount += 1;
            if (saved.scoreError) {
              errorCount += 1;
              logs.push({
                keyword: keyword.keyword,
                category: keyword.category,
                title: candidate.title,
                status: "product_score_error",
                error: saved.scoreError
              });
            }
          } catch (error) {
            errorCount += 1;
            logs.push({
              keyword: keyword.keyword,
              title: candidate.title,
              status: "product_error",
              error: error instanceof Error ? error.message : "UNKNOWN_PRODUCT_ERROR"
            });
          }
        }

        logs.push({
          keyword: keyword.keyword,
          category: keyword.category,
          provider,
          provider_status: result.status,
          fetched: result.products.length,
          accepted: candidates.length,
          provider_meta: result.meta ?? null,
          provider_contributions: providerContributions,
          provider_issues: providerIssues
        });
      } catch (error) {
        errorCount += 1;
        logs.push({
          keyword: keyword.keyword,
          category: keyword.category,
          status: "keyword_error",
          error: error instanceof Error ? error.message : "UNKNOWN_KEYWORD_ERROR"
        });
      }
    }

    return await updateSourcingRun(run.id, {
      status: stoppedByTimeBudget ? (errorCount > 0 ? "completed_partial_with_errors" : "completed_partial") : errorCount > 0 ? "completed_with_errors" : "completed",
      finished_at: new Date().toISOString(),
      keyword_count: processedKeywordCount,
      found_count: foundCount,
      inserted_count: insertedCount,
      updated_count: updatedCount,
      error_count: errorCount,
      error_message: errorMessage,
      log_json: {
        logs,
        active_keyword_count: activeKeywordCount,
        target_keyword_count: targetKeywordCount,
        processed_keyword_count: processedKeywordCount,
        keyword_start_offset: keywordStartOffset,
        next_keyword_offset: nextKeywordOffset,
        stopped_by_time_budget: stoppedByTimeBudget,
        time_budget_ms: timeBudgetMs,
        elapsed_ms: Date.now() - startedAt,
        use_mock_fallback: useMockFallback
      }
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "UNKNOWN_SOURCING_ERROR";
    return await updateSourcingRun(run.id, {
      status: "error",
      finished_at: new Date().toISOString(),
      keyword_count: processedKeywordCount,
      found_count: foundCount,
      inserted_count: insertedCount,
      updated_count: updatedCount,
      error_count: errorCount + 1,
      error_message: errorMessage,
      log_json: {
        logs,
        active_keyword_count: activeKeywordCount,
        target_keyword_count: targetKeywordCount,
        processed_keyword_count: processedKeywordCount,
        keyword_start_offset: keywordStartOffset,
        next_keyword_offset: nextKeywordOffset,
        stopped_by_time_budget: stoppedByTimeBudget,
        time_budget_ms: timeBudgetMs,
        elapsed_ms: Date.now() - startedAt,
        use_mock_fallback: useMockFallback
      }
    });
  }
}
