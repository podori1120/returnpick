import { NextResponse } from "next/server";

export function requireCronAuth(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret && process.env.NODE_ENV !== "production") return null;

  const authorization = request.headers.get("authorization");
  if (secret && authorization === `Bearer ${secret}`) return null;

  return NextResponse.json({ error: "UNAUTHORIZED_CRON" }, { status: 401 });
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
