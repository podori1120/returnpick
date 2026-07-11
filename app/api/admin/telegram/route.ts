import { NextResponse } from "next/server";
import { getProductById } from "@/lib/dataStore";
import { isPublicDealReady } from "@/lib/publicDeal";
import { buildTelegramMessage, sendTelegramForProduct } from "@/lib/telegram";
import { requireAdmin } from "@/lib/validators";

function telegramAdminErrorResponse(error: unknown) {
  const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_TELEGRAM_ADMIN_ERROR";
  const status =
    message === "PRODUCT_NOT_FOUND" ? 404 : ["ONLY_PUBLIC_AFFILIATE_READY_PRODUCTS_CAN_BE_SENT", "ONLY_PUBLIC_CUSTOMER_READY_PRODUCTS_CAN_BE_SENT"].includes(message) ? 400 : 500;
  return NextResponse.json({ error: status === 500 ? "TELEGRAM_ADMIN_FAILED" : message, message }, { status });
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json().catch(() => ({}))) as { productId?: string; mode?: string };
    if (!body.productId) return NextResponse.json({ error: "PRODUCT_ID_REQUIRED", message: "상품을 먼저 선택하세요." }, { status: 400 });
    if (body.mode !== "preview" && body.mode !== "send") {
      return NextResponse.json({ error: "INVALID_TELEGRAM_MODE", message: "텔레그램 요청 mode는 preview 또는 send여야 합니다." }, { status: 400 });
    }

    if (body.mode === "preview") {
      const product = await getProductById(body.productId);
      if (!product) return NextResponse.json({ error: "PRODUCT_NOT_FOUND", message: "상품을 찾지 못했습니다." }, { status: 404 });
      if (!isPublicDealReady(product)) {
        return NextResponse.json(
          {
            error: "TELEGRAM_PRODUCT_NOT_PUBLIC_READY",
            message: "텔레그램 발송 전 게시 상태, 상품별 쿠팡 파트너스 링크, 고객공개 품질 블로커를 먼저 확인하세요."
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ status: "preview", message: buildTelegramMessage(product) });
    }

    const result = await sendTelegramForProduct(body.productId);
    return NextResponse.json(result);
  } catch (error) {
    return telegramAdminErrorResponse(error);
  }
}
