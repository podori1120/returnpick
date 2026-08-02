import {
  getAffiliateIdentityReadiness,
  getExpectedCoupangProductIdentity,
  readAffiliateIdentityRecord
} from "@/lib/affiliateIdentity";
import {
  isApprovalSampleAffiliateUrl,
  isUsableAffiliateUrl,
  isUsableCoupangProductUrl
} from "@/lib/coupangLink";
import { isUsableProductImageUrl } from "@/lib/productImageUrl";
import { isDemoProduct, isPublicDealReady } from "@/lib/publicDeal";
import { calculateDealScore } from "@/lib/scoring";
import { getManualCatalogReviewAt, isFreshManualCatalogReview, isManualCatalogSource } from "@/lib/manualCatalogReview";
import type {
  Category,
  ConditionGrade,
  JsonValue,
  ProductWithScore,
  SourcedProduct
} from "@/lib/types";

const isSyntheticSource = isDemoProduct;

export const BOOTSTRAP_CATALOG_ENV = "RETURNPICK_BOOTSTRAP_CATALOG_JSON";
export const BOOTSTRAP_CATALOG_VERSION = 1;
export const BOOTSTRAP_CATALOG_MAX_PRODUCTS = 40;
export const BOOTSTRAP_CATALOG_MAX_BYTES = 28_000;

