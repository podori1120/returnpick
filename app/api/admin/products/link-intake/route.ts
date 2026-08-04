import { NextResponse } from "next/server";
import { assessAffiliateIdentity, extractCoupangProductId } from "@/lib/affiliateIdentity";
import { verifyCoupangAffiliateLinkResolution } from "@/lib/coupangAffiliateLinkVerifier";
import { getCoupangPartnersLinkIssue, isApprovalSampleAffiliateUrl, isUsableAffiliateUrl, isUsableCoupangProductUrl } from "@/lib/coupangLink";
import { createDealScore, insertSourcedProduct, listProducts } from "@/lib/dataStore";
import { findManualImportConflict, type ManualImportConflict } from "@/lib/manualImportIdentity";
import { getProductImageUrlIssue, isUsableProductImageUrl } from "@/lib/productImageUrl";
import { calculateDealScore } from "@/lib/scoring";
import { parseSpecsFromTitle } from "@/lib/specParser";
import { isCategory, requireAdmin, requirePersistentStorage, sanitizeText } from "@/lib/validators";
import { inspectPublicWebProductUrl, PUBLIC_WEB_INTAKE_ENRICHMENT_BUDGET_MS, type PublicWebProductInspectionResult } from "@/lib/providers/publicWebProvider";

export const runtime = "nodejs";
export const maxDuration = 15;

const accessLimitedStatuses = new Set([401, 403, 405, 429]);

function boundedText(value: unknown, maxLength: number) {
  return sanitizeText(value, "").slice(0, maxLength);
}

function nextAction(identityStatus: string) {
  return identityStatus === "MATCH"
    ? "상품·가격·반품등급·재고를 검수한 뒤 게시 여부를 결정하세요."
    : "브라우저에서 파트너스 링크와 입력한 상품번호가 같은 상품인지 수동 확인한 뒤 링크 검수 화면에서 확인을 완료하세요.";
}

function publicWebEnrichmentSummary(
  requested: boolean,
  hasProductUrl: boolean,
  result?: PublicWebProductInspectionResult | null,
  appliedFields: string[] = []
) {
  if (!requested) {
    return { requested: false, status: "not_requested", fields_filled: [], diagnostics: [] };
  }
  if (!hasProductUrl) {
    return { requested: true, status: "PRODUCT_URL_REQUIRED", fields_filled: [], diagnostics: [{ status: "PRODUCT_URL_REQUIRED" }] };
  }
  if (!result) {
    return { requested: true, status: "FETCH_FAILED", fields_filled: [], diagnostics: [{ status: "FETCH_FAILED" }] };
  }
  return {
    requested: true,
    status: result.status,
    fields_filled: result.status === "ok" ? appliedFields.slice(0, 8) : [],
    diagnostics: result.diagnostics.slice(0, 4).map((item) => ({ status: item.status, stage: item.stage ?? null, error: item.error ?? null }))
  };
}

