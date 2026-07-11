import { buildCoupangSearchUrl, cleanCoupangSearchQuery, isUsableAffiliateUrl, isUsableCoupangProductUrl } from "@/lib/coupangLink";
import { listProducts, updateProduct } from "@/lib/dataStore";
import { createCoupangDeeplink, searchCoupangProducts } from "@/lib/providers/coupangPartnersProvider";
import type { ProductWithScore, SourcedProduct } from "@/lib/types";
import type { ProviderProduct } from "@/lib/providers/types";

type BackfillItemStatus = "updated" | "dry_run" | "skipped" | "error";

type AffiliateBackfillMatch = {
  relevance_score: number;
  min_relevance: number;
  matched_tokens: string[];
  candidate_count: number;
  url_candidate_count: number;
  relevance_candidate_count: number;
  rejected_by_relevance_count: number;
};

export type AffiliateBackfillItem = {
  product_id: string;
  title: string;
  status: BackfillItemStatus;
  reason?: string;
  query?: string | null;
  source_url?: string | null;
  manual_search_url?: string | null;
  affiliate_url?: string | null;
  matched_title?: string | null;
  match?: AffiliateBackfillMatch | null;
};

export type AffiliateBackfillResult = {
  status: "ok" | "API_NOT_CONFIGURED" | "partial" | "error";
  scanned_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  dry_run: boolean;
  items: AffiliateBackfillItem[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function candidateProductUrls(product: ProductWithScore) {
  return [product.coupang_url, product.source_url].filter((url): url is string => isUsableCoupangProductUrl(url));
}

function mergeBackfillRawJson(product: ProductWithScore, detail: Record<string, unknown>): SourcedProduct["raw_json"] {
  const raw = asRecord(product.raw_json);
  return {
    ...raw,
    affiliate_backfill: {
      ...asRecord(raw.affiliate_backfill),
      ...detail,
      checked_at: new Date().toISOString()
    }
  } as SourcedProduct["raw_json"];
}

function backfillErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_AFFILIATE_BACKFILL_UPDATE_ERROR";
}

function combineBackfillReasons(...reasons: Array<string | null | undefined>) {
  const reason = reasons
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item))
    .join(" | ");
  return reason ? reason.slice(0, 300) : undefined;
}

function directDeeplinkFailureReason(status: string, reason?: string | null) {
  return combineBackfillReasons(`DIRECT_DEEPLINK_FAILED: ${reason || status}`);
}

function normalizeAffiliateMatchToken(value: string | number | null | undefined) {
  const raw = String(value ?? "")
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/[()[\]{}'"`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (raw.length < 2) return "";
  return raw;
}

function compactToken(value: string) {
  return value.replace(/\s+/g, "");
}

function addSpecValues(value: unknown, output: Array<string | number>) {
  if (typeof value === "string" || typeof value === "number") {
    output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) addSpecValues(item, output);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) addSpecValues(item, output);
  }
}

function titleMatchTokens(title: string) {
  const normalized = normalizeAffiliateMatchToken(title);
  const tokens = normalized.split(" ").filter((token) => token.length >= 2 && token.length <= 30);
  const specLikeTokens = normalized.match(/(?:rtx\s?\d{4}|ryzen\s?\d|ultra\s?\d|i[3579]|\d+\s?(?:gb|tb|hz|w|l)|[a-z]{1,8}[- ]?\d[a-z0-9-]{1,18})/gi) ?? [];
  return [...tokens, ...specLikeTokens.map((token) => normalizeAffiliateMatchToken(token))];
}

function uniqueAffiliateMatchTokens(values: Array<string | number | null | undefined>) {
  const tokens = values
    .map(normalizeAffiliateMatchToken)
    .filter(Boolean)
    .flatMap((token) => {
      const compact = compactToken(token);
      return compact && compact !== token ? [token, compact] : [token];
    });
  return Array.from(new Set(tokens)).slice(0, 24);
}

function buildAffiliateBackfillRelevanceTokens(product: ProductWithScore) {
  const values: Array<string | number | null | undefined> = [product.brand, product.model_name, product.keyword];
  const specValues: Array<string | number> = [];
  addSpecValues(product.spec_json, specValues);
  values.push(...specValues);
  values.push(...titleMatchTokens(cleanCoupangSearchQuery(product) || product.title));
  return uniqueAffiliateMatchTokens(values);
}

type AffiliateCandidateProduct = Pick<ProviderProduct, "title" | "brand" | "model_name" | "keyword" | "affiliate_url" | "coupang_url" | "source_url">;

