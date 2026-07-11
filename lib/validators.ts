import { NextResponse } from "next/server";
import type { Category, ConditionGrade, SourcingStatus } from "@/lib/types";

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

export function requireAdmin(request: Request) {
  const configured = process.env.ADMIN_PASSWORD?.trim();
  if (!configured) {
    if (process.env.NODE_ENV !== "production") return null;
    return NextResponse.json({ error: "ADMIN_PASSWORD_NOT_CONFIGURED" }, { status: 503 });
  }

  if (process.env.NODE_ENV === "production" && !isStrongAdminPassword(configured)) {
    return NextResponse.json({ error: "ADMIN_PASSWORD_WEAK_CONFIGURATION" }, { status: 503 });
  }

  const headerPassword = request.headers.get("x-admin-password");
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (headerPassword === configured || bearer === configured) return null;

  return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
}

export function sanitizeText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim();
}
