import { requireCronAuth, cronJson } from "@/lib/cron";
import { runScheduledTelegramDigest } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 1);
  const result = await runScheduledTelegramDigest(Number.isFinite(limit) ? limit : 1);
  return cronJson({ result });
}
