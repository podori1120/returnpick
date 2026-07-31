import { stripHtml, toNumberOrNull } from "@/lib/format";
import {
  matchNaverProductSku,
  shouldPreferNaverSkuCandidate,
  type NaverMatchProduct,
  type NaverSkuMatchEvidence
} from "@/lib/naverProductMatch";

export interface NaverShoppingItem {
  title: string;
  link: string | null;
  image: string | null;
  lprice: number | null;
  mallName: string | null;
  brand: string | null;
  maker: string | null;
  category1: string | null;
  category2: string | null;
  category3: string | null;
  category4: string | null;
}

export type NaverShoppingSearchResult = {
  status: "ok" | "API_NOT_CONFIGURED" | "error";
  items: NaverShoppingItem[];
  error?: string;
  meta?: {
    query: string;
    items_path: "items" | null;
    api_total: number | null;
    api_start: number | null;
    api_display: number | null;
    raw_item_count: number;
    normalized_item_count: number;
    priced_item_count: number;
    sort: "sim";
    display_limit: number;
  };
};

export type NaverLowestPriceResult = {
  status: "ok" | "API_NOT_CONFIGURED" | "error" | "no_match";
  price: number | null;
  query: string | null;
  item: NaverShoppingItem | null;
  errors: string[];
  match?: {
    relevance_score: number;
    matched_tokens: string[];
    priced_item_count: number;
    relevance_candidate_count: number;
    rejected_by_relevance_count: number;
    sku_confidence: NaverSkuMatchEvidence["confidence"] | null;
    sku_score: number;
    sku_reason_code: string | null;
    sku_matched_signals: string[];
    sku_conflict_signals: string[];
    sku_missing_signals: string[];
    sku_rejected_count: number;
    sku_rejection_reasons: Record<string, number>;
  };
};

type NaverLowestPriceOptions = {
  relevanceTokens?: Array<string | number | null | undefined>;
  minRelevance?: number;
  product?: NaverMatchProduct;
};

function envText(name: string) {
  return process.env[name]?.trim() ?? "";
}

function getNaverCredentials() {
  return {
    clientId: envText("NAVER_CLIENT_ID"),
    clientSecret: envText("NAVER_CLIENT_SECRET")
  };
}

function isConfigured() {
  const { clientId, clientSecret } = getNaverCredentials();
  return Boolean(clientId && clientSecret);
}

function compactErrorText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 240) : null;
}

function naverErrorMessage(payload: Record<string, unknown>) {
  return (
    compactErrorText(payload.errorMessage) ??
    compactErrorText(payload.message) ??
    compactErrorText(payload.error_description) ??
    compactErrorText(payload.error) ??
    compactErrorText(payload.errorCode) ??
    compactErrorText(payload.raw_text)
  );
}

async function responsePayload(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw_text: text.slice(0, 500) };
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchNaverShopping(query: string): Promise<NaverShoppingSearchResult> {
  if (!isConfigured()) return { status: "API_NOT_CONFIGURED", items: [] };

  const { clientId, clientSecret } = getNaverCredentials();
  const params = new URLSearchParams({
    query,
    display: "10",
    sort: "sim"
  });

  try {
    const response = await fetchWithTimeout(`https://openapi.naver.com/v1/search/shop.json?${params.toString()}`, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret
      },
      cache: "no-store"
    });

    const payload = await responsePayload(response);
    if (!response.ok) {
      const detail = naverErrorMessage(payload);
      return { status: "error", items: [], error: detail ? `NAVER_HTTP_${response.status}: ${detail}` : `NAVER_HTTP_${response.status}` };
    }
    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const items = rawItems.map((item) => {
      const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return {
        title: stripHtml(String(record.title ?? "")),
        link: typeof record.link === "string" ? record.link : null,
        image: typeof record.image === "string" ? record.image : null,
        lprice: toNumberOrNull(record.lprice),
        mallName: typeof record.mallName === "string" ? record.mallName : null,
        brand: typeof record.brand === "string" ? record.brand : null,
        maker: typeof record.maker === "string" ? record.maker : null,
        category1: typeof record.category1 === "string" ? record.category1 : null,
        category2: typeof record.category2 === "string" ? record.category2 : null,
        category3: typeof record.category3 === "string" ? record.category3 : null,
        category4: typeof record.category4 === "string" ? record.category4 : null
      };
    });

    return {
      status: "ok",
      items,
      meta: {
        query,
        items_path: Array.isArray(payload.items) ? "items" : null,
        api_total: toNumberOrNull(payload.total),
        api_start: toNumberOrNull(payload.start),
        api_display: toNumberOrNull(payload.display),
        raw_item_count: rawItems.length,
        normalized_item_count: items.length,
        priced_item_count: items.filter((item) => typeof item.lprice === "number" && item.lprice > 0).length,
        sort: "sim",
        display_limit: 10
      }
    };
  } catch (error) {
    return { status: "error", items: [], error: error instanceof Error ? error.message : "NAVER_UNKNOWN_ERROR" };
  }
}