function conflictResponse(conflict: ManualImportConflict) {
  return NextResponse.json(
    {
      error: "EXISTING_PRODUCT_CONFLICT",
      reason: conflict.code,
      existing_product_id: conflict.product_id,
      message:
        conflict.code === "EXISTING_COUPANG_PRODUCT_ID"
          ? "같은 쿠팡 상품번호가 이미 후보로 등록되어 있습니다. 기존 후보에서 상품별 파트너스 링크를 수정하세요."
          : "같은 카테고리와 상품명이 이미 후보로 등록되어 있습니다. 기존 후보를 확인한 뒤 필요한 경우 명시적으로 수정하세요.",
      operator_next_action: `기존 후보 ${conflict.product_id}를 링크 보강 큐에서 확인하세요.`
    },
    { status: 409 }
  );
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const storageUnavailable = requirePersistentStorage();
  if (storageUnavailable) return storageUnavailable;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const title = boundedText(body.title, 240);
    const category = body.category;
    const affiliateUrl = boundedText(body.affiliate_url, 2_000);
    const inputCoupangUrl = boundedText(body.coupang_url, 2_000);
    const imageUrl = boundedText(body.image_url, 2_000);
    const enrichPublicWeb = body.enrich_public_web === true;

    if (title.length < 5) return NextResponse.json({ error: "TITLE_REQUIRED", message: "상품명을 5자 이상 입력하세요." }, { status: 400 });
    if (!isCategory(category)) return NextResponse.json({ error: "CATEGORY_REQUIRED", message: "카테고리를 선택하세요." }, { status: 400 });
    if (isApprovalSampleAffiliateUrl(affiliateUrl)) {
      return NextResponse.json({ error: "APPROVAL_SAMPLE_LINK_NOT_ALLOWED", message: "승인용 샘플 링크는 후보 등록에 사용할 수 없습니다." }, { status: 400 });
    }
    if (!isUsableAffiliateUrl(affiliateUrl)) {
      return NextResponse.json(
        { error: "INVALID_AFFILIATE_URL", message: `실제 https://link.coupang.com/a/... 파트너스 링크를 입력하세요. (${getCoupangPartnersLinkIssue(affiliateUrl) ?? "INVALID_AFFILIATE_URL"})` },
        { status: 400 }
      );
    }
    if (inputCoupangUrl && !isUsableCoupangProductUrl(inputCoupangUrl)) {
      return NextResponse.json({ error: "INVALID_COUPANG_PRODUCT_URL", message: "쿠팡 상품 URL은 https://www.coupang.com/vp/products/... 형식이어야 합니다." }, { status: 400 });
    }
    if (imageUrl && !isUsableProductImageUrl(imageUrl)) {
      return NextResponse.json({ error: "INVALID_IMAGE_URL", message: `공개 HTTPS 이미지 URL을 입력하세요. (${getProductImageUrlIssue(imageUrl) ?? "INVALID_IMAGE_URL"})` }, { status: 400 });
    }

    const resolution = await verifyCoupangAffiliateLinkResolution(affiliateUrl);
    const suppliedProductId = inputCoupangUrl ? extractCoupangProductId(inputCoupangUrl) : null;

    if (!inputCoupangUrl && (!resolution.product_id || !resolution.final_url)) {
      return NextResponse.json(
        { error: "AFFILIATE_DESTINATION_UNRESOLVED", resolution, operator_next_action: "브라우저에서 링크를 열어 쿠팡 상품 URL을 확인한 뒤 다시 등록하세요. 가격·재고·반품등급은 입력하거나 추정하지 마세요." },
        { status: 409 }
      );
    }
    if (suppliedProductId && resolution.product_id && suppliedProductId !== resolution.product_id) {
      return NextResponse.json(
        { error: "AFFILIATE_TARGET_MISMATCH", resolution, operator_next_action: "입력한 쿠팡 상품 URL과 파트너스 링크의 상품번호가 다릅니다. 같은 상품으로 확인될 때까지 저장하지 마세요." },
        { status: 409 }
      );
    }

    const accessLimited = !resolution.product_id && accessLimitedStatuses.has(resolution.http_status ?? 0);
    if (inputCoupangUrl && !resolution.product_id && !accessLimited) {
      return NextResponse.json(
        { error: "AFFILIATE_DESTINATION_UNRESOLVED", resolution, operator_next_action: "링크 목적지 확인이 완료되지 않았습니다. 잠시 후 다시 확인하거나 브라우저에서 상품번호를 수동 확인하세요." },
        { status: 409 }
      );
    }

    const coupangUrl = resolution.final_url ?? inputCoupangUrl;
    const sourceProductId = resolution.product_id ?? suppliedProductId;
    if (!coupangUrl || !sourceProductId) {
      return NextResponse.json({ error: "COUPANG_PRODUCT_ID_REQUIRED", operator_next_action: "확인 가능한 쿠팡 상품 URL과 상품번호가 필요합니다." }, { status: 409 });
    }

    const identity = assessAffiliateIdentity({
      product: { coupang_url: coupangUrl, source_url: coupangUrl },
      affiliateUrl,
      resolvedProductId: resolution.product_id,
      resolutionCode: resolution.code,
      checkedAt: resolution.checked_at
    });
    const conflict = findManualImportConflict(await listProducts(), { sourceProductId, category, title });
    if (conflict) {
      return conflictResponse(conflict);
    }

    let inspection: PublicWebProductInspectionResult | null = null;
    if (enrichPublicWeb && inputCoupangUrl && isUsableCoupangProductUrl(inputCoupangUrl)) {
      try {
        inspection = await inspectPublicWebProductUrl({
          url: inputCoupangUrl,
          category,
          deadlineAt: Date.now() + PUBLIC_WEB_INTAKE_ENRICHMENT_BUDGET_MS
        });
      } catch (error) {
        inspection = {
          status: "FETCH_FAILED",
          url: coupangUrl,
          enriched_metadata: {
            title: null,
            image_url: null,
            source_price: null,
            return_price: null,
            condition_grade: null,
            stock_count: null
          },
          fields_filled: [],
          diagnostics: [{ status: "FETCH_FAILED", stage: "detail", error: error instanceof Error ? error.message.slice(0, 160) : "FETCH_FAILED" }],
          raw_json: {}
        };
      }
    }

    const metadata = inspection?.status === "ok" ? inspection.enriched_metadata : null;
    const enrichedTitle = metadata?.title?.trim() ?? "";
    const enrichedTitleAccepted = enrichedTitle.length >= 5 && enrichedTitle.length <= 240;
    const candidateTitle = enrichedTitleAccepted ? boundedText(enrichedTitle, 240) : title;
    const enrichedImageUrl = metadata?.image_url && isUsableProductImageUrl(metadata.image_url) ? metadata.image_url : null;
    const candidateImageUrl = imageUrl || enrichedImageUrl;
    const candidateSourcePrice = metadata?.source_price ?? null;
    const candidateReturnPrice = metadata?.return_price ?? null;
    const candidateStockCount = metadata?.stock_count ?? null;
    const appliedFields = inspection?.status === "ok"
      ? [
          enrichedTitleAccepted ? "title" : null,
          !imageUrl && enrichedImageUrl ? "image_url" : null,
          candidateSourcePrice !== null ? "source_price" : null,
          candidateReturnPrice !== null ? "return_price" : null,
          metadata?.condition_grade !== null ? "condition_grade" : null,
          candidateStockCount !== null ? "stock_count" : null
        ].filter((field): field is string => Boolean(field))
      : [];
    const enrichment = publicWebEnrichmentSummary(enrichPublicWeb, Boolean(inputCoupangUrl), inspection, appliedFields);

    const enrichedConflict = findManualImportConflict(await listProducts(), { sourceProductId, category, title: candidateTitle });
    if (enrichedConflict) {
      return conflictResponse(enrichedConflict);
    }

    const result = await insertSourcedProduct({
      source: "manual_affiliate_link",
      source_product_id: sourceProductId,
      category,
      title: candidateTitle,
      image_url: candidateImageUrl,
      source_url: coupangUrl,
      coupang_url: coupangUrl,
      affiliate_url: affiliateUrl,
      source_price: candidateSourcePrice,
      return_price: candidateReturnPrice,
      new_price: null,
      naver_lowest_price: null,
      condition_grade: metadata?.condition_grade ?? "확인필요",
      stock_count: candidateStockCount,
      spec_json: parseSpecsFromTitle(candidateTitle, category),
      raw_json: {
        affiliate_verification: identity,
        manual_affiliate_link: { created_at: new Date().toISOString(), resolution_code: resolution.code, identity_status: identity.status },
        public_web_enrichment: enrichment,
        ...(inspection?.status === "ok" ? inspection.raw_json : {})
      },
      last_observed_at: null,
      sourcing_status: "needs_review",
      is_published: false,
      is_rejected: false,
      public_note: boundedText(body.public_note, 500) || null,
      admin_memo: boundedText(body.admin_memo, 500) || null
    });
    const score = calculateDealScore(result.product);
    let scoreError: string | null = null;
    try {
      await createDealScore(score);
    } catch {
      scoreError = "SOURCING_SCORE_SAVE_FAILED";
    }

    return NextResponse.json(
      {
        product: result.product,
        score: scoreError ? null : score,
        score_error: scoreError,
        public_web_enrichment: enrichment,
        operator_next_action: scoreError
          ? "후보는 저장됐지만 점수 저장에 실패했습니다. 후보 검토 화면을 새로고침한 뒤 점수 재계산을 실행하세요."
          : enrichPublicWeb && enrichment.status !== "ok"
            ? `${nextAction(identity.status)} 공개 웹 보강은 ${enrichment.status} 상태라 입력값만 저장했습니다. 상품 URL·허용된 공개 페이지 설정과 robots.txt를 확인하세요.`
          : nextAction(identity.status)
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "UNKNOWN_AFFILIATE_LINK_INTAKE_ERROR";
    return NextResponse.json({ error: "AFFILIATE_LINK_INTAKE_FAILED", message }, { status: 500 });
  }
}
