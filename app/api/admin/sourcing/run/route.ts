import { NextResponse } from "next/server";
import { listSourcingRuns } from "@/lib/dataStore";
import { runSourcing } from "@/lib/sourcing";
import { requireAdmin } from "@/lib/validators";

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const runs = await listSourcingRuns(10);
  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  const run = await runSourcing({ useMockFallback: body.useMockFallback ?? true });
  return NextResponse.json({ run });
}
