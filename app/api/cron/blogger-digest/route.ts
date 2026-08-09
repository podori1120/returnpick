import { requireCronAuth, cronErrorJson, cronJson, cronProbeJson, isCronProbeRequest } from "@/lib/cron";
import { runScheduledBloggerDigest } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;
  if (isCronProbeRequest(request)) return cronProbeJson("blogger_digest");

  try {
    const result = await runScheduledBloggerDigest();
    return cronJson({ result });
  } catch (error) {
    return cronErrorJson("blogger_digest", "CRON_BLOGGER_DIGEST_FAILED", error);
  }
}
