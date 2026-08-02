import { NextResponse } from "next/server";
import { getRevenueMetrics, type RevenueMetricsPeriodDays } from "@/lib/dataStore";
import { requireAdmin } from "@/lib/validators";

function revenueMetricsErrorResponse(error: unknown) {
  const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_REVENUE_METRICS_ERROR";
  return NextResponse.json({ error: "REVENUE_METRICS_FAILED", message }, { status: 500 });
}

function getPeriodDays(request: Request): RevenueMetricsPeriodDays | null {
  const days = new URL(request.url).searchParams.get("days");
  if (days === null || days === "all") return "all";
  if (days === "7") return 7;
  if (days === "30") return 30;
  if (days === "90") return 90;
  return null;
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const periodDays = getPeriodDays(request);
  if (periodDays === null) {
    return NextResponse.json(
      { error: "INVALID_REVENUE_METRICS_DAYS", message: "days must be one of 7, 30, 90, or all." },
      { status: 400 }
    );
  }

  try {
    const metrics = await getRevenueMetrics(periodDays);
    return NextResponse.json({ metrics });
  } catch (error) {
    return revenueMetricsErrorResponse(error);
  }
}
