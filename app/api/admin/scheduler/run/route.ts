import { NextResponse } from "next/server";
import { runScheduledAffiliateBackfill, runScheduledSourcing, runScheduledTelegramDigest } from "@/lib/scheduler";
import { requireAdmin } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function positiveInteger(value: unknown, fallback: number) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function schedulerRunErrorResponse(error: unknown) {
  const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_SCHEDULER_RUN_ERROR";
  return NextResponse.json({ error: "SCHEDULER_RUN_FAILED", message }, { status: 500 });
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const job = body.job;

    if (job === "sourcing") {
      const result = await runScheduledSourcing();
      return NextResponse.json({ result });
    }

    if (job === "telegram_digest") {
      const result = await runScheduledTelegramDigest(positiveInteger(body.limit, 1));
      return NextResponse.json({ result });
    }

    if (job === "affiliate_backfill") {
      const result = await runScheduledAffiliateBackfill();
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: "INVALID_SCHEDULER_JOB", message: "지원하지 않는 자동 운영 작업입니다." }, { status: 400 });
  } catch (error) {
    return schedulerRunErrorResponse(error);
  }
}
