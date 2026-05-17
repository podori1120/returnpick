import { formatPercent, formatPrice } from "@/lib/format";
import { getLatestScore } from "@/lib/scoring";
import { createTelegramLog, getProductById } from "@/lib/dataStore";
import type { ProductWithScore } from "@/lib/types";

export function buildTelegramMessage(product: ProductWithScore) {
  const score = getLatestScore(product);
  const referencePrice = product.naver_lowest_price ?? product.new_price ?? product.source_price;
  const dealPrice = product.return_price ?? product.source_price;
  const discountRate = referencePrice && dealPrice ? (referencePrice - dealPrice) / referencePrice : null;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const reasons = score?.reasons?.slice(0, 2) ?? ["관리자가 가격과 상태를 검토한 상품입니다."];
  const risks = score?.risk_flags?.length ? ["가격과 재고는 변동될 수 있습니다.", "반품등급과 구성품은 구매 전 다시 확인하세요."] : ["가격과 재고는 변동될 수 있습니다."];
  const detailUrl = `${siteUrl.replace(/\/$/, "")}/deals/${product.id}?utm_source=telegram`;

  return [
    `🔥 [리턴픽 ${score?.verdict ?? "추천"}] ${score?.total_score ?? "-"}점`,
    "",
    `${product.title}`,
    `반품가: ${formatPrice(product.return_price)}`,
    `할인율: 약 ${formatPercent(discountRate)}`,
    "",
    "좋은 점:",
    ...reasons.map((reason) => `• ${reason}`),
    "",
    "주의:",
    ...risks.map((risk) => `• ${risk}`),
    "",
    "자세히 보기:",
    detailUrl,
    "",
    "제휴 안내:",
    "구매 발생 시 운영자가 수수료를 받을 수 있습니다."
  ].join("\n");
}

export async function sendTelegramForProduct(productId: string) {
  const product = await getProductById(productId);
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  if (!product.is_published || product.sourcing_status !== "published") {
    throw new Error("ONLY_PUBLISHED_PRODUCTS_CAN_BE_SENT");
  }

  const message = buildTelegramMessage(product);
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    await createTelegramLog({
      product_id: product.id,
      message,
      status: "API_NOT_CONFIGURED",
      error: "TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 없습니다."
    });
    return { status: "API_NOT_CONFIGURED" as const, message };
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      disable_web_page_preview: false
    })
  });

  if (!response.ok) {
    const error = await response.text();
    await createTelegramLog({ product_id: product.id, message, status: "error", error });
    throw new Error(error);
  }

  await createTelegramLog({ product_id: product.id, message, status: "sent", error: null });
  return { status: "sent" as const, message };
}
