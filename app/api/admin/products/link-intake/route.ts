import { NextResponse } from "next/server";
import { assessAffiliateIdentity, extractCoupangProductId } from "@/lib/affiliateIdentity";
import { verifyCoupangAffiliateLinkResolution } from "@/lib/coupangAffiliateLinkVerifier";
import { getCoupangPartnersLinkIssue, isApprovalSampleAffiliateUrl, isUsableAffiliateUrl, isUsableCoupangProductUrl } from "@/lib/coupangLink";
import { createDealScore, insertSourcedProduct, listProducts } from "@/lib/dataStore";
import { findManualImportConflict } from "@/lib/manualImportIdentity";
import { getProductImageUrlIssue, isUsableProductImageUrl } from "@/lib/productImageUrl";
import { calculateDealScore } from "@/lib/scoring";
import { parseSpecsFromTitle } from "@/lib/specParser";
import { isCategory, requireAdmin, requirePersistentStorage, sanitizeText } from "@/lib/validators";

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

    const result = await insertSourcedProduct({
      source: "manual_affiliate_link",
      source_product_id: sourceProductId,
      category,
      title,
      image_url: imageUrl || null,
      source_url: coupangUrl,
      coupang_url: coupangUrl,
      affiliate_url: affiliateUrl,
      source_price: null,
      return_price: null,
      new_price: null,
      naver_lowest_price: null,
      condition_grade: "확인필요",
      stock_count: null,
      spec_json: parseSpecsFromTitle(title, category),
      raw_json: {
        affiliate_verification: identity,
        manual_affiliate_link: { created_at: new Date().toISOString(), resolution_code: resolution.code, identity_status: identity.status }
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
        operator_next_action: scoreError
          ? "후보는 저장됐지만 점수 저장에 실패했습니다. 후보 검토 화면을 새로고침한 뒤 점수 재계산을 실행하세요."
          : nextAction(identity.status)
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "UNKNOWN_AFFILIATE_LINK_INTAKE_ERROR";
    return NextResponse.json({ error: "AFFILIATE_LINK_INTAKE_FAILED", message }, { status: 500 });
  }
}
