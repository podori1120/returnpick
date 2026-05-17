import { NextResponse } from "next/server";
import type { Category, ConditionGrade, SourcingStatus } from "@/lib/types";

const categorySet = new Set(["laptop", "monitor", "robot_vacuum", "cordless_vacuum", "air_purifier", "dehumidifier"]);
const conditionSet = new Set(["미개봉", "최상", "상", "중", "알수없음", "확인필요"]);
const statusSet = new Set(["candidate", "needs_review", "approved", "published", "rejected", "sold_out", "error"]);

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
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) return null;

  const headerPassword = request.headers.get("x-admin-password");
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (headerPassword === configured || bearer === configured) return null;

  return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
}

export function sanitizeText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim();
}
