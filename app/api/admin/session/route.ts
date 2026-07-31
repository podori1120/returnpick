import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  authenticateAdminPassword,
  createAdminSessionToken,
  isSameOriginAdminRequest,
  requireAdmin
} from "@/lib/validators";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

function clearSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/admin",
    maxAge: 0
  });
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  return NextResponse.json({ authenticated: true }, { headers: noStoreHeaders });
}

export async function POST(request: Request) {
  if (!isSameOriginAdminRequest(request)) {
    return NextResponse.json({ error: "ADMIN_SESSION_ORIGIN_MISMATCH" }, { status: 403, headers: noStoreHeaders });
  }

  const body = (await request.json().catch(() => ({}))) as { password?: unknown };
  const authentication = authenticateAdminPassword(body.password);
  if (!authentication.ok) {
    return NextResponse.json({ error: authentication.error }, { status: authentication.status, headers: noStoreHeaders });
  }

  const response = NextResponse.json(
    { authenticated: true, expiresIn: authentication.localOpenMode ? null : ADMIN_SESSION_MAX_AGE_SECONDS },
    { headers: noStoreHeaders }
  );
  if (!authentication.localOpenMode) {
    response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/admin",
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS
    });
  }
  return response;
}

export async function DELETE(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const response = NextResponse.json({ authenticated: false }, { headers: noStoreHeaders });
  clearSessionCookie(response);
  return response;
}
