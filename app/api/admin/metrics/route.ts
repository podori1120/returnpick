import { NextResponse } from "next/server";
import { getAdminMetrics } from "@/lib/dataStore";
import { requireAdmin } from "@/lib/validators";

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const metrics = await getAdminMetrics();
  return NextResponse.json({ metrics });
}
