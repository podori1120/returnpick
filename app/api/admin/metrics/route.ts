import { NextResponse } from "next/server";
import { getAdminMetrics } from "@/lib/dataStore";
import { requireAdmin } from "@/lib/validators";

function adminMetricsErrorResponse(error: unknown) {
  const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_ADMIN_METRICS_ERROR";
  return NextResponse.json({ error: "ADMIN_METRICS_FAILED", message }, { status: 500 });
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const metrics = await getAdminMetrics();
    return NextResponse.json({ metrics });
  } catch (error) {
    return adminMetricsErrorResponse(error);
  }
}
