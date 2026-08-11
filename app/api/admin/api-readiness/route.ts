import { NextResponse } from "next/server";
import { getApiReadinessSummary, getSupabaseStorageReadiness, runApiConnectionChecks } from "@/lib/apiReadiness";
import { getPublicWebRuntimeProfile } from "@/lib/providers/publicWebProfile";
import { requireAdmin } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function apiReadinessErrorResponse(error: unknown) {
  const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_API_READINESS_ERROR";
  return NextResponse.json({ error: "API_READINESS_FAILED", message }, { status: 500 });
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const readiness = getApiReadinessSummary();
    const storage = await getSupabaseStorageReadiness();
    const publicWebProfile = getPublicWebRuntimeProfile();
    return NextResponse.json({ readiness, storage, publicWebProfile });
  } catch (error) {
    return apiReadinessErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const checks = await runApiConnectionChecks();
    const readiness = getApiReadinessSummary();
    const storage = await getSupabaseStorageReadiness();
    const publicWebProfile = getPublicWebRuntimeProfile();
    return NextResponse.json({ readiness, storage, checks, publicWebProfile });
  } catch (error) {
    return apiReadinessErrorResponse(error);
  }
}
