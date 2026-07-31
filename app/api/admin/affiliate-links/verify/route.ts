import { NextResponse } from "next/server";
import { verifyCoupangAffiliateLinkResolution } from "@/lib/coupangAffiliateLinkVerifier";
import { requireAdmin } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

const MAX_PAYLOAD_BYTES = 2_048;
const MAX_AFFILIATE_URL_LENGTH = 512;

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

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
  const keys = Object.keys(record);
  const affiliateUrl = typeof record.affiliate_url === "string" ? record.affiliate_url.trim() : "";
  if (keys.length !== 1 || keys[0] !== "affiliate_url" || !affiliateUrl || affiliateUrl.length > MAX_AFFILIATE_URL_LENGTH) {
    return privateJson({ error: "AFFILIATE_VERIFY_INVALID_BODY", message: "확인할 파트너스 URL 하나를 입력하세요." }, 400);
  }

  try {
    return privateJson({ verification: await verifyCoupangAffiliateLinkResolution(affiliateUrl) });
  } catch {
    return privateJson({ error: "AFFILIATE_LINK_VERIFICATION_FAILED", message: "링크 확인 중 예상하지 못한 오류가 발생했습니다." }, 500);
  }
}
