import { NextResponse } from "next/server";
import { getSchedulerInsights } from "@/lib/schedulerInsights";
import { requireAdmin } from "@/lib/validators";

export const dynamic = "force-dynamic";

function schedulerHealthErrorResponse(error: unknown) {
  const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_SCHEDULER_HEALTH_ERROR";
  return NextResponse.json({ error: "SCHEDULER_HEALTH_FAILED", message }, { status: 500 });
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const insights = await getSchedulerInsights();
    return NextResponse.json({ insights });
  } catch (error) {
    return schedulerHealthErrorResponse(error);
  }
}