function affiliateCandidateSearchText(item: AffiliateCandidateProduct) {
  return [item.title, item.brand, item.model_name, item.keyword]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

function affiliateItemRelevance(item: AffiliateCandidateProduct, relevanceTokens: string[]) {
  if (!relevanceTokens.length) return { score: 1, matchedTokens: [] as string[] };
  const haystack = affiliateCandidateSearchText(item);
  const matchedTokens = relevanceTokens.filter((token) => haystack.includes(token) || haystack.replace(/\s+/g, "").includes(compactToken(token)));
  return { score: matchedTokens.length, matchedTokens };
}

function hasConvertibleCoupangLink(item: AffiliateCandidateProduct) {
  return isUsableAffiliateUrl(item.affiliate_url) || isUsableCoupangProductUrl(item.coupang_url) || isUsableCoupangProductUrl(item.source_url);
}

function matchEvidence(params: {
  relevanceTokens: string[];
  minRelevance: number;
  candidateCount: number;
  urlCandidateCount: number;
  relevanceCandidateCount: number;
  rejectedByRelevanceCount: number;
  relevanceScore?: number;
  matchedTokens?: string[];
}): AffiliateBackfillMatch {
  return {
    relevance_score: params.relevanceScore ?? 0,
    min_relevance: params.minRelevance,
    matched_tokens: (params.matchedTokens ?? []).slice(0, 10),
    candidate_count: params.candidateCount,
    url_candidate_count: params.urlCandidateCount,
    relevance_candidate_count: params.relevanceCandidateCount,
    rejected_by_relevance_count: params.rejectedByRelevanceCount
  };
}

async function resolveAffiliateLink(product: ProductWithScore) {
  const query = cleanCoupangSearchQuery(product) || product.title;
  const manualSearchUrl = buildCoupangSearchUrl(product);
  const relevanceTokens = buildAffiliateBackfillRelevanceTokens(product);
  const minRelevance = relevanceTokens.length ? Math.min(2, relevanceTokens.length) : 0;
  const directProductUrl = candidateProductUrls(product)[0];
  let directFailureReason: string | undefined;
  if (directProductUrl) {
    const deeplink = await createCoupangDeeplink(directProductUrl);
    if (deeplink.status === "ok" && isUsableAffiliateUrl(deeplink.url)) {
      return {
        status: deeplink.status,
        affiliateUrl: deeplink.url,
        query,
        sourceUrl: directProductUrl,
        manualSearchUrl,
        matchedTitle: product.title,
        match: null,
        reason: undefined
      };
    }
    if (deeplink.status === "API_NOT_CONFIGURED") {
      return {
        status: deeplink.status,
        affiliateUrl: deeplink.url,
        query,
        sourceUrl: directProductUrl,
        manualSearchUrl,
        matchedTitle: product.title,
        match: null,
        reason: deeplink.error
      };
    }
    directFailureReason = directDeeplinkFailureReason(deeplink.status, deeplink.error ?? (deeplink.url ? "NO_USABLE_PARTNERS_URL" : null));
  }

  const search = await searchCoupangProducts(query, product.category);
  if (search.status !== "ok") {
    return {
      status: search.status,
      affiliateUrl: null,
      query,
      sourceUrl: directProductUrl ?? manualSearchUrl,
      manualSearchUrl,
      matchedTitle: null,
      match: null,
      reason: combineBackfillReasons(directFailureReason, search.error ?? search.status)
    };
  }

  const candidates = search.products
    .map((item, index) => ({
      item,
      index,
      convertible: hasConvertibleCoupangLink(item),
      relevance: affiliateItemRelevance(item, relevanceTokens)
    }))
    .filter((candidate) => candidate.convertible);
  const rankedCandidates = candidates
    .filter((candidate) => candidate.relevance.score >= minRelevance)
    .sort((a, b) => b.relevance.score - a.relevance.score || a.index - b.index);
  const matchedCandidate = rankedCandidates[0] ?? null;
  const bestRejectedCandidate = candidates
    .filter((candidate) => candidate.relevance.score < minRelevance)
    .sort((a, b) => b.relevance.score - a.relevance.score || a.index - b.index)[0] ?? null;
  const match = matchEvidence({
    relevanceTokens,
    minRelevance,
    candidateCount: search.products.length,
    urlCandidateCount: candidates.length,
    relevanceCandidateCount: rankedCandidates.length,
    rejectedByRelevanceCount: candidates.length - rankedCandidates.length,
    relevanceScore: matchedCandidate?.relevance.score ?? bestRejectedCandidate?.relevance.score ?? 0,
    matchedTokens: matchedCandidate?.relevance.matchedTokens ?? bestRejectedCandidate?.relevance.matchedTokens ?? []
  });

  if (!matchedCandidate) {
    const hasUrlCandidate = candidates.length > 0;
    return {
      status: hasUrlCandidate ? "MATCH_RELEVANCE_TOO_LOW" : "NO_MATCH",
      affiliateUrl: null,
      query,
      sourceUrl: directProductUrl ?? manualSearchUrl,
      manualSearchUrl,
      matchedTitle: bestRejectedCandidate?.item.title ?? null,
      match,
      reason: combineBackfillReasons(
        directFailureReason,
        hasUrlCandidate
          ? "COUPANG_MATCH_RELEVANCE_TOO_LOW: search results had Coupang URLs, but none matched enough product tokens."
          : "Coupang search returned no product URL that can be converted into a product-level Partners link."
      )
    };
  }

  const matched = matchedCandidate.item;
  if (isUsableAffiliateUrl(matched.affiliate_url)) {
    return {
      status: "ok",
      affiliateUrl: matched.affiliate_url,
      query,
      sourceUrl: matched.coupang_url ?? matched.source_url ?? directProductUrl ?? null,
      manualSearchUrl,
      matchedTitle: matched.title,
      match,
      reason: undefined
    };
  }

  const productUrl = [matched.coupang_url, matched.source_url].find((url) => isUsableCoupangProductUrl(url)) ?? null;
  if (!productUrl) {
    return {
      status: "NO_PRODUCT_URL",
      affiliateUrl: null,
      query,
      sourceUrl: directProductUrl ?? manualSearchUrl,
      manualSearchUrl,
      matchedTitle: matched.title,
      match,
      reason: combineBackfillReasons(directFailureReason, "Matched product did not include a usable Coupang product URL.")
    };
  }

  const deeplink = await createCoupangDeeplink(productUrl);
  return {
    status: deeplink.status,
    affiliateUrl: deeplink.url,
    query,
    sourceUrl: productUrl,
    manualSearchUrl,
    matchedTitle: matched.title,
    match,
    reason: deeplink.status === "ok" ? undefined : combineBackfillReasons(directFailureReason, deeplink.error ?? deeplink.status)
  };
}

export async function backfillCoupangAffiliateLinks(options?: { limit?: number; dryRun?: boolean }) {
  const limit = Math.min(Math.max(Number(options?.limit ?? 20), 1), 80);
  const dryRun = Boolean(options?.dryRun);
  const products = await listProducts();
  const targets = products
    .filter((product) => !isUsableAffiliateUrl(product.affiliate_url))
    .sort((a, b) => {
      const aPublished = a.is_published || a.sourcing_status === "published" ? 1 : 0;
      const bPublished = b.is_published || b.sourcing_status === "published" ? 1 : 0;
      return bPublished - aPublished || (b.latest_score?.total_score ?? 0) - (a.latest_score?.total_score ?? 0);
    })
    .slice(0, limit);

  const result: AffiliateBackfillResult = {
    status: "ok",
    scanned_count: 0,
    updated_count: 0,
    skipped_count: 0,
    error_count: 0,
    dry_run: dryRun,
    items: []
  };

  for (const product of targets) {
    result.scanned_count += 1;
    const resolved = await resolveAffiliateLink(product);
    if (resolved.status === "API_NOT_CONFIGURED") {
      result.status = "API_NOT_CONFIGURED";
      result.skipped_count += 1;
      result.items.push({
        product_id: product.id,
        title: product.title,
        status: "skipped",
        reason: "COUPANG_API_NOT_CONFIGURED",
        query: resolved.query,
        source_url: resolved.sourceUrl,
        manual_search_url: resolved.manualSearchUrl,
        matched_title: resolved.matchedTitle,
        match: resolved.match ?? null
      });
      break;
    }

    if (!isUsableAffiliateUrl(resolved.affiliateUrl)) {
      const isError = resolved.status === "error";
      if (isError) result.error_count += 1;
      else result.skipped_count += 1;
      result.items.push({
        product_id: product.id,
        title: product.title,
        status: isError ? "error" : "skipped",
        reason: resolved.reason ?? resolved.status,
        query: resolved.query,
        source_url: resolved.sourceUrl,
        manual_search_url: resolved.manualSearchUrl,
        matched_title: resolved.matchedTitle,
        match: resolved.match ?? null
      });
      continue;
    }

    if (!dryRun) {
      try {
        await updateProduct(product.id, {
          affiliate_url: resolved.affiliateUrl,
          coupang_url: resolved.sourceUrl ?? product.coupang_url,
          source_url: product.source_url ?? resolved.sourceUrl ?? null,
          raw_json: mergeBackfillRawJson(product, {
            status: "ok",
            query: resolved.query,
            source_url: resolved.sourceUrl ?? null,
            manual_search_url: resolved.manualSearchUrl ?? null,
            affiliate_url: resolved.affiliateUrl,
            matched_title: resolved.matchedTitle ?? null,
            relevance_tokens: buildAffiliateBackfillRelevanceTokens(product),
            match: resolved.match ?? null
          })
        });
      } catch (error) {
        result.error_count += 1;
        result.items.push({
          product_id: product.id,
          title: product.title,
          status: "error",
          reason: `AFFILIATE_BACKFILL_UPDATE_FAILED: ${backfillErrorMessage(error)}`,
          query: resolved.query,
          source_url: resolved.sourceUrl,
          manual_search_url: resolved.manualSearchUrl,
          affiliate_url: resolved.affiliateUrl,
          matched_title: resolved.matchedTitle,
          match: resolved.match ?? null
        });
        continue;
      }
    }

    result.updated_count += dryRun ? 0 : 1;
    result.items.push({
      product_id: product.id,
      title: product.title,
      status: dryRun ? "dry_run" : "updated",
      query: resolved.query,
      source_url: resolved.sourceUrl,
      manual_search_url: resolved.manualSearchUrl,
      affiliate_url: resolved.affiliateUrl,
      matched_title: resolved.matchedTitle,
      match: resolved.match ?? null
    });
  }

  if (result.status === "ok" && result.error_count > 0) result.status = result.updated_count > 0 ? "partial" : "error";
  return result;
}
