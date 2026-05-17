import { NextResponse } from "next/server";
import { getRevenueMetrics } from "@/lib/dataStore";
import { requireAdmin } from "@/lib/validators";

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const metrics = await getRevenueMetrics();
  return NextResponse.json({ metrics });
}
