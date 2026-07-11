import { NextResponse } from "next/server";
import { listProducts } from "@/lib/dataStore";
import { backfillNaverLowestPrices } from "@/lib/naverPriceBackfill";
import { requireAdmin } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function positiveInteger(value: unknown, fallback: number) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function priceBackfillErrorResponse(error: unknown) {
  const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_PRICE_BACKFILL_ERROR";
  return NextResponse.json({ error: "PRICE_BACKFILL_FAILED", message }, { status: 500 });
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const products = await listProducts();
    const published = products.filter((product) => product.is_published && product.sourcing_status === "published");
    const needsReview = products.filter((product) => product.sourcing_status === "needs_review");
    return NextResponse.json({
      summary: {
        total: products.length,
        missing_naver_lowest_price: products.filter((product) => !product.naver_lowest_price).length,
        published_missing_naver_lowest_price: published.filter((product) => !product.naver_lowest_price).length,
        needs_review_missing_naver_lowest_price: needsReview.filter((product) => !product.naver_lowest_price).length,
        naver_api_configured: Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET)
      }
    });
  } catch (error) {
    return priceBackfillErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await backfillNaverLowestPrices({
      publishedOnly: body.publishedOnly !== false,
      onlyMissing: body.onlyMissing !== false,
      limit: positiveInteger(body.limit, 30)
    });

    return NextResponse.json({ result });
  } catch (error) {
    return priceBackfillErrorResponse(error);
  }
}