export async function getLowestPrice(query: string) {
  const result = await getLowestPriceFromQueries([query]);
  return result.price;
}

function normalizeMatchToken(value: string | number | null | undefined) {
  const raw = String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (raw.length < 2) return "";
  return raw;
}

function uniqueMatchTokens(values: Array<string | number | null | undefined>) {
  return Array.from(new Set(values.map(normalizeMatchToken).filter(Boolean))).slice(0, 18);
}

function itemSearchText(item: NaverShoppingItem) {
  return [item.title, item.brand, item.maker, item.mallName, item.category1, item.category2, item.category3, item.category4]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

function itemRelevance(item: NaverShoppingItem, relevanceTokens: string[]) {
  if (!relevanceTokens.length) return { score: 1, matchedTokens: [] as string[] };
  const haystack = itemSearchText(item);
  const matchedTokens = relevanceTokens.filter((token) => haystack.includes(token));
  return { score: matchedTokens.length, matchedTokens };
}

export async function getLowestPriceFromQueries(queries: string[], options: NaverLowestPriceOptions = {}): Promise<NaverLowestPriceResult> {
  const normalizedQueries = Array.from(
    new Set(
      queries
        .map((query) => query.replace(/\s+/g, " ").trim())
        .filter((query) => query.length >= 2)
        .map((query) => query.slice(0, 120))
    )
  );
  if (!normalizedQueries.length) return { status: "no_match", price: null, query: null, item: null, errors: [] };

  const relevanceTokens = uniqueMatchTokens(options.relevanceTokens ?? []);
  const minRelevance = relevanceTokens.length ? Math.max(1, Math.min(4, options.minRelevance ?? Math.min(2, relevanceTokens.length))) : 0;
  let sawOk = false;
  const errors: string[] = [];
  let pricedItemCount = 0;
  let relevanceCandidateCount = 0;
  let rejectedByRelevanceCount = 0;
  let skuRejectedCount = 0;
  const skuRejectionReasons: Record<string, number> = {};
  let best: {
    price: number;
    query: string;
    item: NaverShoppingItem;
    relevanceScore: number;
    matchedTokens: string[];
    sku: NaverSkuMatchEvidence | null;
  } | null = null;

  for (const query of normalizedQueries) {
    const result = await searchNaverShopping(query);
    if (result.status === "API_NOT_CONFIGURED") {
      return { status: "API_NOT_CONFIGURED", price: null, query: null, item: null, errors };
    }
    if (result.status === "error") {
      errors.push(`${query}: ${result.error ?? "NAVER_ERROR"}`);
      continue;
    }

    sawOk = true;
    for (const item of result.items) {
      const price = item.lprice;
      if (!price || price <= 0) continue;
      pricedItemCount += 1;
      const relevance = itemRelevance(item, relevanceTokens);
      const sku = options.product ? matchNaverProductSku(options.product, item) : null;
      if (sku && !sku.accepted) {
        skuRejectedCount += 1;
        skuRejectionReasons[sku.reason_code] = (skuRejectionReasons[sku.reason_code] ?? 0) + 1;
        continue;
      }
      if (!sku && relevance.score < minRelevance) {
        rejectedByRelevanceCount += 1;
        continue;
      }
      relevanceCandidateCount += 1;
      const candidate = { price, query, item, relevanceScore: relevance.score, matchedTokens: relevance.matchedTokens, sku };
      const shouldReplace = options.product
        ? shouldPreferNaverSkuCandidate(
            { price, relevanceScore: relevance.score, sku: sku as NaverSkuMatchEvidence },
            best?.sku ? { price: best.price, relevanceScore: best.relevanceScore, sku: best.sku } : null
          )
        : !best || price < best.price;
      if (shouldReplace) {
        best = candidate;
      }
    }
  }

  const match = {
    relevance_score: best?.relevanceScore ?? 0,
    matched_tokens: best?.matchedTokens.slice(0, 10) ?? [],
    priced_item_count: pricedItemCount,
    relevance_candidate_count: relevanceCandidateCount,
    rejected_by_relevance_count: rejectedByRelevanceCount,
    sku_confidence: best?.sku?.confidence ?? null,
    sku_score: best?.sku?.score ?? 0,
    sku_reason_code: best?.sku?.reason_code ?? null,
    sku_matched_signals: best?.sku?.matched_signals.slice(0, 12) ?? [],
    sku_conflict_signals: best?.sku?.conflict_signals.slice(0, 8) ?? [],
    sku_missing_signals: best?.sku?.missing_signals.slice(0, 8) ?? [],
    sku_rejected_count: skuRejectedCount,
    sku_rejection_reasons: skuRejectionReasons
  };

  if (best) {
    return {
      status: "ok",
      price: best.price,
      query: best.query,
      item: best.item,
      errors,
      match
    };
  }
  return { status: sawOk ? "no_match" : "error", price: null, query: null, item: null, errors, match };
}
