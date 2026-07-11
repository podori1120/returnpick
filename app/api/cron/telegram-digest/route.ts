import { requireCronAuth, cronErrorJson, cronJson, cronProbeJson, isCronProbeRequest } from "@/lib/cron";
import { runScheduledTelegramDigest } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function positiveInteger(value: unknown, fallback: number) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;
  if (isCronProbeRequest(request)) return cronProbeJson("telegram_digest");

  try {
    const url = new URL(request.url);
    const result = await runScheduledTelegramDigest(positiveInteger(url.searchParams.get("limit"), 1));
    return cronJson({ result });
  } catch (error) {
    return cronErrorJson("telegram_digest", "CRON_TELEGRAM_DIGEST_FAILED", error);
  }
}
