import { requireCronAuth, cronErrorJson, cronJson, cronProbeJson, isCronProbeRequest } from "@/lib/cron";
import { runScheduledAffiliateBackfill } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;
  if (isCronProbeRequest(request)) return cronProbeJson("affiliate_backfill");

  try {
    const result = await runScheduledAffiliateBackfill();
    return cronJson({ result });
  } catch (error) {
    return cronErrorJson("affiliate_backfill", "CRON_AFFILIATE_BACKFILL_FAILED", error);
  }
}
