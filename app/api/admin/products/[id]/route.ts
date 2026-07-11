import { NextResponse } from "next/server";
import { calculateDealScore } from "@/lib/scoring";
import { createDealScore, getProductById, updateProduct } from "@/lib/dataStore";
import { parseSpecsFromTitle } from "@/lib/specParser";
import { toNumberOrNull } from "@/lib/format";
import { getCustomerPublishReadiness } from "@/lib/quality";
import { getCoupangPartnersLinkIssue, isApprovalSampleAffiliateUrl, isGenericCoupangLandingUrl, isUsableAffiliateUrl, isUsableCoupangProductUrl } from "@/lib/coupangLink";
import { isConditionGrade, isSourcingStatus, requireAdmin, sanitizeText } from "@/lib/validators";
import type { ConditionGrade, ProductWithScore, SourcedProduct, SourcingStatus } from "@/lib/types";

function productMutationErrorResponse(error: unknown) {
  const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_ADMIN_PRODUCT_ERROR";
  const status = message === "PRODUCT_NOT_FOUND" ? 404 : 500;
  return NextResponse.json({ error: status === 500 ? "ADMIN_PRODUCT_MUTATION_FAILED" : message, message }, { status });
}

function normalizePatch(body: Record<string, unknown>, current: SourcedProduct) {
  const patch: Partial<SourcedProduct> = {};
  const textFields = ["affiliate_url", "source_url", "coupang_url", "public_note", "admin_memo", "rejection_reason"] as const;
  const numberFields = ["return_price", "new_price", "naver_lowest_price", "stock_count", "source_price"] as const;

  for (const field of textFields) {
    if (field in body) patch[field] = sanitizeText(body[field], "") || null;
  }
  for (const field of numberFields) {
    if (field in body) patch[field] = toNumberOrNull(body[field]);
  }

  if ("condition_grade" in body && isConditionGrade(body.condition_grade)) {
    patch.condition_grade = body.condition_grade as ConditionGrade;
  }
  if ("sourcing_status" in body && isSourcingStatus(body.sourcing_status)) {
    patch.sourcing_status = body.sourcing_status as SourcingStatus;
  }
  if ("title" in body) {
    patch.title = sanitizeText(body.title, current.title);
    patch.spec_json = parseSpecsFromTitle(patch.title, current.category);
  }

  return patch;
}

function invalidAffiliateUrlMessage(value: string | null | undefined) {
  if (isUsableCoupangProductUrl(value)) {
    return "일반 쿠팡 상품 URL은 affiliate_url에 저장할 수 없습니다. source_url 또는 coupang_url에 보관하고, 구매 CTA에는 쿠팡 파트너스 상품별 링크를 입력하세요.";
  }
  if (isGenericCoupangLandingUrl(value)) {
    return "공통 랜딩/골드박스 링크는 상품별 전환 추적에 적합하지 않아 affiliate_url에 저장할 수 없습니다. 상품별 쿠팡 파트너스 링크를 입력하세요.";
  }
  const issue = getCoupangPartnersLinkIssue(value);
  if (issue === "PARTNERS_SHORT_LINK_PATH_REQUIRED") {
    return "affiliate_url에는 https://link.coupang.com/a/짧은코드 형태의 상품별 쿠팡 파트너스 링크만 저장할 수 있습니다.";
  }
  if (issue === "SUSPICIOUS_PARTNERS_SHORT_CODE") {
    return "테스트, 샘플, dryrun처럼 보이는 파트너스 링크 코드는 저장할 수 없습니다. 쿠팡 파트너스에서 실제 상품별 링크를 다시 생성하세요.";
  }
  return "affiliate_url에는 https://link.coupang.com/a/... 형태의 상품별 쿠팡 파트너스 링크만 저장할 수 있습니다.";
}

function projectProductForPublishCheck(current: ProductWithScore, patch: Partial<SourcedProduct>): ProductWithScore {
  const projected = {
    ...current,
    ...patch
  };
  const projectedScore = calculateDealScore(projected);
  return {
    ...projected,
    latest_score: projectedScore,
    deal_scores: [projectedScore, ...(current.deal_scores ?? [])],
    snapshots: current.snapshots,
    latest_snapshot: current.latest_snapshot
  };
}

