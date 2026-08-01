import { NextResponse } from "next/server";
import { calculateDealScore } from "@/lib/scoring";
import { createDealScore, getProductById, updateProduct } from "@/lib/dataStore";
import { mergeManualNaverPriceEvidence } from "@/lib/naverPriceTrust";
import { requireAdmin } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_ROWS = 80;
const MAX_PAYLOAD_BYTES = 24_000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ManualPriceItem = {
  product_id: string;
  title: string | null;
  status: "updated" | "skipped" | "error";
  price?: number;
  source_url?: string | null;
  reason?: string;
};

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message.slice(0, 180) : "NAVER_MANUAL_PRICE_UPDATE_FAILED";
}

function positivePrice(value: string | undefined) {
  const normalized = value?.trim().replace(/[\s,원₩]/g, "") ?? "";
  if (!/^\d+$/.test(normalized)) return null;
  const price = Number(normalized);
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

function naverReferenceUrl(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return { value: null, valid: true };
  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();
    const valid = url.protocol === "https:" && (host === "naver.com" || host.endsWith(".naver.com")) && !url.username && !url.password;
    return { value: normalized.slice(0, 2_000), valid };
  } catch {
    return { value: normalized.slice(0, 2_000), valid: false };
  }
}

function getEntries(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (typeof body.entries === "string") return body.entries.split(/\r?\n/g);
  if (Array.isArray(body.entries) && body.entries.every((entry) => typeof entry === "string")) return body.entries;
  return null;
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_PAYLOAD_BYTES) {
    return privateJson({ error: "NAVER_MANUAL_PRICE_PAYLOAD_TOO_LARGE", message: "수동 가격 입력이 너무 큽니다." }, 413);
  }

  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_PAYLOAD_BYTES) {
      return privateJson({ error: "NAVER_MANUAL_PRICE_PAYLOAD_TOO_LARGE", message: "수동 가격 입력이 너무 큽니다." }, 413);
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody || "{}");
    } catch {
      return privateJson({ error: "INVALID_JSON", message: "요청 형식을 확인해 주세요." }, 400);
    }
    const entries = getEntries(body);
    if (!entries) return privateJson({ error: "ENTRIES_REQUIRED", message: "상품 ID와 가격이 있는 탭 구분 행을 입력하세요." }, 400);

    const rows = entries.map((entry) => entry.trim()).filter(Boolean);
    if (rows.length > MAX_ROWS) return privateJson({ error: "TOO_MANY_ENTRIES", message: `한 번에 ${MAX_ROWS}줄까지 처리할 수 있습니다.` }, 400);

    const items: ManualPriceItem[] = [];
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const seenProductIds = new Set<string>();

    for (const entry of rows) {
      const fields = entry.split("\t");
      const productId = fields[0]?.trim() ?? "";
      const price = positivePrice(fields[1]);
      const reference = naverReferenceUrl(fields[2]);
      const matchedTitle = fields[3]?.trim().slice(0, 240) || null;

      if (fields.length < 2 || fields.length > 4 || !uuidPattern.test(productId)) {
        skippedCount += 1;
        items.push({ product_id: productId || "UNKNOWN", title: null, status: "skipped", reason: "PRODUCT_ID_REQUIRED" });
        continue;
      }
      if (price == null) {
        skippedCount += 1;
        items.push({ product_id: productId, title: null, status: "skipped", reason: "INVALID_NAVER_PRICE" });
        continue;
      }
      if (!reference.valid) {
        skippedCount += 1;
        items.push({ product_id: productId, title: null, status: "skipped", reason: "INVALID_NAVER_REFERENCE_URL" });
        continue;
      }
      if (seenProductIds.has(productId)) {
        skippedCount += 1;
        items.push({ product_id: productId, title: null, status: "skipped", reason: "DUPLICATE_PRODUCT_ID" });
        continue;
      }
      seenProductIds.add(productId);

      const product = await getProductById(productId);
      if (!product) {
        skippedCount += 1;
        items.push({ product_id: productId, title: null, status: "skipped", reason: "PRODUCT_NOT_FOUND" });
        continue;
      }

      const checkedAt = new Date().toISOString();
      try {
        const updated = await updateProduct(product.id, {
          naver_lowest_price: price,
          raw_json: mergeManualNaverPriceEvidence(product.raw_json, product, price, checkedAt, {
            sourceUrl: reference.value,
            matchedTitle
          })
        });
        updatedCount += 1;
        try {
          await createDealScore(calculateDealScore(updated));
        } catch (error) {
          errorCount += 1;
          items.push({ product_id: product.id, title: product.title, status: "error", price, source_url: reference.value, reason: `NAVER_MANUAL_PRICE_SCORE_FAILED:${errorMessage(error)}` });
          continue;
        }
        items.push({ product_id: product.id, title: product.title, status: "updated", price, source_url: reference.value });
      } catch (error) {
        errorCount += 1;
        items.push({ product_id: product.id, title: product.title, status: "error", price, source_url: reference.value, reason: `NAVER_MANUAL_PRICE_UPDATE_FAILED:${errorMessage(error)}` });
      }
    }

    return privateJson({
      status: errorCount > 0 ? (updatedCount > 0 ? "partial" : "error") : skippedCount > 0 ? "partial" : "ok",
      scanned_count: rows.length,
      updated_count: updatedCount,
      skipped_count: skippedCount,
      error_count: errorCount,
      items,
      message: `관리자가 동일 상품으로 확인한 네이버 가격 ${updatedCount}개를 저장했습니다. 입력 행 ${rows.length}개를 처리했습니다.`
    });
  } catch (error) {
    return privateJson({ error: "NAVER_MANUAL_PRICE_FAILED", message: errorMessage(error) }, 500);
  }
}
