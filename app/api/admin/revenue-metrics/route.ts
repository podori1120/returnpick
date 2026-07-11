import { NextResponse } from "next/server";
import { getRevenueMetrics } from "@/lib/dataStore";
import { requireAdmin } from "@/lib/validators";

function revenueMetricsErrorResponse(error: unknown) {
  const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_REVENUE_METRICS_ERROR";
  return NextResponse.json({ error: "REVENUE_METRICS_FAILED", message }, { status: 500 });
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const metrics = await getRevenueMetrics();
    return NextResponse.json({ metrics });
  } catch (error) {
    return revenueMetricsErrorResponse(error);
  }
}
