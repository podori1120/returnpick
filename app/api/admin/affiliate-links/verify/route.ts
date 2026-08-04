import { NextResponse } from "next/server";
import {
  assessAffiliateIdentity,
  createManualAffiliateIdentityConfirmation,
  mergeAffiliateIdentityRecord,
  readAffiliateIdentityRecord,
  type AffiliateIdentityRecord
} from "@/lib/affiliateIdentity";
import { verifyCoupangAffiliateLinkResolution } from "@/lib/coupangAffiliateLinkVerifier";
import { isApprovalSampleAffiliateUrl, isUsableAffiliateUrl } from "@/lib/coupangLink";
import { getProductById, updateProduct } from "@/lib/dataStore";
import { requireAdmin, requirePersistentStorage } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

const MAX_PAYLOAD_BYTES = 2_048;
const MAX_AFFILIATE_URL_LENGTH = 512;
const productIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function identityMessage(record: AffiliateIdentityRecord, fallback: string) {
  if (record.status === "MATCH") return "후보 상품번호와 파트너스 링크의 최종 상품번호가 일치합니다.";
  if (record.status === "MISMATCH") {
    return `상품번호가 일치하지 않습니다. 후보 ${record.expected_product_id ?? "확인필요"}, 링크 ${record.resolved_product_id ?? "확인필요"}.`;
  }
  if (record.status === "EXPECTED_ID_UNAVAILABLE") return "후보의 기준 쿠팡 상품번호가 없어 브라우저에서 상품명·옵션을 직접 확인해야 합니다.";
  if (record.status === "MANUAL_CONFIRMED") return "관리자가 브라우저에서 후보와 링크의 상품명·옵션 일치를 확인했습니다.";
  return `${fallback} 브라우저에서 상품명·옵션을 직접 확인하세요.`;
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const storageUnavailable = requirePersistentStorage();
  if (storageUnavailable) return storageUnavailable;

  const contentLengthHeader = request.headers.get("content-length");
  const declaredLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : 0;
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PAYLOAD_BYTES) {
    return privateJson({ error: "AFFILIATE_VERIFY_PAYLOAD_TOO_LARGE" }, 413);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return privateJson({ error: "AFFILIATE_VERIFY_BODY_READ_FAILED" }, 400);
  }
  if (new TextEncoder().encode(rawBody).byteLength > MAX_PAYLOAD_BYTES) {
    return privateJson({ error: "AFFILIATE_VERIFY_PAYLOAD_TOO_LARGE" }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return privateJson({ error: "AFFILIATE_VERIFY_INVALID_JSON" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return privateJson({ error: "AFFILIATE_VERIFY_INVALID_BODY" }, 400);
  }

  const record = body as Record<string, unknown>;
  const allowedKeys = new Set(["product_id", "affiliate_url", "mode"]);
  const productId = typeof record.product_id === "string" ? record.product_id.trim() : "";
  const affiliateUrl = typeof record.affiliate_url === "string" ? record.affiliate_url.trim() : "";
  const mode = record.mode === "manual_confirm" ? "manual_confirm" : record.mode == null || record.mode === "verify" ? "verify" : null;
  if (
    Object.keys(record).some((key) => !allowedKeys.has(key)) ||
    !productIdPattern.test(productId) ||
    !affiliateUrl ||
    affiliateUrl.length > MAX_AFFILIATE_URL_LENGTH ||
    !mode
  ) {
    return privateJson({ error: "AFFILIATE_VERIFY_INVALID_BODY", message: "상품 ID와 확인할 파트너스 URL을 입력하세요." }, 400);
  }
  if (!isUsableAffiliateUrl(affiliateUrl) || isApprovalSampleAffiliateUrl(affiliateUrl)) {
    return privateJson({ error: "AFFILIATE_VERIFY_INVALID_URL", message: "실상품용 쿠팡 파트너스 상품별 링크만 확인할 수 있습니다." }, 400);
  }

  try {
    const product = await getProductById(productId);
    if (!product) return privateJson({ error: "PRODUCT_NOT_FOUND", message: "확인할 후보 상품을 찾지 못했습니다." }, 404);

    if (mode === "manual_confirm") {
      const previous = readAffiliateIdentityRecord(product);
      if (!previous || previous.affiliate_url !== affiliateUrl) {
        return privateJson({ error: "AUTOMATIC_CHECK_REQUIRED", message: "같은 링크로 자동 목적지 확인을 먼저 실행하세요." }, 409);
      }
      if (previous.status === "MISMATCH") {
        return privateJson({ error: "AFFILIATE_TARGET_MISMATCH", message: "자동 확인에서 다른 상품번호가 확인되어 수동 확인으로 덮어쓸 수 없습니다." }, 409);
      }
      if (!["UNRESOLVED", "EXPECTED_ID_UNAVAILABLE"].includes(previous.status)) {
        return privateJson({ error: "MANUAL_CONFIRMATION_NOT_REQUIRED", message: "이미 자동 상품 일치 확인이 완료된 링크입니다." }, 409);
      }
      const identity = createManualAffiliateIdentityConfirmation(product, affiliateUrl);
      if (!identity) return privateJson({ error: "AFFILIATE_TARGET_MISMATCH" }, 409);
      await updateProduct(product.id, { raw_json: mergeAffiliateIdentityRecord(product, identity) });
      return privateJson({
        verification: {
          ok: true,
          code: "MANUAL_CONFIRMED",
          message: identityMessage(identity, ""),
          product_id: identity.resolved_product_id ?? undefined,
          expected_product_id: identity.expected_product_id ?? undefined,
          identity_status: identity.status,
          http_status: undefined,
          redirect_count: 0,
          checked_at: identity.checked_at
        }
      });
    }

    const resolution = await verifyCoupangAffiliateLinkResolution(affiliateUrl);
    const identity = assessAffiliateIdentity({
      product,
      affiliateUrl,
      resolvedProductId: resolution.product_id,
      resolutionCode: resolution.code,
      checkedAt: resolution.checked_at
    });
    await updateProduct(product.id, { raw_json: mergeAffiliateIdentityRecord(product, identity) });

    return privateJson({
      verification: {
        ...resolution,
        ok: identity.status === "MATCH",
        message: identityMessage(identity, resolution.message),
        expected_product_id: identity.expected_product_id ?? undefined,
        identity_status: identity.status
      }
    });
  } catch {
    return privateJson({ error: "AFFILIATE_LINK_VERIFICATION_FAILED", message: "링크 확인 기록을 저장하는 중 예상하지 못한 오류가 발생했습니다." }, 500);
  }
}
