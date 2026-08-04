import { createHash } from "node:crypto";
import { getAffiliateIdentityReadiness, extractCoupangProductId } from "@/lib/affiliateIdentity";
import { createManualCatalogReview } from "@/lib/manualCatalogReview";
import { isApprovalSampleAffiliateUrl, isUsableAffiliateUrl, isUsableCoupangProductUrl } from "@/lib/coupangLink";
import { isUsableManualProductImageUrl } from "@/lib/productImageUrl";
import { createBootstrapCatalog, type BootstrapCatalogExportResult, type BootstrapCatalogIssue } from "@/lib/bootstrapCatalog";
import { getCustomerPublishReadiness } from "@/lib/quality";
import { calculateDealScore } from "@/lib/scoring";
import { parseSpecsFromTitle } from "@/lib/specParser";
import { isCategory } from "@/lib/validators";
import type { Category, ConditionGrade, JsonValue, ProductWithScore, SourcedProduct } from "@/lib/types";

export const MANUAL_BOOTSTRAP_MAX_ROWS = 20;
export const MANUAL_BOOTSTRAP_MAX_BODY_BYTES = 64_000;
export const MANUAL_BOOTSTRAP_FIELD_ORDER = [
  "상품명",
  "카테고리",
  "쿠팡 상품 URL",
  "상품별 파트너스 링크",
  "브랜드",
  "모델명",
  "이미지 URL",
  "수집 당시 가격",
  "반품가",
  "새상품가",
  "네이버 최저가",
  "반품등급",
  "재고 수량",
  "공개 메모"
] as const;

const manualTextFieldLimits = {
  title: 300,
  category: 40,
  coupang_url: 2_000,
  affiliate_url: 2_000,
  brand: 120,
  model_name: 160,
  image_url: 2_000,
  condition_grade: 20,
  public_note: 800
} as const;

const manualNumericFields = new Set(["source_price", "return_price", "new_price", "naver_lowest_price", "stock_count"]);
const manualFieldNames = new Set([
  ...Object.keys(manualTextFieldLimits),
  ...manualNumericFields
]);

export type ManualBootstrapRow = {
  title?: unknown;
  category?: unknown;
  coupang_url?: unknown;
  affiliate_url?: unknown;
  brand?: unknown;
  model_name?: unknown;
  image_url?: unknown;
  source_price?: unknown;
  return_price?: unknown;
  new_price?: unknown;
  naver_lowest_price?: unknown;
  condition_grade?: unknown;
  stock_count?: unknown;
  public_note?: unknown;
};

export type ManualBootstrapResult = Omit<BootstrapCatalogExportResult, "status"> & {
  status: BootstrapCatalogExportResult["status"] | "invalid";
  issues: BootstrapCatalogIssue[];
  manual_row_count: number;
};

const conditionGrades = new Set<ConditionGrade>(["미개봉", "최상", "상", "중", "알수없음", "확인필요"]);

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(value: unknown) {
  const valueText = text(value);
  return valueText || null;
}

function positiveInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  const number = Number(value.trim());
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function nonNegativeInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  const number = Number(value.trim());
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function stableUuid(sourceProductId: string) {
  const digest = createHash("sha256").update(`returnpick:manual-bootstrap:${sourceProductId}`).digest("hex");
  const variant = ((Number.parseInt(digest[16] ?? "8", 16) & 0x3) | 0x8).toString(16);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-${variant}${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

function issue(index: number, code: string, message: string, productId: string | null = null): BootstrapCatalogIssue {
  return { index, product_id: productId, code, message };
}

function validateManualRowShape(row: ManualBootstrapRow, index: number) {
  const issues: BootstrapCatalogIssue[] = [];
  for (const key of Object.keys(row)) {
    if (!manualFieldNames.has(key)) {
      issues.push(issue(index, "FIELD_NOT_ALLOWED", `지원하지 않는 입력 열입니다: ${key.slice(0, 80)}`));
    }
  }

  for (const [key, maxLength] of Object.entries(manualTextFieldLimits)) {
    const value = row[key as keyof ManualBootstrapRow];
    if (value === null || value === undefined) continue;
    if (typeof value !== "string") {
      issues.push(issue(index, "FIELD_TYPE_INVALID", `${key}는 문자열이어야 합니다.`));
    } else if (value.length > maxLength) {
      issues.push(issue(index, "FIELD_TOO_LONG", `${key}는 ${maxLength}자 이하로 입력하세요.`));
    }
  }

  for (const key of manualNumericFields) {
    const value = row[key as keyof ManualBootstrapRow];
    if (value === null || value === undefined || value === "") continue;
    if (typeof value !== "string" && typeof value !== "number") {
      issues.push(issue(index, "FIELD_TYPE_INVALID", `${key}는 숫자 또는 숫자 문자열이어야 합니다.`));
    } else if (typeof value === "string" && value.length > 40) {
      issues.push(issue(index, "FIELD_TOO_LONG", `${key}는 40자 이하로 입력하세요.`));
    } else if (typeof value === "number" && !Number.isFinite(value)) {
      issues.push(issue(index, "FIELD_TYPE_INVALID", `${key}는 유한한 숫자여야 합니다.`));
    }
  }
  return issues;
}

function normalizeAffiliateKey(value: string) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

function rawJsonRecord(identity: ProductWithScore["raw_json"], reviewedAt: string) {
  return createManualCatalogReview(
    {
      ...identity,
      provider: "manual_admin"
    },
    reviewedAt
  ) satisfies Record<string, JsonValue>;
}

function buildProduct(
  row: ManualBootstrapRow,
  index: number,
  reviewedAt: string,
  seenSourceIds: Set<string>,
  seenAffiliateKeys: Set<string>
) {
  const shapeIssues = validateManualRowShape(row, index);
  if (shapeIssues.length) return { product: null, issues: shapeIssues };

  const title = text(row.title);
  const category = text(row.category) as Category;
  const coupangUrl = text(row.coupang_url);
  const affiliateUrl = text(row.affiliate_url);
  const imageUrl = text(row.image_url);
  const sourceProductId = extractCoupangProductId(coupangUrl);
  const affiliateKey = normalizeAffiliateKey(affiliateUrl);
  const issues: BootstrapCatalogIssue[] = [];

  if (title.length < 5) issues.push(issue(index, "TITLE_REQUIRED", "상품명은 5자 이상 입력하세요."));
  if (!isCategory(category)) issues.push(issue(index, "CATEGORY_INVALID", "지원하는 카테고리를 입력하세요."));
  if (!isUsableCoupangProductUrl(coupangUrl) || !sourceProductId) {
    issues.push(issue(index, "COUPANG_PRODUCT_URL_REQUIRED", "상품번호를 확인할 수 있는 정확한 쿠팡 상품 URL이 필요합니다."));
  }
  if (!isUsableAffiliateUrl(affiliateUrl) || isApprovalSampleAffiliateUrl(affiliateUrl)) {
    issues.push(issue(index, "AFFILIATE_URL_INVALID", "승인용 샘플이 아닌 상품별 쿠팡 파트너스 링크가 필요합니다."));
  }
  if (!isUsableManualProductImageUrl(imageUrl)) issues.push(issue(index, "PRODUCT_IMAGE_INVALID", "쿠팡 또는 네이버 상품 이미지 CDN의 공개 HTTPS 이미지가 필요합니다."));

  const sourcePrice = positiveInteger(row.source_price);
  const returnPrice = positiveInteger(row.return_price);
  const newPrice = positiveInteger(row.new_price);
  const naverLowestPrice = positiveInteger(row.naver_lowest_price);
  const stockCount = nonNegativeInteger(row.stock_count);
  const suppliedPriceFields = [row.source_price, row.return_price, row.new_price, row.naver_lowest_price].filter(
    (value) => value !== null && value !== undefined && String(value).trim() !== ""
  );
  if (suppliedPriceFields.some((value) => positiveInteger(value) === null)) {
    issues.push(issue(index, "PRICE_INVALID", "가격은 1원 이상의 정수로 입력하세요."));
  }
  if (!sourcePrice && !returnPrice && !newPrice) issues.push(issue(index, "PRICE_REQUIRED", "현재 판매가·반품가·새상품가 중 하나는 필요합니다."));
  if (row.stock_count !== null && row.stock_count !== undefined && String(row.stock_count).trim() !== "" && stockCount === null) {
    issues.push(issue(index, "STOCK_INVALID", "재고는 0 이상의 정수로 입력하세요."));
  }
  if (row.condition_grade && !conditionGrades.has(text(row.condition_grade) as ConditionGrade)) {
    issues.push(issue(index, "CONDITION_GRADE_INVALID", "반품등급 값이 올바르지 않습니다."));
  }
  if (!sourceProductId || seenSourceIds.has(sourceProductId)) {
    if (sourceProductId && seenSourceIds.has(sourceProductId)) issues.push(issue(index, "DUPLICATE_PRODUCT", "같은 쿠팡 상품번호가 입력되었습니다.", sourceProductId));
  }
  if (affiliateKey && seenAffiliateKeys.has(affiliateKey)) {
    issues.push(issue(index, "DUPLICATE_AFFILIATE_LINK", "같은 상품별 파트너스 링크를 여러 상품에 사용할 수 없습니다.", sourceProductId));
  }

  if (issues.length || !sourceProductId || !isCategory(category)) return { product: null, issues };
  seenSourceIds.add(sourceProductId);
  if (affiliateKey) seenAffiliateKeys.add(affiliateKey);

  const identity = {
    affiliate_url: affiliateUrl,
    status: "MANUAL_CONFIRMED",
    expected_product_id: sourceProductId,
    expected_id_source: "coupang_url",
    resolved_product_id: null,
    resolution_code: "MANUAL_BROWSER_CONFIRMATION",
    checked_at: reviewedAt,
    method: "manual"
  } satisfies JsonValue;
  const rawJson = rawJsonRecord({ affiliate_verification: identity }, reviewedAt);
  const product: SourcedProduct = {
    id: stableUuid(sourceProductId),
    source: "manual_admin",
    source_product_id: sourceProductId,
    category,
    keyword: null,
    title,
    brand: nullableText(row.brand),
    model_name: nullableText(row.model_name),
    image_url: imageUrl,
    source_url: coupangUrl,
    coupang_url: coupangUrl,
    affiliate_url: affiliateUrl,
    source_price: sourcePrice,
    return_price: returnPrice,
    new_price: newPrice,
    naver_lowest_price: naverLowestPrice,
    condition_grade: (text(row.condition_grade) || "확인필요") as ConditionGrade,
    stock_count: stockCount,
    spec_json: parseSpecsFromTitle(title, category),
    raw_json: rawJson,
    sourcing_status: "published",
    is_published: true,
    is_rejected: false,
    rejection_reason: null,
    admin_memo: null,
    public_note: nullableText(row.public_note) ?? "상품번호와 파트너스 목적지를 확인한 수동 검수 상품입니다. 가격·재고·배송은 쿠팡에서 최종 확인하세요.",
    last_observed_at: null,
    created_at: reviewedAt,
    updated_at: reviewedAt
  };
  const score = calculateDealScore(product);
  const productWithScore: ProductWithScore = { ...product, latest_score: score, deal_scores: [score] };
  const identityReadiness = getAffiliateIdentityReadiness(productWithScore);
  if (!identityReadiness.ready) return { product: null, issues: [issue(index, "AFFILIATE_IDENTITY_NOT_VERIFIED", identityReadiness.blocker ?? "파트너스 링크 확인이 필요합니다.", sourceProductId)] };
  const publicReadiness = getCustomerPublishReadiness(productWithScore);
  if (!publicReadiness.ready) {
    return { product: null, issues: [issue(index, "PUBLIC_QUALITY_NOT_READY", `공개 품질 기준을 통과하지 못했습니다: ${publicReadiness.blockers.slice(0, 4).join(", ")}`, sourceProductId)] };
  }
  return { product: productWithScore, issues: [] };
}

export function createManualBootstrapCatalog(
  rows: ManualBootstrapRow[],
  manualIdentityConfirmed: boolean,
  reviewedAt = new Date().toISOString()
): ManualBootstrapResult {
  const emptyResult = {
    env_name: "RETURNPICK_BOOTSTRAP_CATALOG_JSON" as const,
    env_value: null,
    byte_size: 0,
    max_bytes: 28_000,
    max_products: 40,
    eligible_count: 0,
    scanned_count: rows.length,
    skipped_count: rows.length,
    skipped_by_reason: {},
    product_ids: [],
    issues: [] as BootstrapCatalogIssue[],
    manual_row_count: rows.length
  };
  if (!manualIdentityConfirmed) {
    return { ...emptyResult, status: "invalid", issues: [issue(-1, "MANUAL_CONFIRMATION_REQUIRED", "각 파트너스 링크의 목적지가 같은 쿠팡 상품인지 직접 확인했다는 체크가 필요합니다.")] };
  }
  if (rows.length < 1) return { ...emptyResult, status: "empty", issues: [issue(-1, "ROWS_REQUIRED", "입력한 상품 행이 없습니다.")] };
  if (rows.length > MANUAL_BOOTSTRAP_MAX_ROWS) {
    return { ...emptyResult, status: "invalid", issues: [issue(-1, "TOO_MANY_ROWS", `한 번에 최대 ${MANUAL_BOOTSTRAP_MAX_ROWS}개까지 입력할 수 있습니다.`)] };
  }

  const products: ProductWithScore[] = [];
  const issues: BootstrapCatalogIssue[] = [];
  const seenSourceIds = new Set<string>();
  const seenAffiliateKeys = new Set<string>();
  rows.forEach((row, index) => {
    const built = buildProduct(row, index + 1, reviewedAt, seenSourceIds, seenAffiliateKeys);
    products.push(...(built.product ? [built.product] : []));
    issues.push(...built.issues);
  });
  if (issues.length) return { ...emptyResult, status: "invalid", issues };

  const exported = createBootstrapCatalog(products, reviewedAt);
  if (exported.eligible_count !== products.length) {
    return {
      ...exported,
      status: "invalid",
      env_value: null,
      issues: [
        issue(
          -1,
          "CATALOG_SIZE_LIMIT",
          `입력한 ${products.length}개 상품을 모두 담을 수 없어 부분 카탈로그를 만들지 않았습니다. 환경변수 ${exported.max_bytes.toLocaleString("ko-KR")}바이트 한도 안에서 상품 수나 공개 메모를 줄여 다시 시도하세요.`
        )
      ],
      manual_row_count: rows.length
    };
  }
  return { ...exported, status: exported.status, issues: [], manual_row_count: rows.length };
}
