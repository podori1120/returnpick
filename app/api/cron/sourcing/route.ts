import { requireCronAuth, cronErrorJson, cronJson, cronProbeJson, isCronProbeRequest } from "@/lib/cron";
import { runScheduledSourcing } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;
  if (isCronProbeRequest(request)) return cronProbeJson("sourcing");

  try {
    const result = await runScheduledSourcing();
    return cronJson({ result });
  } catch (error) {
    return cronErrorJson("sourcing", "CRON_SOURCING_FAILED", error);
  }
}
