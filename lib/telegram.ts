import { createTelegramLog, getProductById, listTelegramLogs } from "@/lib/dataStore";
import { approvalSampleProduct } from "@/lib/approvalSample";
import { buildEditorialPickTelegramMessage } from "@/lib/editorialCampaign";
import { formatPercent, formatPrice } from "@/lib/format";
import { isPublicDealReady } from "@/lib/publicDeal";
import { getAppliedDiscountRate } from "@/lib/priceReference";
import { getDealPriceLabel, getReturnEvidenceLabel } from "@/lib/quality";
import { getLatestScore } from "@/lib/scoring";
import { getSiteUrl } from "@/lib/siteUrl";
import type { ProductWithScore } from "@/lib/types";

const TELEGRAM_SEND_TIMEOUT_MS = 10000;
const TELEGRAM_MESSAGE_LIMIT = 3900;
const TELEGRAM_EDITORIAL_COOLDOWN_MS = 15 * 60 * 1000;
const TELEGRAM_AFFILIATE_NOTICE =
  "제휴 안내:\n이 메시지의 링크는 쿠팡 파트너스 활동의 일환이며, 구매가 발생하면 운영자가 일정액의 수수료를 받을 수 있습니다.";

function compactTelegramText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 240) : null;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = TELEGRAM_SEND_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function telegramErrorMessage(response: Response) {
  try {
    const text = await response.text();
    const payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    const detail =
      compactTelegramText(payload.description) ??
      compactTelegramText(payload.error_code) ??
      compactTelegramText(payload.message) ??
      compactTelegramText(text);
    return detail ? `TELEGRAM_HTTP_${response.status}: ${detail}` : `TELEGRAM_HTTP_${response.status}`;
  } catch {
    return `TELEGRAM_HTTP_${response.status}`;
  }
}

function telegramSendFailureMessage(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") return `TELEGRAM_SEND_TIMEOUT_${TELEGRAM_SEND_TIMEOUT_MS}MS`;
  if (error instanceof Error && error.message) return compactTelegramText(error.message) ?? "TELEGRAM_SEND_FAILED";
  return "TELEGRAM_SEND_FAILED";
}

function fitTelegramMessage(message: string, detailUrl: string) {
  if (message.length <= TELEGRAM_MESSAGE_LIMIT) return message;

  const footer = ["", "자세히 보기:", detailUrl, "", TELEGRAM_AFFILIATE_NOTICE].join("\n");
  const availableLength = TELEGRAM_MESSAGE_LIMIT - footer.length - 8;
  const trimmedBody = message.slice(0, Math.max(500, availableLength)).trimEnd();
  return `${trimmedBody}\n\n...\n${footer}`;
}

export function buildTelegramMessage(product: ProductWithScore) {
  const score = getLatestScore(product);
  const discountRate = getAppliedDiscountRate(product);
  const siteUrl = getSiteUrl();
  const reasons = score?.reasons?.slice(0, 2) ?? ["관리자가 가격과 상태를 확인한 추천 후보입니다."];
  const risks = score?.risk_flags?.length
    ? ["가격과 재고는 변동될 수 있습니다.", "반품등급과 구성품은 구매 전 쿠팡 상품 페이지에서 다시 확인하세요."]
    : ["가격과 재고는 변동될 수 있습니다."];
  const detailUrl = `${siteUrl.replace(/\/$/, "")}/deals/${product.id}?utm_source=telegram`;
  const dealPrice = product.return_price ?? product.source_price ?? product.new_price;

  const message = [
    `[리턴픽 ${score?.verdict ?? "추천"}] ${score?.total_score ?? "-"}점`,
    "",
    product.title,
    `${getDealPriceLabel(product)}: ${formatPrice(dealPrice)}`,
    `반품 정보: ${getReturnEvidenceLabel(product)}`,
    `할인율: 약 ${formatPercent(discountRate)}`,
    "",
    "좋은 점:",
    ...reasons.map((reason) => `- ${reason}`),
    "",
    "주의:",
    ...risks.map((risk) => `- ${risk}`),
    "",
    "자세히 보기:",
    detailUrl,
    "",
    TELEGRAM_AFFILIATE_NOTICE
  ].join("\n");

  return fitTelegramMessage(message, detailUrl);
}

export { buildEditorialPickTelegramMessage } from "@/lib/editorialCampaign";

type TelegramTarget = {
  type: "product" | "editorial_pick";
  key: string;
};

async function assertEditorialSendCooldown(target: TelegramTarget) {
  if (target.type !== "editorial_pick") return;
  const cutoff = Date.now() - TELEGRAM_EDITORIAL_COOLDOWN_MS;
  const logs = await listTelegramLogs(200);
  const recentlySent = logs.some(
    (log) =>
      log.target_type === target.type &&
      log.target_key === target.key &&
      log.status === "sent" &&
      Date.parse(log.created_at) >= cutoff
  );
  if (recentlySent) throw new Error("TELEGRAM_CAMPAIGN_RECENTLY_SENT");
}

async function sendTelegramMessage(message: string, productId: string | null, target: TelegramTarget) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    await createTelegramLog({
      product_id: productId,
      target_type: target.type,
      target_key: target.key,
      message,
      status: "API_NOT_CONFIGURED",
      error: "TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 없습니다."
    });
    return { status: "API_NOT_CONFIGURED" as const, message };
  }

  await assertEditorialSendCooldown(target);

  let response: Response;
  try {
    response = await fetchWithTimeout(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        disable_web_page_preview: false
      })
    });
  } catch (error) {
    const safeError = telegramSendFailureMessage(error);
    await createTelegramLog({ product_id: productId, target_type: target.type, target_key: target.key, message, status: "error", error: safeError });
    throw new Error(safeError);
  }

  if (!response.ok) {
    const error = await telegramErrorMessage(response);
    await createTelegramLog({ product_id: productId, target_type: target.type, target_key: target.key, message, status: "error", error });
    throw new Error(error);
  }

  await createTelegramLog({ product_id: productId, target_type: target.type, target_key: target.key, message, status: "sent", error: null });
  return { status: "sent" as const, message };
}

export async function sendTelegramForProduct(productId: string) {
  const product = await getProductById(productId);
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  if (!isPublicDealReady(product)) {
    throw new Error("ONLY_PUBLIC_CUSTOMER_READY_PRODUCTS_CAN_BE_SENT");
  }

  const message = buildTelegramMessage(product);
  return sendTelegramMessage(message, product.id, { type: "product", key: product.id });
}

export async function sendTelegramEditorialPick() {
  const message = buildEditorialPickTelegramMessage();
  return sendTelegramMessage(message, null, { type: "editorial_pick", key: approvalSampleProduct.editorialTelegramTarget });
}
