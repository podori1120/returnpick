import { NextResponse } from "next/server";
import { getProductById } from "@/lib/dataStore";
import { buildProductDistributionKit, getProductDistributionReadiness } from "@/lib/productDistributionKit";
import { getBloggerPublishMode, isBloggerDistributionEnabled, probeBloggerConnection, sendBloggerForProduct, type BloggerPostMode } from "@/lib/blogger";
import { requireAdmin, requirePersistentStorage } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const result = await probeBloggerConnection();
  const automation = { enabled: isBloggerDistributionEnabled(), publish_mode: getBloggerPublishMode() };
  if (result.status === "ok") return NextResponse.json({ ...result, ...automation });
  if (result.status === "not_configured") {
    return NextResponse.json({ ...result, ...automation, message: "Blogger와 Google OAuth 환경변수가 준비되지 않았습니다." }, { status: 503 });
  }
  return NextResponse.json({ ...result, ...automation, message: "Blogger OAuth 또는 지정 블로그 접근을 확인하지 못했습니다." }, { status: 502 });
}

const knownErrors = new Set([
  "PRODUCT_NOT_FOUND",
  "PRODUCT_NOT_PUBLIC_READY",
  "BLOGGER_ALREADY_DISTRIBUTED",
  "BLOGGER_DISTRIBUTION_DISABLED",
  "BLOGGER_API_NOT_CONFIGURED",
  "BLOGGER_LOG_FAILED",
  "BLOGGER_PROVIDER_FAILED",
  "BLOGGER_RESPONSE_INVALID",
  "BLOGGER_REQUEST_TIMEOUT_12000MS",
  "INVALID_BLOGGER_MODE",
  "DISTRIBUTION_LEDGER_NOT_CONFIGURED",
  "DISTRIBUTION_LEDGER_CONFLICT",
  "DISTRIBUTION_LEDGER_UPDATE_CONFLICT",
  "BLOGGER_DISTRIBUTION_PENDING",
  "BLOGGER_DISTRIBUTION_AMBIGUOUS",
  "BLOGGER_DISTRIBUTION_FAILED"
]);

function bloggerErrorResponse(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : "";
  const message = knownErrors.has(rawMessage) || /^(BLOGGER|GOOGLE_OAUTH)_/.test(rawMessage) ? rawMessage.slice(0, 120) : "BLOGGER_DISTRIBUTION_FAILED";
  const status =
    message === "PRODUCT_NOT_FOUND"
      ? 404
      : message === "BLOGGER_ALREADY_DISTRIBUTED"
        ? 409
        : ["BLOGGER_API_NOT_CONFIGURED", "BLOGGER_DISTRIBUTION_DISABLED", "DISTRIBUTION_LEDGER_NOT_CONFIGURED"].includes(message)
          ? 503
          : ["BLOGGER_ALREADY_DISTRIBUTED", "BLOGGER_DISTRIBUTION_PENDING", "BLOGGER_DISTRIBUTION_AMBIGUOUS", "BLOGGER_DISTRIBUTION_FAILED", "DISTRIBUTION_LEDGER_CONFLICT"].includes(message)
            ? 409
            : ["PRODUCT_NOT_PUBLIC_READY", "INVALID_BLOGGER_MODE"].includes(message)
              ? 400
              : 500;
  const publicMessage =
    message === "PRODUCT_NOT_FOUND"
      ? "상품을 찾지 못했습니다."
      : message === "PRODUCT_NOT_PUBLIC_READY"
        ? "고객공개 품질 기준을 통과한 상품만 Blogger에 배포할 수 있습니다."
      : message === "BLOGGER_ALREADY_DISTRIBUTED"
        ? "이 상품은 Blogger에 이미 초안 또는 게시물로 기록되어 있어 중복 배포하지 않았습니다."
        : message === "BLOGGER_DISTRIBUTION_DISABLED"
          ? "Blogger 배포 기능이 비활성화되어 있습니다. BLOGGER_DISTRIBUTION_ENABLED=true 설정 후 다시 시도하세요."
        : message === "BLOGGER_API_NOT_CONFIGURED"
            ? "Blogger와 Google OAuth 환경변수가 준비되지 않았습니다."
            : message === "DISTRIBUTION_LEDGER_NOT_CONFIGURED"
              ? "중복 게시 방지용 영속 배포 원장이 준비되지 않았습니다. Supabase 스키마를 먼저 적용하세요."
              : message === "BLOGGER_DISTRIBUTION_PENDING"
                ? "이 상품은 다른 Blogger 작업이 처리 중입니다. 결과를 확인한 뒤 다시 시도하세요."
                : message === "BLOGGER_DISTRIBUTION_AMBIGUOUS"
                  ? "Blogger 요청 결과를 확인하지 못해 자동 재게시하지 않았습니다. Blogger 관리자와 배포 원장을 확인하세요."
                  : message === "BLOGGER_DISTRIBUTION_FAILED"
                    ? "이 상품은 이전 Blogger 작업이 실패 상태라 자동 재게시하지 않았습니다. 배포 원장을 확인하세요."
                    : message === "INVALID_BLOGGER_MODE"
                      ? "Blogger mode는 preview, draft 또는 publish여야 합니다."
                      : "Blogger 배포에 실패했습니다.";
  return NextResponse.json({ error: message, message: publicMessage }, { status });
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const storageUnavailable = requirePersistentStorage();
  if (storageUnavailable) return storageUnavailable;

  try {
    const body = (await request.json().catch(() => ({}))) as { productId?: unknown; mode?: unknown };
    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    const mode = body.mode;
    if (!productId) return NextResponse.json({ error: "PRODUCT_ID_REQUIRED", message: "상품을 먼저 선택하세요." }, { status: 400 });
    if (mode !== "preview" && mode !== "draft" && mode !== "publish") throw new Error("INVALID_BLOGGER_MODE");

    const product = await getProductById(productId);
    if (!product) throw new Error("PRODUCT_NOT_FOUND");

    if (mode === "preview") {
      const readiness = getProductDistributionReadiness(product);
      if (!readiness.ready) throw new Error("PRODUCT_NOT_PUBLIC_READY");
      return NextResponse.json({ status: "preview", payload: buildProductDistributionKit(product).blogger });
    }

    const result = await sendBloggerForProduct(productId, mode as BloggerPostMode);
    return NextResponse.json(result, { status: result.status === "API_NOT_CONFIGURED" ? 503 : 200 });
  } catch (error) {
    return bloggerErrorResponse(error);
  }
}
