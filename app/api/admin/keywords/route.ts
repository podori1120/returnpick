import { NextResponse } from "next/server";
import { createKeyword, listKeywords, updateKeyword } from "@/lib/dataStore";
import { isCategory, requireAdmin, sanitizeText } from "@/lib/validators";
import type { Category } from "@/lib/types";

type KeywordPayload = {
  keyword: string;
  category: Category;
  is_active?: boolean;
  min_price: number | null;
  max_price: number | null;
  min_discount_rate: number | null;
};

function validationError(error: string, message: string) {
  return NextResponse.json({ error, message }, { status: 400 });
}

function parseOptionalPrice(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return { ok: true as const, value: null };
  const raw = String(value).replace(/,/g, "").trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    return {
      ok: false as const,
      response: validationError("INVALID_KEYWORD_PRICE", `${field}는 0 이상의 정수 가격으로 입력하세요.`)
    };
  }
  return { ok: true as const, value: parsed };
}

function parseOptionalDiscountRate(value: unknown) {
  if (value === null || value === undefined || value === "") return { ok: true as const, value: null };
  const raw = String(value).trim();
  const hasPercent = raw.endsWith("%");
  const parsed = Number(raw.replace("%", ""));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return {
      ok: false as const,
      response: validationError("INVALID_KEYWORD_DISCOUNT_RATE", "최소 할인율은 0~1 사이 값 또는 0~100% 형식으로 입력하세요.")
    };
  }
  const rate = hasPercent || parsed > 1 ? parsed / 100 : parsed;
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    return {
      ok: false as const,
      response: validationError("INVALID_KEYWORD_DISCOUNT_RATE", "최소 할인율은 0~1 사이 값 또는 0~100% 형식으로 입력하세요.")
    };
  }
  return { ok: true as const, value: Number(rate.toFixed(4)) };
}

function buildKeywordPayload(body: Record<string, unknown>, partial = false): KeywordPayload | { response: NextResponse } {
  const keyword = sanitizeText(body.keyword);
  const category = sanitizeText(body.category);
  const minPrice = parseOptionalPrice(body.min_price, "최소가");
  const maxPrice = parseOptionalPrice(body.max_price, "최대가");
  const minDiscountRate = parseOptionalDiscountRate(body.min_discount_rate);

  if (!partial || "keyword" in body) {
    if (keyword.length < 2 || keyword.length > 80) {
      return { response: validationError("INVALID_KEYWORD", "키워드는 2~80자 사이로 입력하세요.") };
    }
  }
  if (!partial || "category" in body) {
    if (!isCategory(category)) return { response: validationError("INVALID_CATEGORY", "카테고리를 다시 선택하세요.") };
  }
  if (!minPrice.ok) return { response: minPrice.response };
  if (!maxPrice.ok) return { response: maxPrice.response };
  if (!minDiscountRate.ok) return { response: minDiscountRate.response };
  if (minPrice.value != null && maxPrice.value != null && minPrice.value > maxPrice.value) {
    return { response: validationError("INVALID_KEYWORD_PRICE_RANGE", "최소가는 최대가보다 클 수 없습니다.") };
  }

  return {
    keyword,
    category: category as Category,
    is_active: typeof body.is_active === "boolean" ? body.is_active : undefined,
    min_price: minPrice.value,
    max_price: maxPrice.value,
    min_discount_rate: minDiscountRate.value
  };
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const keywords = await listKeywords();
  return NextResponse.json({ keywords });
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const payload = buildKeywordPayload(body);
  if ("response" in payload) return payload.response;

  const created = await createKeyword({
    keyword: payload.keyword,
    category: payload.category,
    is_active: payload.is_active !== false,
    min_price: payload.min_price,
    max_price: payload.max_price,
    min_discount_rate: payload.min_discount_rate
  });

  return NextResponse.json({ keyword: created });
}

export async function PATCH(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = sanitizeText(body.id);
  if (!id) return NextResponse.json({ error: "KEYWORD_ID_REQUIRED" }, { status: 400 });
  const payload = buildKeywordPayload(body, true);
  if ("response" in payload) return payload.response;

  const patch: Record<string, unknown> = {};
  if ("keyword" in body) patch.keyword = payload.keyword;
  if ("category" in body) patch.category = payload.category;
  if ("is_active" in body) patch.is_active = Boolean(body.is_active);
  if ("min_price" in body) patch.min_price = payload.min_price;
  if ("max_price" in body) patch.max_price = payload.max_price;
  if ("min_discount_rate" in body) patch.min_discount_rate = payload.min_discount_rate;

  const updated = await updateKeyword(id, patch);
  return NextResponse.json({ keyword: updated });
}
