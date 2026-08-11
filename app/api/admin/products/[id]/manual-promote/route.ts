import { NextResponse } from "next/server";
import { getAffiliateIdentityReadiness } from "@/lib/affiliateIdentity";
import { getProductById, updateProductIfUnchanged } from "@/lib/dataStore";
import { createManualCatalogReview, isFreshManualCatalogReview } from "@/lib/manualCatalogReview";
import {
  createManualPromotionRawJson,
  getManualPromotionDealPrice,
  isManualPromotionConfirmation,
  isManualPromotionStateUnchanged,
  isManualPromotionSource,
  MANUAL_PROMOTION_PROVENANCE_KEY
} from "@/lib/manualPromotion";
import { isUsableAffiliateUrl, isUsableCoupangProductUrl } from "@/lib/coupangLink";
import { getCustomerPublishReadiness } from "@/lib/quality";
import { isUsableProductImageUrl } from "@/lib/productImageUrl";
import type { SourcedProduct } from "@/lib/types";
import { requireAdmin, requirePersistentStorage } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const MAX_BODY_BYTES = 1_024;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANUAL_PROMOTION_PUBLIC_CONFLICT = "MANUAL_PROMOTION_PUBLIC_CONFLICT";

function hasManualPromotionPublicMarker(product: Pick<SourcedProduct, "is_published" | "sourcing_status">) {
  return product.is_published === true || product.sourcing_status === "published";
}

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}

function invalidRequest(message: string, status = 400) {
  return privateJson({ error: "INVALID_MANUAL_PROMOTION_REQUEST", message }, status);
}

function conflict(error: string, message: string, details: Record<string, unknown> = {}) {
  return privateJson({ error, message, ...details }, 409);
}

async function readConfirmation(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) return { tooLarge: true as const };

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return { tooLarge: true as const };

  try {
    return { tooLarge: false as const, body: JSON.parse(raw || "") as unknown };
  } catch {
    return { tooLarge: false as const, body: null };
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const storageUnavailable = requirePersistentStorage();
  if (storageUnavailable) return storageUnavailable;

  try {
    const params = await context.params;
    const id = typeof params.id === "string" ? params.id.trim() : "";
    if (!uuidPattern.test(id)) return invalidRequest("상품 ID 형식을 확인해 주세요.");

    const confirmation = await readConfirmation(request);
    if (confirmation.tooLarge) return invalidRequest("수동 검수 전환 요청은 1KB 이하로 보내 주세요.", 413);
    if (!isManualPromotionConfirmation(confirmation.body)) {
      return invalidRequest("manual_review_confirmed:true만 포함한 명시적 확인 요청이 필요합니다.");
    }

    let current = await getProductById(id);
    if (!current) return privateJson({ error: "PRODUCT_NOT_FOUND", message: "상품을 찾지 못했습니다." }, 404);
    if (hasManualPromotionPublicMarker(current)) {
      return conflict(MANUAL_PROMOTION_PUBLIC_CONFLICT, "Product is already public and cannot be manually promoted.");
    }
    const latest = await getProductById(current.id);
    if (!latest) return privateJson({ error: "PRODUCT_NOT_FOUND", message: "Product was not found." }, 404);
    if (!isManualPromotionStateUnchanged(current, latest)) {
      return conflict("MANUAL_PROMOTION_STALE_CONFLICT", "Product changed before manual promotion; retry the review.");
    }
    current = latest;
    if (!isManualPromotionSource(current.source)) {
      return conflict("MANUAL_PROMOTION_SOURCE_NOT_ALLOWED", "알구몬 또는 HotDeals 발견 후보만 수동 검수로 전환할 수 있습니다.");
    }
    if (!isUsableAffiliateUrl(current.affiliate_url)) {
      return conflict("AFFILIATE_URL_REQUIRED", "상품별 쿠팡 파트너스 링크 확인이 필요합니다.");
    }
    if (!isUsableCoupangProductUrl(current.coupang_url)) {
      return conflict("COUPANG_PRODUCT_URL_REQUIRED", "확인된 쿠팡 상품 상세 URL이 필요합니다.");
    }
    if (!isUsableProductImageUrl(current.image_url)) {
      return conflict("PRODUCT_IMAGE_REQUIRED", "공개 HTTPS 상품 이미지 URL 확인이 필요합니다.");
    }
    if (getManualPromotionDealPrice(current) == null) {
      return conflict("POSITIVE_DEAL_PRICE_REQUIRED", "반품가·현재 판매가·새상품가 중 양수인 가격이 필요합니다.");
    }

    const identityReadiness = getAffiliateIdentityReadiness(current);
    if (!identityReadiness.ready) {
      return conflict("AFFILIATE_IDENTITY_NOT_VERIFIED", "파트너스 링크의 상품번호 일치 확인이 필요합니다.", {
        identity_status: identityReadiness.status,
        identity_blocker: identityReadiness.blocker
      });
    }

    const promotedAt = new Date().toISOString();
    const provenanceRawJson = createManualPromotionRawJson(current, promotedAt);
    const rawJson = createManualCatalogReview(provenanceRawJson, promotedAt);
    const projectedProduct = {
      ...current,
      source: "manual_affiliate_link" as const,
      raw_json: rawJson,
      sourcing_status: "approved" as const,
      is_published: false,
      is_rejected: false
    };
    const readiness = getCustomerPublishReadiness(projectedProduct);
    if (!readiness.ready) {
      return conflict("PUBLIC_QUALITY_BLOCKERS", "수동 검수 전환 전에 공개 품질 확인이 더 필요합니다.", {
        blockers: readiness.blockers.slice(0, 8),
        warnings: readiness.warnings.slice(0, 8)
      });
    }

    const updated = await updateProductIfUnchanged(
      current.id,
      {
        updated_at: current.updated_at,
        is_published: current.is_published,
        sourcing_status: current.sourcing_status
      },
      {
        source: "manual_affiliate_link",
        raw_json: rawJson,
        sourcing_status: "approved",
        is_published: false,
        is_rejected: false
      },
      { snapshotOrigin: "admin" }
    );
    if (!updated) {
      return conflict("MANUAL_PROMOTION_STALE_CONFLICT", "Product changed before manual promotion was saved; retry the review.");
    }
    const persisted = (await getProductById(current.id)) ?? updated;

    return privateJson({
      product: persisted,
      readiness: {
        ready: true,
        blockers: [],
        warnings: readiness.warnings.slice(0, 8)
      },
      provenance: {
        key: MANUAL_PROMOTION_PROVENANCE_KEY,
        original_source: current.source,
        original_source_product_id: current.source_product_id,
        original_source_url: current.source_url,
        original_title: current.title,
        original_keyword: current.keyword,
        promoted_at: promotedAt,
        manual_review_fresh: isFreshManualCatalogReview(rawJson)
      }
    });
  } catch {
    return privateJson({ error: "MANUAL_PROMOTION_FAILED", message: "수동 검수 전환을 저장하지 못했습니다." }, 500);
  }
}
