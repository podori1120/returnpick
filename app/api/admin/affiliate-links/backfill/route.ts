import { NextResponse } from "next/server";
import { backfillCoupangAffiliateLinks } from "@/lib/affiliateLinkBackfill";
import { requireAdmin } from "@/lib/validators";

function positiveInteger(value: unknown, fallback: number) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function affiliateBackfillErrorResponse(error: unknown) {
  const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_AFFILIATE_BACKFILL_ERROR";
  return NextResponse.json({ error: "AFFILIATE_BACKFILL_FAILED", message }, { status: 500 });
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const limit = positiveInteger(body.limit, 20);
    const dryRun = body.dryRun === true;
    const result = await backfillCoupangAffiliateLinks({ limit, dryRun, timeBudgetMs: 52_000 });
    return NextResponse.json(result);
  } catch (error) {
    return affiliateBackfillErrorResponse(error);
  }
}
