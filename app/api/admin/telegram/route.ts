import { NextResponse } from "next/server";
import { getProductById } from "@/lib/dataStore";
import { isPublicDealReady } from "@/lib/publicDeal";
import {
  buildEditorialPickTelegramMessage,
  buildTelegramMessage,
  sendTelegramEditorialPick,
  sendTelegramForProduct
} from "@/lib/telegram";
import { requireAdmin, requirePersistentStorage } from "@/lib/validators";

function telegramAdminErrorResponse(error: unknown) {
  const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_TELEGRAM_ADMIN_ERROR";
  const status =
    message === "PRODUCT_NOT_FOUND"
      ? 404
      : message === "TELEGRAM_CAMPAIGN_RECENTLY_SENT"
        ? 409
      : ["ONLY_PUBLIC_AFFILIATE_READY_PRODUCTS_CAN_BE_SENT", "ONLY_PUBLIC_CUSTOMER_READY_PRODUCTS_CAN_BE_SENT", "EDITORIAL_CAMPAIGN_LINK_NOT_CONFIGURED"].includes(message)
        ? 400
        : 500;
  const publicMessage =
    message === "EDITORIAL_CAMPAIGN_LINK_NOT_CONFIGURED"
      ? "추천 콘텐츠의 쿠팡 파트너스 링크가 설정되지 않았습니다."
      : message === "TELEGRAM_CAMPAIGN_RECENTLY_SENT"
        ? "같은 추천 메시지가 최근 발송되었습니다. 15분 뒤 다시 시도하세요."
      : message;
  return NextResponse.json({ error: status === 500 ? "TELEGRAM_ADMIN_FAILED" : message, message: publicMessage }, { status });
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const storageUnavailable = requirePersistentStorage();
  if (storageUnavailable) return storageUnavailable;

  try {
    const body = (await request.json().catch(() => ({}))) as { productId?: string; mode?: string; campaign?: string };
    if (body.mode !== "preview" && body.mode !== "send") {
      return NextResponse.json({ error: "INVALID_TELEGRAM_MODE", message: "텔레그램 요청 mode는 preview 또는 send여야 합니다." }, { status: 400 });
    }
    if (body.campaign && body.campaign !== "editorial_pick") {
      return NextResponse.json({ error: "INVALID_TELEGRAM_CAMPAIGN", message: "허용되지 않은 텔레그램 캠페인입니다." }, { status: 400 });
    }
    if (body.campaign && body.productId) {
      return NextResponse.json({ error: "AMBIGUOUS_TELEGRAM_TARGET", message: "상품과 추천 캠페인을 동시에 선택할 수 없습니다." }, { status: 400 });
    }

    if (body.campaign === "editorial_pick") {
      if (body.mode === "preview") {
        return NextResponse.json({ status: "preview", message: buildEditorialPickTelegramMessage() });
      }
      return NextResponse.json(await sendTelegramEditorialPick());
    }

    if (!body.productId) return NextResponse.json({ error: "PRODUCT_ID_REQUIRED", message: "상품을 먼저 선택하세요." }, { status: 400 });

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
