import { calculateDiscountRate } from "@/lib/format";
import { calculateDealScore } from "@/lib/scoring";
import { parseSpecsFromTitle } from "@/lib/specParser";
import {
  createDealScore,
  createSourcingRun,
  listKeywords,
  updateProduct,
  updateSourcingRun,
  upsertSourcedProduct
} from "@/lib/dataStore";
import { searchCoupangProducts } from "@/lib/providers/coupangPartnersProvider";
import { searchMockProducts } from "@/lib/providers/mockProvider";
import { searchNaverReturnCandidates } from "@/lib/providers/naverCandidateProvider";
import { getLowestPrice } from "@/lib/providers/naverShoppingProvider";
import { searchPublicWebProducts } from "@/lib/providers/publicWebProvider";
import type { ProviderProduct } from "@/lib/providers/types";
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
  const reference = product.naver_lowest_price ?? product.new_price ?? product.source_price;
  const deal = product.return_price ?? product.source_price;
  const discountRate = calculateDiscountRate(reference, deal);
  const meaningfulDiscount = discountRate != null && discountRate >= (minDiscountRate ?? 0.12);

  if (score.risk_flags.includes("RISK_BAD_PRICE_VS_NAVER") && score.total_score < 50) return "rejected";
  if (score.total_score >= 65 || meaningfulDiscount) return "needs_review";
  return "candidate";
}

function buildNaverQuery(product: ProviderProduct) {
  return [product.brand, product.model_name, product.title].filter(Boolean).join(" ").slice(0, 120);
}

async function enrichAndSaveProduct(product: ProviderProduct, keyword: SourcingKeyword) {
  const naverLowestPrice = await getLowestPrice(buildNaverQuery(product));
  const specJson = parseSpecsFromTitle(product.title, product.category);
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
    naver_lowest_price: naverLowestPrice,
    condition_grade: inferredCondition,
    return_price: inferredReturnPrice,
    stock_count: inferredStock,
    spec_json: specJson,
    raw_json: {
      ...(product.raw_json ?? {}),
      web_return_info: toReturnInfoJson(webReturnInfo),
      naver_lowest_price: naverLowestPrice
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

  const score = calculateDealScore(updated);
  await createDealScore(score);
  return { product: updated, inserted, score };
}

export async function runSourcing(options?: { useMockFallback?: boolean }) {
  const useMockFallback = options?.useMockFallback ?? true;
  const run = await createSourcingRun({ status: "running" });
  const logs: Array<Record<string, JsonValue>> = [];
  let foundCount = 0;
  let insertedCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  let errorMessage: string | null = null;

  try {
    const keywords = await listKeywords({ activeOnly: true });

    for (const keyword of keywords) {
      try {
        let result = await searchCoupangProducts(keyword.keyword, keyword.category);
        let provider = "coupang_partners";

        if (result.status === "API_NOT_CONFIGURED" || result.products.length === 0) {
          const naverResult = await searchNaverReturnCandidates(keyword.keyword, keyword.category);
          if (naverResult.status === "ok" && naverResult.products.length > 0) {
            result = naverResult;
            provider = "naver_shopping_candidate";
          }
        }

        if (result.status === "API_NOT_CONFIGURED" || result.status === "DISABLED" || result.products.length === 0) {
          const webResult = await searchPublicWebProducts(keyword.keyword, keyword.category);
          if (webResult.status === "ok" && webResult.products.length > 0) {
            result = webResult;
            provider = "public_web";
          } else if (webResult.status === "ROBOTS_DISALLOWED") {
            logs.push({
              keyword: keyword.keyword,
              category: keyword.category,
              provider: "public_web",
              status: "ROBOTS_DISALLOWED"
            });
          }
        }

        if ((result.status === "API_NOT_CONFIGURED" || result.status === "DISABLED" || result.status === "ROBOTS_DISALLOWED" || result.products.length === 0) && useMockFallback) {
          result = await searchMockProducts(keyword.keyword, keyword.category);
          provider = "mock";
        }

        if (result.status === "error") {
          errorCount += 1;
          logs.push({ keyword: keyword.keyword, category: keyword.category, status: result.status, error: result.error ?? null });
          continue;
        }

        const candidates = result.products.filter((product) => isWithinKeywordPrice(product, keyword));
        foundCount += candidates.length;

        for (const candidate of candidates) {
          try {
            const saved = await enrichAndSaveProduct(candidate, keyword);
            if (saved.inserted) insertedCount += 1;
            else updatedCount += 1;
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
          fetched: result.products.length,
          accepted: candidates.length
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
      status: errorCount > 0 ? "completed_with_errors" : "completed",
      finished_at: new Date().toISOString(),
      keyword_count: keywords.length,
      found_count: foundCount,
      inserted_count: insertedCount,
      updated_count: updatedCount,
      error_count: errorCount,
      error_message: errorMessage,
      log_json: { logs }
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "UNKNOWN_SOURCING_ERROR";
    return await updateSourcingRun(run.id, {
      status: "error",
      finished_at: new Date().toISOString(),
      found_count: foundCount,
      inserted_count: insertedCount,
      updated_count: updatedCount,
      error_count: errorCount + 1,
      error_message: errorMessage,
      log_json: { logs }
    });
  }
}
