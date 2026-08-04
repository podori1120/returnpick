import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import type { Category, ConditionGrade, SourcingStatus } from "@/lib/types";

export const ADMIN_SESSION_COOKIE = "returnpick_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const categorySet = new Set(["laptop", "monitor", "robot_vacuum", "cordless_vacuum", "air_purifier", "dehumidifier"]);
const conditionSet = new Set(["미개봉", "최상", "상", "중", "알수없음", "확인필요"]);
const statusSet = new Set(["candidate", "needs_review", "approved", "published", "rejected", "sold_out", "error"]);

function looksLikePlaceholder(value: string) {
  const raw = value.trim().toLowerCase();
  return (
    raw.includes("your_") ||
    raw.includes("your-") ||
    raw.includes("change_me") ||
    raw.includes("changeme") ||
    raw.includes("placeholder") ||
    raw.includes("todo") ||
    raw.includes("발급") ||
    raw.includes("입력") ||
    raw === "admin" ||
    raw === "test" ||
    raw === "secret" ||
    raw === "password" ||
    raw.startsWith("<") ||
    raw.endsWith(">")
  );
}

export function isStrongAdminPassword(value: string | undefined) {
  const raw = value?.trim() ?? "";
  if (raw.length < 12) return false;
  if (/\s/.test(raw)) return false;
  if (looksLikePlaceholder(raw)) return false;
  return true;
}

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && categorySet.has(value);
}

export function isConditionGrade(value: unknown): value is ConditionGrade {
  return typeof value === "string" && conditionSet.has(value);
}

export function isSourcingStatus(value: unknown): value is SourcingStatus {
  return typeof value === "string" && statusSet.has(value);
}

function constantTimeEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function configuredAdminPassword() {
  return process.env.ADMIN_PASSWORD?.trim() ?? "";
}

function adminConfigurationError() {
  const configured = configuredAdminPassword();
  if (!configured && process.env.NODE_ENV === "production") return "ADMIN_PASSWORD_NOT_CONFIGURED";
  if (configured && process.env.NODE_ENV === "production" && !isStrongAdminPassword(configured)) {
    return "ADMIN_PASSWORD_WEAK_CONFIGURATION";
  }
  return null;
}

function sessionSignature(payload: string, configured: string) {
  return createHmac("sha256", configured).update(`returnpick-admin-session-v1:${payload}`).digest("base64url");
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName !== name) continue;
    try {
      return decodeURIComponent(rawValue.join("="));
    } catch {
      return null;
    }
  }
  return null;
}

function isSafeSessionRequest(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().replace(/:$/, "");
    const expectedHost = request.headers.get("host") || forwardedHost || requestUrl.host;
    const expectedProtocol = forwardedProtocol || requestUrl.protocol.replace(/:$/, "");
    const requestOrigin = new URL(`${expectedProtocol}://${expectedHost}`).origin;
    return new URL(origin).origin === requestOrigin;
  } catch {
    return false;
  }
}

export function authenticateAdminPassword(candidate: unknown) {
  const configurationError = adminConfigurationError();
  if (configurationError) return { ok: false as const, error: configurationError, status: 503 };

  const configured = configuredAdminPassword();
  if (!configured && process.env.NODE_ENV !== "production") return { ok: true as const, localOpenMode: true as const };
  if (typeof candidate !== "string" || candidate.length > 512 || !constantTimeEqual(candidate, configured)) {
    return { ok: false as const, error: "UNAUTHORIZED", status: 401 };
  }
  return { ok: true as const, localOpenMode: false as const };
}

export function createAdminSessionToken(now = Date.now()) {
  const configured = configuredAdminPassword();
  if (!configured) throw new Error("ADMIN_PASSWORD_NOT_CONFIGURED");
  const issuedAt = Math.floor(now / 1000);
  const expiresAt = issuedAt + ADMIN_SESSION_MAX_AGE_SECONDS;
  const payload = `${issuedAt}.${expiresAt}.${randomBytes(18).toString("base64url")}`;
  return `${payload}.${sessionSignature(payload, configured)}`;
}

export function verifyAdminSessionToken(token: string | null, now = Date.now()) {
  const configured = configuredAdminPassword();
  if (!configured || !token || token.length > 512) return false;
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const [issuedAtRaw, expiresAtRaw, nonce, signature] = parts;
  if (!/^\d{10}$/.test(issuedAtRaw) || !/^\d{10}$/.test(expiresAtRaw) || !/^[A-Za-z0-9_-]{20,40}$/.test(nonce)) return false;

  const issuedAt = Number(issuedAtRaw);
  const expiresAt = Number(expiresAtRaw);
  const nowSeconds = Math.floor(now / 1000);
  if (issuedAt > nowSeconds + 60 || expiresAt <= nowSeconds || expiresAt - issuedAt !== ADMIN_SESSION_MAX_AGE_SECONDS) return false;

  const payload = `${issuedAtRaw}.${expiresAtRaw}.${nonce}`;
  return constantTimeEqual(signature, sessionSignature(payload, configured));
}

export function isSameOriginAdminRequest(request: Request) {
  return isSafeSessionRequest(request);
}

export function requireAdmin(request: Request) {
  const configurationError = adminConfigurationError();
  if (configurationError) return NextResponse.json({ error: configurationError }, { status: 503 });

  const configured = configuredAdminPassword();
  if (!configured && process.env.NODE_ENV !== "production") return null;

  const headerPassword = request.headers.get("x-admin-password");
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if ((headerPassword && constantTimeEqual(headerPassword, configured)) || (bearer && constantTimeEqual(bearer, configured))) return null;

  const sessionToken = cookieValue(request, ADMIN_SESSION_COOKIE);
  if (verifyAdminSessionToken(sessionToken)) {
    if (!isSafeSessionRequest(request)) {
      return NextResponse.json({ error: "ADMIN_SESSION_ORIGIN_MISMATCH" }, { status: 403 });
    }
    return null;
  }

  return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
}

/**
 * Production writes must land in Supabase. The in-process store is intentionally
 * useful for local development, but it is not durable across serverless instances.
 */
export function requirePersistentStorage() {
  if (process.env.NODE_ENV !== "production" || getSupabaseServiceClient()) return null;

  return NextResponse.json(
    {
      error: "PERSISTENT_STORAGE_NOT_CONFIGURED",
      message: "운영 DB가 연결되지 않아 변경을 저장하지 않았습니다. 현재 화면은 승인 전 확인용 모드입니다.",
      operator_next_action: "Supabase SQL을 적용하고 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY를 Vercel Production에 등록한 뒤 다시 시도하세요."
    },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" }
    }
  );
}

export function sanitizeText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim();
}