const categories = new Set<Category>([
  "laptop",
  "monitor",
  "robot_vacuum",
  "cordless_vacuum",
  "air_purifier",
  "dehumidifier"
]);
const conditionGrades = new Set<ConditionGrade>(["미개봉", "최상", "상", "중", "알수없음", "확인필요"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const rawJsonKeys = [
  "affiliate_verification",
  "naver_price_manual",
  "naver_price_backfill",
  "naver_price_lookup",
  "web_return_info",
  "manual_catalog_review"
] as const;

type BootstrapCatalogPayload = {
  version: 1;
  exported_at: string;
  products: SourcedProduct[];
};

export type BootstrapCatalogIssue = {
  index?: number;
  product_id?: string | null;
  code: string;
  message: string;
};

export type BootstrapCatalogReadResult = {
  configured: boolean;
  ok: boolean;
  byte_size: number;
  products: SourcedProduct[];
  exported_at: string | null;
  issues: BootstrapCatalogIssue[];
};

export type BootstrapCatalogExportResult = {
  status: "ready" | "empty" | "too_large";
  env_name: typeof BOOTSTRAP_CATALOG_ENV;
  env_value: string | null;
  byte_size: number;
  max_bytes: number;
  max_products: number;
  eligible_count: number;
  scanned_count: number;
  skipped_count: number;
  skipped_by_reason: Record<string, number>;
  product_ids: string[];
};

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textValue(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function nullableText(value: unknown, maxLength: number) {
  const text = textValue(value, maxLength);
  return text || null;
}

function nullableNumber(value: unknown, options: { integer?: boolean; min?: number } = {}) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < (options.min ?? 0)) return null;
  return options.integer ? Math.round(number) : number;
}

function validDateOrNull(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

function compactJsonRecord(value: unknown, maxBytes: number) {
  if (!isRecord(value)) return {};
  try {
    const serialized = JSON.stringify(value);
    return Buffer.byteLength(serialized, "utf8") <= maxBytes ? value : {};
  } catch {
    return {};
  }
}

function compactRawJson(value: unknown) {
  if (!isRecord(value)) return {};
  const compact: Record<string, JsonValue> = {};
  for (const key of rawJsonKeys) {
    if (value[key] !== undefined) compact[key] = value[key];
  }
  return compactJsonRecord(compact, 8_000);
}

function withCalculatedScore(product: SourcedProduct): ProductWithScore {
  const score = calculateDealScore(product);
  return {
    ...product,
    latest_score: score,
    deal_scores: [score]
  };
}

function normalizeProduct(value: unknown, index: number): { product: SourcedProduct | null; issues: BootstrapCatalogIssue[] } {
  if (!isRecord(value)) {
    return {
      product: null,
      issues: [{ index, code: "PRODUCT_RECORD_REQUIRED", message: "상품 레코드가 객체 형식이 아닙니다." }]
    };
  }

  const id = textValue(value.id, 80);
  const source = textValue(value.source, 80);
  const sourceProductId = nullableText(value.source_product_id, 180);
  const title = textValue(value.title, 300);
  const category = textValue(value.category, 40) as Category;
  const conditionGrade = textValue(value.condition_grade, 20) as ConditionGrade;
  const affiliateUrl = nullableText(value.affiliate_url, 2_000);
  const coupangUrl = nullableText(value.coupang_url, 2_000);
  const imageUrl = nullableText(value.image_url, 2_000);
  const rawJson = compactRawJson(value.raw_json);
  const issues: BootstrapCatalogIssue[] = [];
  const issue = (code: string, message: string) => issues.push({ index, product_id: id || null, code, message });

  if (!uuidPattern.test(id)) issue("PRODUCT_ID_INVALID", "상품 ID는 UUID 형식이어야 합니다.");
  if (!sourceProductId) issue("SOURCE_PRODUCT_ID_REQUIRED", "지속 가능한 상품 식별자가 없습니다.");
  if (title.length < 2) issue("TITLE_REQUIRED", "상품명이 비어 있습니다.");
  if (!categories.has(category)) issue("CATEGORY_INVALID", "지원하지 않는 카테고리입니다.");
  if (!conditionGrades.has(conditionGrade)) issue("CONDITION_GRADE_INVALID", "반품등급 값이 올바르지 않습니다.");
  if (!affiliateUrl || !isUsableAffiliateUrl(affiliateUrl) || isApprovalSampleAffiliateUrl(affiliateUrl)) {
    issue("AFFILIATE_URL_INVALID", "승인용 샘플이 아닌 상품별 쿠팡 파트너스 링크가 필요합니다.");
  }
  if (!coupangUrl || !isUsableCoupangProductUrl(coupangUrl)) {
    issue("COUPANG_PRODUCT_URL_REQUIRED", "상품번호를 확인할 수 있는 정확한 쿠팡 상품 URL이 필요합니다.");
  }
  if (!imageUrl || !isUsableProductImageUrl(imageUrl)) {
    issue("PRODUCT_IMAGE_INVALID", "공개 가능한 HTTPS 상품 이미지가 필요합니다.");
  }
  const automaticObservationAt = validDateOrNull(value.last_observed_at);
  const manualReviewAt = isManualCatalogSource(source) ? getManualCatalogReviewAt(rawJson) : null;
  if (!automaticObservationAt && !manualReviewAt) {
    issue("CATALOG_PROVENANCE_REQUIRED", "자동 수집 관측 시각 또는 관리자 수동 공개 검토 시각이 필요합니다.");
  } else if (!automaticObservationAt && manualReviewAt && !isFreshManualCatalogReview(rawJson)) {
    issue("MANUAL_CATALOG_REVIEW_STALE", "관리자 수동 공개 검토 시각이 7일을 넘어 다시 검수해야 합니다.");
  }

  const stamp = new Date().toISOString();
  const product: SourcedProduct = {
    id,
    source,
    source_product_id: sourceProductId,
    category,
    keyword: nullableText(value.keyword, 160),
    title,
    brand: nullableText(value.brand, 120),
    model_name: nullableText(value.model_name, 160),
    image_url: imageUrl,
    source_url: nullableText(value.source_url, 2_000),
    coupang_url: coupangUrl,
    affiliate_url: affiliateUrl,
    source_price: nullableNumber(value.source_price, { integer: true, min: 1 }),
    return_price: nullableNumber(value.return_price, { integer: true, min: 1 }),
    new_price: nullableNumber(value.new_price, { integer: true, min: 1 }),
    naver_lowest_price: nullableNumber(value.naver_lowest_price, { integer: true, min: 1 }),
    condition_grade: conditionGrade,
    stock_count: nullableNumber(value.stock_count, { integer: true, min: 0 }),
    spec_json: compactJsonRecord(value.spec_json, 6_000),
    raw_json: rawJson,
    sourcing_status: "published",
    is_published: true,
    is_rejected: false,
    rejection_reason: null,
    admin_memo: null,
    public_note: nullableText(value.public_note, 800),
    last_observed_at: validDateOrNull(value.last_observed_at),
    created_at: validDateOrNull(value.created_at) ?? stamp,
    updated_at: validDateOrNull(value.updated_at) ?? stamp
  };

  if (isSyntheticSource(product)) issue("SYNTHETIC_SOURCE_NOT_ALLOWED", "목업·데모 상품은 출시 카탈로그에 넣을 수 없습니다.");
  const identity = readAffiliateIdentityRecord(product);
  const expectedIdentity = getExpectedCoupangProductIdentity(product);
  const identityBoundToCurrentProduct = Boolean(
    identity &&
      expectedIdentity.productId &&
      identity.expected_product_id === expectedIdentity.productId &&
      (identity.status !== "MATCH" || identity.resolved_product_id === expectedIdentity.productId)
  );
  if (!getAffiliateIdentityReadiness(product).ready || !identityBoundToCurrentProduct) {
    issue("AFFILIATE_IDENTITY_NOT_VERIFIED", "파트너스 링크의 최종 상품번호 확인이 완료되지 않았습니다.");
  }
  if (!isPublicDealReady(withCalculatedScore(product))) {
    issue("PUBLIC_QUALITY_NOT_READY", "판매 가격·이미지·상품별 제휴 링크·목적지 확인을 포함한 공개 품질 기준을 통과하지 못했습니다. 반품가·등급 누락은 공개 경고로 처리됩니다.");
  }

  return { product: issues.length ? null : product, issues };
}

function compactProduct(product: ProductWithScore): SourcedProduct {
  return {
    id: product.id,
    source: product.source,
    source_product_id: product.source_product_id,
    category: product.category,
    keyword: nullableText(product.keyword, 160),
    title: product.title.trim().slice(0, 300),
    brand: nullableText(product.brand, 120),
    model_name: nullableText(product.model_name, 160),
    image_url: nullableText(product.image_url, 2_000),
    source_url: nullableText(product.source_url, 2_000),
    coupang_url: nullableText(product.coupang_url, 2_000),
    affiliate_url: nullableText(product.affiliate_url, 2_000),
    source_price: product.source_price,
    return_price: product.return_price,
    new_price: product.new_price,
    naver_lowest_price: product.naver_lowest_price,
    condition_grade: product.condition_grade,
    stock_count: product.stock_count,
    spec_json: compactJsonRecord(product.spec_json, 6_000),
    raw_json: compactRawJson(product.raw_json),
    sourcing_status: "published",
    is_published: true,
    is_rejected: false,
    rejection_reason: null,
    admin_memo: null,
    public_note: nullableText(product.public_note, 800),
    last_observed_at: validDateOrNull(product.last_observed_at),
    created_at: validDateOrNull(product.created_at) ?? new Date(0).toISOString(),
    updated_at: validDateOrNull(product.updated_at) ?? new Date(0).toISOString()
  };
}

function skipReason(product: ProductWithScore) {
  if (isSyntheticSource(product)) return "synthetic_source";
  if (!product.is_published || product.sourcing_status !== "published") return "not_published";
  if (!isUsableAffiliateUrl(product.affiliate_url) || isApprovalSampleAffiliateUrl(product.affiliate_url)) return "affiliate_link_missing";
  if (!getAffiliateIdentityReadiness(product).ready) return "affiliate_identity_unverified";
  if (!isPublicDealReady(product)) return "public_quality_blocked";
  return null;
}

function bootstrapPayload(products: SourcedProduct[], exportedAt: string): BootstrapCatalogPayload {
  return {
    version: BOOTSTRAP_CATALOG_VERSION,
    exported_at: exportedAt,
    products
  };
}

function bootstrapPayloadByteSize(products: SourcedProduct[], exportedAt: string) {
  return Buffer.byteLength(JSON.stringify(bootstrapPayload(products, exportedAt)), "utf8");
}

export function createBootstrapCatalog(products: ProductWithScore[], exportedAt = new Date().toISOString()): BootstrapCatalogExportResult {
  const skippedByReason: Record<string, number> = {};
  const eligible: SourcedProduct[] = [];
  let largestRejectedByteSize = 0;
  const sorted = [...products].sort((a, b) => (b.latest_score?.total_score ?? 0) - (a.latest_score?.total_score ?? 0));

  for (const product of sorted) {
    const reason = skipReason(product);
    if (reason) {
      skippedByReason[reason] = (skippedByReason[reason] ?? 0) + 1;
      continue;
    }
    if (eligible.length >= BOOTSTRAP_CATALOG_MAX_PRODUCTS) {
      skippedByReason.catalog_limit = (skippedByReason.catalog_limit ?? 0) + 1;
      continue;
    }

    const compact = compactProduct(product);
    const checked = normalizeProduct(compact, eligible.length);
    if (!checked.product) {
      const code = checked.issues[0]?.code.toLowerCase() ?? "validation_failed";
      skippedByReason[code] = (skippedByReason[code] ?? 0) + 1;
      continue;
    }

    const candidateByteSize = bootstrapPayloadByteSize([...eligible, checked.product], exportedAt);
    if (candidateByteSize > BOOTSTRAP_CATALOG_MAX_BYTES) {
      skippedByReason.catalog_size_limit = (skippedByReason.catalog_size_limit ?? 0) + 1;
      largestRejectedByteSize = Math.max(largestRejectedByteSize, candidateByteSize);
      continue;
    }
    eligible.push(checked.product);
  }

  if (!eligible.length) {
    return {
      status: largestRejectedByteSize > 0 ? "too_large" : "empty",
      env_name: BOOTSTRAP_CATALOG_ENV,
      env_value: null,
      byte_size: largestRejectedByteSize,
      max_bytes: BOOTSTRAP_CATALOG_MAX_BYTES,
      max_products: BOOTSTRAP_CATALOG_MAX_PRODUCTS,
      eligible_count: 0,
      scanned_count: products.length,
      skipped_count: products.length,
      skipped_by_reason: skippedByReason,
      product_ids: []
    };
  }

  const payload = bootstrapPayload(eligible, exportedAt);
  const envValue = JSON.stringify(payload);
  const byteSize = Buffer.byteLength(envValue, "utf8");

  return {
    status: byteSize <= BOOTSTRAP_CATALOG_MAX_BYTES ? "ready" : "too_large",
    env_name: BOOTSTRAP_CATALOG_ENV,
    env_value: byteSize <= BOOTSTRAP_CATALOG_MAX_BYTES ? envValue : null,
    byte_size: byteSize,
    max_bytes: BOOTSTRAP_CATALOG_MAX_BYTES,
    max_products: BOOTSTRAP_CATALOG_MAX_PRODUCTS,
    eligible_count: eligible.length,
    scanned_count: products.length,
    skipped_count: products.length - eligible.length,
    skipped_by_reason: skippedByReason,
    product_ids: eligible.map((product) => product.id)
  };
}

export function readBootstrapCatalog(value = process.env[BOOTSTRAP_CATALOG_ENV]): BootstrapCatalogReadResult {
  const raw = value?.trim() ?? "";
  if (!raw) {
    return { configured: false, ok: true, byte_size: 0, products: [], exported_at: null, issues: [] };
  }

  const byteSize = Buffer.byteLength(raw, "utf8");
  if (byteSize > BOOTSTRAP_CATALOG_MAX_BYTES) {
    return {
      configured: true,
      ok: false,
      byte_size: byteSize,
      products: [],
      exported_at: null,
      issues: [{ code: "CATALOG_TOO_LARGE", message: `출시 카탈로그가 ${BOOTSTRAP_CATALOG_MAX_BYTES}바이트 제한을 넘었습니다.` }]
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      configured: true,
      ok: false,
      byte_size: byteSize,
      products: [],
      exported_at: null,
      issues: [{ code: "CATALOG_JSON_INVALID", message: "출시 카탈로그 JSON을 읽을 수 없습니다." }]
    };
  }

  if (!isRecord(parsed) || parsed.version !== BOOTSTRAP_CATALOG_VERSION || !Array.isArray(parsed.products)) {
    return {
      configured: true,
      ok: false,
      byte_size: byteSize,
      products: [],
      exported_at: null,
      issues: [{ code: "CATALOG_FORMAT_INVALID", message: "지원하는 출시 카탈로그 형식이 아닙니다." }]
    };
  }

  const exportedAt = validDateOrNull(parsed.exported_at);
  const issues: BootstrapCatalogIssue[] = [];
  if (!exportedAt) issues.push({ code: "EXPORTED_AT_INVALID", message: "카탈로그 생성 시각이 올바르지 않습니다." });
  if (parsed.products.length > BOOTSTRAP_CATALOG_MAX_PRODUCTS) {
    issues.push({ code: "PRODUCT_LIMIT_EXCEEDED", message: `상품은 최대 ${BOOTSTRAP_CATALOG_MAX_PRODUCTS}개까지 넣을 수 있습니다.` });
  }

  const products: SourcedProduct[] = [];
  const ids = new Set<string>();
  const sourceKeys = new Set<string>();
  for (const [index, value] of parsed.products.slice(0, BOOTSTRAP_CATALOG_MAX_PRODUCTS).entries()) {
    const checked = normalizeProduct(value, index);
    issues.push(...checked.issues);
    if (!checked.product) continue;

    const sourceKey = `${checked.product.source.toLowerCase()}::${checked.product.source_product_id?.toLowerCase() ?? ""}`;
    if (ids.has(checked.product.id) || sourceKeys.has(sourceKey)) {
      issues.push({
        index,
        product_id: checked.product.id,
        code: "DUPLICATE_PRODUCT",
        message: "같은 상품 ID 또는 소스 상품 ID가 중복되었습니다."
      });
      continue;
    }
    ids.add(checked.product.id);
    sourceKeys.add(sourceKey);
    products.push(checked.product);
  }

  if (issues.length) {
    return { configured: true, ok: false, byte_size: byteSize, products: [], exported_at: exportedAt, issues };
  }

  return { configured: true, ok: true, byte_size: byteSize, products, exported_at: exportedAt, issues: [] };
}
