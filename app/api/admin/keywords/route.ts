import { NextResponse } from "next/server";
import { createKeyword, listKeywords, updateKeyword } from "@/lib/dataStore";
import { isCategory, requireAdmin, sanitizeText } from "@/lib/validators";
import { toNumberOrNull } from "@/lib/format";

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
  const keyword = sanitizeText(body.keyword);
  if (!keyword) return NextResponse.json({ error: "KEYWORD_REQUIRED" }, { status: 400 });
  if (!isCategory(body.category)) return NextResponse.json({ error: "INVALID_CATEGORY" }, { status: 400 });

  const created = await createKeyword({
    keyword,
    category: body.category,
    is_active: body.is_active !== false,
    min_price: toNumberOrNull(body.min_price),
    max_price: toNumberOrNull(body.max_price),
    min_discount_rate: body.min_discount_rate == null || body.min_discount_rate === "" ? null : Number(body.min_discount_rate)
  });

  return NextResponse.json({ keyword: created });
}

export async function PATCH(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = sanitizeText(body.id);
  if (!id) return NextResponse.json({ error: "KEYWORD_ID_REQUIRED" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if ("keyword" in body) patch.keyword = sanitizeText(body.keyword);
  if ("category" in body && isCategory(body.category)) patch.category = body.category;
  if ("is_active" in body) patch.is_active = Boolean(body.is_active);
  if ("min_price" in body) patch.min_price = toNumberOrNull(body.min_price);
  if ("max_price" in body) patch.max_price = toNumberOrNull(body.max_price);
  if ("min_discount_rate" in body) {
    patch.min_discount_rate = body.min_discount_rate == null || body.min_discount_rate === "" ? null : Number(body.min_discount_rate);
  }

  const updated = await updateKeyword(id, patch);
  return NextResponse.json({ keyword: updated });
}
