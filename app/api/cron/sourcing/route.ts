import { requireCronAuth, cronJson } from "@/lib/cron";
import { runScheduledSourcing } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const result = await runScheduledSourcing();
  return cronJson({ result });
}
