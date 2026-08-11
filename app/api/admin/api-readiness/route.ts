import { NextResponse } from "next/server";
import {
  getApiReadinessSummary,
  getSupabaseStorageReadiness,
  runApiConnectionChecks,
  type ApiReadinessCheckMode
} from "@/lib/apiReadiness";
import { getPublicWebRuntimeProfile } from "@/lib/providers/publicWebProfile";
import { requireAdmin } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function apiReadinessErrorResponse(error: unknown) {
  const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_API_READINESS_ERROR";
  return NextResponse.json({ error: "API_READINESS_FAILED", message }, { status: 500 });
}

function getCheckMode(request: Request): ApiReadinessCheckMode {
  return new URL(request.url).searchParams.get("mode") === "read_only" ? "read_only" : "full";
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
    const mode = getCheckMode(request);
    const checks = await runApiConnectionChecks(mode);
    const readiness = getApiReadinessSummary();
    const storage = await getSupabaseStorageReadiness();
    const publicWebProfile = getPublicWebRuntimeProfile();
    return NextResponse.json({ readiness, storage, checks, publicWebProfile, mode });
  } catch (error) {
    return apiReadinessErrorResponse(error);
  }
}