function publicQualityBlockResponse(product: ProductWithScore) {
  const readiness = getCustomerPublishReadiness(product);
  if (readiness.ready) return null;
  const blockers = readiness.blockers.slice(0, 8);
  return NextResponse.json(
    {
      error: "PUBLIC_QUALITY_BLOCKERS_FOR_PUBLISH",
      message: `게시 전 ${blockers.slice(0, 3).join(", ")} 확인이 필요합니다.`,
      blockers,
      warnings: readiness.warnings.slice(0, 8)
    },
    { status: 400 }
  );
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await context.params;
    const product = await getProductById(id);
    if (!product) return NextResponse.json({ error: "PRODUCT_NOT_FOUND", message: "상품을 찾지 못했습니다." }, { status: 404 });
    return NextResponse.json({ product });
  } catch (error) {
    return productMutationErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await context.params;
    const current = await getProductById(id);
    if (!current) return NextResponse.json({ error: "PRODUCT_NOT_FOUND", message: "상품을 찾지 못했습니다." }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : null;
    let patch = normalizePatch(body, current);
    const hasAffiliateUrlPatch = "affiliate_url" in body;

  if (hasAffiliateUrlPatch && isApprovalSampleAffiliateUrl(patch.affiliate_url)) {
    return NextResponse.json(
      {
        error: "APPROVAL_SAMPLE_LINK_NOT_ALLOWED_FOR_PRODUCT",
        message: "승인용 샘플 링크는 /products/approval-sample 전용입니다. 실상품에는 상품별 파트너스 링크를 저장하세요."
      },
      { status: 400 }
    );
  }
  if (hasAffiliateUrlPatch && patch.affiliate_url && !isUsableAffiliateUrl(patch.affiliate_url)) {
    return NextResponse.json(
      {
        error: "INVALID_AFFILIATE_URL_FOR_PRODUCT",
        message: invalidAffiliateUrlMessage(patch.affiliate_url)
      },
      { status: 400 }
    );
  }

  if (action === "approve") {
    patch = { ...patch, sourcing_status: "approved", is_rejected: false, is_published: false };
  }
  if (action === "publish") {
    const nextAffiliateUrl = hasAffiliateUrlPatch ? patch.affiliate_url : current.affiliate_url;
    if (isApprovalSampleAffiliateUrl(nextAffiliateUrl)) {
      return NextResponse.json(
        {
          error: "APPROVAL_SAMPLE_LINK_NOT_ALLOWED_FOR_PUBLISH",
          message: "승인용 샘플 링크는 /products/approval-sample 전용입니다. 이 상품의 상품별 파트너스 링크를 입력하세요."
        },
        { status: 400 }
      );
    }
    if (!isUsableAffiliateUrl(nextAffiliateUrl)) {
      return NextResponse.json(
        {
          error: "AFFILIATE_URL_REQUIRED_FOR_PUBLISH",
          message: "게시 전 상품별 쿠팡 파트너스 링크를 입력하세요."
        },
        { status: 400 }
      );
    }
    const publishPatch = { ...patch, sourcing_status: "published" as const, is_published: true, is_rejected: false };
    const qualityBlock = publicQualityBlockResponse(projectProductForPublishCheck(current, publishPatch));
    if (qualityBlock) return qualityBlock;
    patch = publishPatch;
  }
  const nextPublishedStatus = patch.sourcing_status ?? current.sourcing_status;
  const nextIsPublished = patch.is_published ?? current.is_published;
  if ((nextPublishedStatus === "published" || nextIsPublished === true) && action !== "publish") {
    const nextAffiliateUrl = hasAffiliateUrlPatch ? patch.affiliate_url : current.affiliate_url;
    if (isApprovalSampleAffiliateUrl(nextAffiliateUrl)) {
      return NextResponse.json(
        {
          error: "APPROVAL_SAMPLE_LINK_NOT_ALLOWED_FOR_PUBLISH",
          message: "published 상태에는 승인용 샘플 링크를 재사용할 수 없습니다. 상품별 파트너스 링크를 입력하세요."
        },
        { status: 400 }
      );
    }
    if (!isUsableAffiliateUrl(nextAffiliateUrl)) {
      return NextResponse.json(
        {
          error: "AFFILIATE_URL_REQUIRED_FOR_PUBLISH",
          message: "published 상태로 바꾸려면 상품별 쿠팡 파트너스 링크가 필요합니다."
        },
        { status: 400 }
      );
    }
    const qualityBlock = publicQualityBlockResponse(
      projectProductForPublishCheck(current, { ...patch, sourcing_status: nextPublishedStatus, is_published: nextIsPublished })
    );
    if (qualityBlock) return qualityBlock;
  }
  if (action === "unpublish") {
    patch = { ...patch, sourcing_status: "approved", is_published: false };
  }
  if (action === "reject") {
    patch = {
      ...patch,
      sourcing_status: "rejected",
      is_rejected: true,
      is_published: false,
      rejection_reason: patch.rejection_reason ?? "관리자 거절"
    };
  }
  if (action === "sold_out") {
    patch = { ...patch, sourcing_status: "sold_out", is_published: false };
  }

    const updated = await updateProduct(id, patch);
    const score = calculateDealScore(updated);
    await createDealScore(score);

    return NextResponse.json({ product: await getProductById(id) });
  } catch (error) {
    return productMutationErrorResponse(error);
  }
}
