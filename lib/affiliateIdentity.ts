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

const identityTimestampPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;
const productIdPattern = /^\d+$/;

function validIdentityTimestamp(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  const match = normalized.match(identityTimestampPattern);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , offsetText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetMatch = offsetText === "Z" ? null : offsetText.match(/^[+-](\d{2}):(\d{2})$/);
  const offsetHour = offsetMatch ? Number(offsetMatch[1]) : 0;
  const offsetMinute = offsetMatch ? Number(offsetMatch[2]) : 0;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    (offsetMatch && (offsetHour > 23 || offsetMinute > 59)) ||
    !Number.isFinite(Date.parse(normalized))
  ) return null;
  return normalized;
}

function validProductId(value: unknown) {
  return typeof value === "string" && productIdPattern.test(value.trim()) ? value.trim() : null;
}

export function extractCoupangProductId(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !(url.hostname === "coupang.com" || url.hostname.endsWith(".coupang.com"))
    ) return null;
    return url.pathname.match(/^\/vp\/products\/(\d+)\/?$/)?.[1] ?? null;
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
  const resolvedProductId = expected.productId ? validProductId(input.resolvedProductId) ?? null : null;
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
  const affiliateUrl = typeof value.affiliate_url === "string" && value.affiliate_url.trim() ? value.affiliate_url.trim() : null;
  if (!affiliateUrl || typeof status !== "string" || !validStatuses.includes(status as AffiliateIdentityStatus)) return null;

  const expectedProductId =
    value.expected_product_id === null
      ? null
      : validProductId(value.expected_product_id)
        ? validProductId(value.expected_product_id)
        : undefined;
  const expectedIdSource =
    value.expected_id_source === null
      ? null
      : value.expected_id_source === "coupang_url" || value.expected_id_source === "source_url"
        ? value.expected_id_source
        : undefined;
  const resolvedProductId =
    value.resolved_product_id === null
      ? null
      : validProductId(value.resolved_product_id)
        ? validProductId(value.resolved_product_id)
        : undefined;
  const resolutionCode = typeof value.resolution_code === "string" && value.resolution_code.trim() ? value.resolution_code.trim() : null;
  const checkedAt = validIdentityTimestamp(value.checked_at);
  const method = value.method === "automatic" || value.method === "manual" ? value.method : null;

  const statusInvariant =
    status === "MATCH"
      ? Boolean(expectedProductId && expectedIdSource && resolvedProductId === expectedProductId)
      : status === "MISMATCH"
        ? Boolean(expectedProductId && expectedIdSource && resolvedProductId && resolvedProductId !== expectedProductId)
        : status === "UNRESOLVED"
          ? Boolean(expectedProductId && expectedIdSource && resolvedProductId === null)
          : status === "EXPECTED_ID_UNAVAILABLE"
            ? expectedProductId === null && expectedIdSource === null && resolvedProductId === null
            : Boolean(expectedProductId && expectedIdSource && (resolvedProductId === null || resolvedProductId === expectedProductId));

  if (
    expectedProductId === undefined ||
    expectedIdSource === undefined ||
    resolvedProductId === undefined ||
    !resolutionCode ||
    !checkedAt ||
    !method ||
    (status === "MANUAL_CONFIRMED" ? method !== "manual" : method !== "automatic") ||
    (expectedProductId === null) !== (expectedIdSource === null) ||
    !statusInvariant
  ) return null;

  return {
    affiliate_url: affiliateUrl,
    status: status as AffiliateIdentityStatus,
    expected_product_id: expectedProductId,
    expected_id_source: expectedIdSource,
    resolved_product_id: resolvedProductId,
    resolution_code: resolutionCode,
    checked_at: checkedAt,
    method
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

export function getAffiliateIdentityReadiness(
  product: Pick<ProductWithScore, "affiliate_url" | "raw_json" | "coupang_url" | "source_url">
) {
  const affiliateUrl = product.affiliate_url?.trim() ?? "";
  const record = readAffiliateIdentityRecord(product);
  if (!affiliateUrl || !record || record.affiliate_url !== affiliateUrl) {
    return { ready: false, status: null, blocker: "파트너스 링크 상품 일치 확인 필요" } as const;
  }
  const expected = getExpectedCoupangProductIdentity(product);
  if (!expected.productId || !expected.source) {
    return { ready: false, status: record.status, blocker: "쿠팡 상품번호 확인이 필요합니다" } as const;
  }
  if (
    record.expected_product_id !== expected.productId ||
    record.expected_id_source !== expected.source ||
    (record.status === "MATCH" && record.resolved_product_id !== expected.productId) ||
    (record.status === "MANUAL_CONFIRMED" && record.resolved_product_id !== null && record.resolved_product_id !== expected.productId)
  ) {
    return { ready: false, status: record.status, blocker: "파트너스 링크 상품번호 확인이 오래됐습니다" } as const;
  }
  if (record.status === "MATCH" || record.status === "MANUAL_CONFIRMED") {
    return { ready: true, status: record.status, blocker: null } as const;
  }
  if (record.status === "MISMATCH") {
    return { ready: false, status: record.status, blocker: "파트너스 링크 상품번호 불일치" } as const;
  }
  return { ready: false, status: record.status, blocker: "파트너스 링크 수동 확인 필요" } as const;
}
