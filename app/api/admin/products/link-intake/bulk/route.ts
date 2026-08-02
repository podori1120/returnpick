import { NextResponse } from "next/server";
import { POST as intakeOne } from "@/app/api/admin/products/link-intake/route";
import { requireAdmin } from "@/lib/validators";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_ITEMS = 8;
const MAX_BODY_BYTES = 64_000;
const MAX_CONCURRENCY = 2;

type IntakeItem = {
  title?: unknown;
  category?: unknown;
  affiliate_url?: unknown;
  coupang_url?: unknown;
  image_url?: unknown;
  public_note?: unknown;
  admin_memo?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function pickItem(value: unknown): IntakeItem | null {
  if (!isObject(value)) return null;
  return {
    title: value.title,
    category: value.category,
    affiliate_url: value.affiliate_url,
    coupang_url: value.coupang_url,
    image_url: value.image_url,
    public_note: value.public_note,
    admin_memo: value.admin_memo
  };
}

function resultStatus(status: number) {
  return status >= 200 && status < 300 ? "inserted" : "error";
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "BULK_BODY_TOO_LARGE", message: "일괄 등록 요청은 64KB 이하로 보내 주세요." }, { status: 413 });
    }

    let body: { items?: unknown };
    try {
      body = JSON.parse(raw || "{}") as { items?: unknown };
    } catch {
      return NextResponse.json({ error: "INVALID_JSON", message: "일괄 등록 요청 형식을 확인해 주세요." }, { status: 400 });
    }
    const items = Array.isArray(body.items) ? body.items.map(pickItem).filter((item): item is IntakeItem => Boolean(item)) : null;
    if (!items?.length) {
      return NextResponse.json({ error: "ITEMS_REQUIRED", message: "등록할 상품 목록이 없습니다." }, { status: 400 });
    }
    if (items.length > MAX_ITEMS) {
      return NextResponse.json({ error: "TOO_MANY_ITEMS", message: `한 번에 최대 ${MAX_ITEMS}개까지 등록할 수 있습니다.` }, { status: 400 });
    }

    const childHeaders = new Headers(request.headers);
    childHeaders.set("content-type", "application/json");
    childHeaders.delete("content-length");
    childHeaders.delete("transfer-encoding");
    const results: Array<{ index: number; status: string; product_id: string | null; error: string | null; message: string | null; operator_next_action: string | null }> = [];

    // Reuse the single-item gate so batch intake never gets a weaker identity or publishing rule.
    // Two in-flight checks keep onboarding quick without turning a pasted batch into a burst.
    for (let start = 0; start < items.length; start += MAX_CONCURRENCY) {
      const batch = items.slice(start, start + MAX_CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (item, offset) => {
          const response = await intakeOne(
            new Request(request.url, {
              method: "POST",
              headers: childHeaders,
              body: JSON.stringify(item)
            })
          );
          const data = (await response.json().catch(() => ({}))) as {
            error?: string;
            message?: string;
            operator_next_action?: string;
            product?: { id?: string };
          };
          return {
            index: start + offset + 1,
            status: resultStatus(response.status),
            product_id: data.product?.id ?? null,
            error: data.error ?? null,
            message: data.message ?? null,
            operator_next_action: data.operator_next_action ?? null
          };
        })
      );
      results.push(...batchResults);
    }

    const insertedCount = results.filter((item) => item.status === "inserted").length;
    const errorCount = results.length - insertedCount;
    return NextResponse.json({
      status: errorCount === 0 ? "ok" : insertedCount > 0 ? "partial" : "error",
      scanned_count: results.length,
      inserted_count: insertedCount,
      error_count: errorCount,
      items: results
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "UNKNOWN_BULK_AFFILIATE_LINK_INTAKE_ERROR";
    return NextResponse.json({ error: "BULK_AFFILIATE_LINK_INTAKE_FAILED", message }, { status: 500 });
  }
}
