import { NextResponse } from "next/server";

export function requireCronAuth(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret && process.env.NODE_ENV !== "production") return null;

  const authorization = request.headers.get("authorization");
  if (secret && authorization === `Bearer ${secret}`) return null;

  return NextResponse.json({ error: "UNAUTHORIZED_CRON" }, { status: 401 });
}

export function isCronProbeRequest(request: Request) {
  const url = new URL(request.url);
  return url.searchParams.get("probe") === "1";
}

export function cronProbeJson(job: string) {
  return cronJson({
    result: {
      type: job,
      status: "authorized",
      probe: true,
      job_started: false
    }
  });
}

export function cronJson(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(
    {
      ok: status >= 200 && status < 300,
      executed_at: new Date().toISOString(),
      ...data
    },
    { status }
  );
}

export function cronErrorJson(job: string, code: string, error: unknown) {
  const message = error instanceof Error && error.message ? error.message.slice(0, 300) : `UNKNOWN_${code}`;
  return cronJson(
    {
      result: {
        type: job,
        status: "error",
        job_started: true
      },
      error: code,
      message
    },
    500
  );
}
