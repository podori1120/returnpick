import type { JsonValue, ProductWithScore, SourcedProduct } from "@/lib/types";

export type AffiliateIdentityStatus =
  | "MATCH"
  | "MISMATCH"
  | "UNRESOLVED"
  | "EXPECTED_ID_UNAVAILABLE"
  | "MANUAL_CONFIRMED";

export type AffiliateIdentityRecord = {
  affiliate_url: string;
  status: AffiliateIdentityStatus;
  expected_product_id: string | null;
  expected_id_source: "coupang_url" | "source_url" | null;
  resolved_product_id: string | null;
  resolution_code: string;
  checked_at: string;
  method: "automatic" | "manual";
};

type ProductIdentitySource = Pick<SourcedProduct, "affiliate_url" | "coupang_url" | "source_url" | "raw_json">;

export function extractCoupangProductId(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !(url.hostname === "coupang.com" || url.hostname.endsWith(".coupang.com"))) return null;
    return url.pathname.match(/^\/vp\/products\/(\d+)(?:\/|$)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function getExpectedCoupangProductIdentity(product: Pick<ProductIdentitySource, "coupang_url" | "source_url">) {
  const coupangProductId = extractCoupangProductId(product.coupang_url);
  if (coupangProductId) return { productId: coupangProductId, source: "coupang_url" as const };
  const sourceProductId = extractCoupangProductId(product.source_url);
  if (sourceProductId) return { productId: sourceProductId, source: "source_url" as const };
  return { productId: null, source: null };
}

export function assessAffiliateIdentity(input: {
  product: Pick<ProductIdentitySource, "coupang_url" | "source_url">;
  affiliateUrl: string;
  resolvedProductId?: string | null;
  resolutionCode: string;
  checkedAt?: string;
}): AffiliateIdentityRecord {
  const expected = getExpectedCoupangProductIdentity(input.product);
  const resolvedProductId = input.resolvedProductId?.trim() || null;
  const status: AffiliateIdentityStatus = expected.productId
    ? resolvedProductId
      ? expected.productId === resolvedProductId
        ? "MATCH"
        : "MISMATCH"
      : "UNRESOLVED"
    : "EXPECTED_ID_UNAVAILABLE";

  return {
    affiliate_url: input.affiliateUrl.trim(),
    status,
    expected_product_id: expected.productId,
    expected_id_source: expected.source,
    resolved_product_id: resolvedProductId,
    resolution_code: input.resolutionCode,
    checked_at: input.checkedAt ?? new Date().toISOString(),
    method: "automatic"
  };
}

export function readAffiliateIdentityRecord(product: Pick<ProductIdentitySource, "raw_json">): AffiliateIdentityRecord | null {
  const value = product.raw_json?.affiliate_verification;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const status = value.status;
  const validStatuses: AffiliateIdentityStatus[] = ["MATCH", "MISMATCH", "UNRESOLVED", "EXPECTED_ID_UNAVAILABLE", "MANUAL_CONFIRMED"];
  if (typeof value.affiliate_url !== "string" || typeof status !== "string" || !validStatuses.includes(status as AffiliateIdentityStatus)) return null;

  return {
    affiliate_url: value.affiliate_url,
    status: status as AffiliateIdentityStatus,
    expected_product_id: typeof value.expected_product_id === "string" ? value.expected_product_id : null,
    expected_id_source: value.expected_id_source === "coupang_url" || value.expected_id_source === "source_url" ? value.expected_id_source : null,
    resolved_product_id: typeof value.resolved_product_id === "string" ? value.resolved_product_id : null,
    resolution_code: typeof value.resolution_code === "string" ? value.resolution_code : "UNKNOWN",
    checked_at: typeof value.checked_at === "string" ? value.checked_at : "",
    method: value.method === "manual" ? "manual" : "automatic"
  };
}

export function createManualAffiliateIdentityConfirmation(product: ProductIdentitySource, affiliateUrl: string, checkedAt = new Date().toISOString()) {
  const previous = readAffiliateIdentityRecord(product);
  const normalizedUrl = affiliateUrl.trim();
  if (previous?.affiliate_url === normalizedUrl && previous.status === "MISMATCH") return null;
  const expected = getExpectedCoupangProductIdentity(product);
  return {
    affiliate_url: normalizedUrl,
    status: "MANUAL_CONFIRMED",
    expected_product_id: expected.productId,
    expected_id_source: expected.source,
    resolved_product_id: previous?.affiliate_url === normalizedUrl ? previous.resolved_product_id : null,
    resolution_code: previous?.affiliate_url === normalizedUrl ? previous.resolution_code : "MANUAL_BROWSER_CONFIRMATION",
    checked_at: checkedAt,
    method: "manual"
  } satisfies AffiliateIdentityRecord;
}

export function mergeAffiliateIdentityRecord(product: Pick<ProductIdentitySource, "raw_json">, record: AffiliateIdentityRecord) {
  return {
    ...(product.raw_json ?? {}),
    affiliate_verification: record as unknown as JsonValue
  } satisfies SourcedProduct["raw_json"];
}

export function getAffiliateIdentityReadiness(product: Pick<ProductWithScore, "affiliate_url" | "raw_json">) {
  const affiliateUrl = product.affiliate_url?.trim() ?? "";
  const record = readAffiliateIdentityRecord(product);
  if (!affiliateUrl || !record || record.affiliate_url !== affiliateUrl) {
    return { ready: false, status: null, blocker: "파트너스 링크 상품 일치 확인 필요" } as const;
  }
  if (record.status === "MATCH" || record.status === "MANUAL_CONFIRMED") {
    return { ready: true, status: record.status, blocker: null } as const;
  }
  if (record.status === "MISMATCH") {
    return { ready: false, status: record.status, blocker: "파트너스 링크 상품번호 불일치" } as const;
  }
  return { ready: false, status: record.status, blocker: "파트너스 링크 수동 확인 필요" } as const;
}
