import type { JsonValue } from "@/lib/types";

export const MANUAL_CATALOG_REVIEW_KEY = "manual_catalog_review";
export const MANUAL_CATALOG_REVIEW_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

type JsonRecord = { [key: string]: JsonValue };

function isRecord(value: JsonValue | undefined): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validTimestamp(value: JsonValue | undefined) {
  if (typeof value !== "string" || !value.trim()) return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
}

export function isManualCatalogSource(source: string | null | undefined) {
  const normalized = source?.trim().toLowerCase();
  return normalized === "manual_admin" || normalized === "manual_affiliate_link";
}

export function createManualCatalogReview(rawJson: JsonRecord | null | undefined, reviewedAt = new Date().toISOString()) {
  return {
    ...(rawJson ?? {}),
    [MANUAL_CATALOG_REVIEW_KEY]: {
      status: "approved",
      method: "manual",
      reviewed_at: reviewedAt
    }
  } satisfies JsonRecord;
}

export function getManualCatalogReviewAt(rawJson: JsonRecord | null | undefined) {
  const value = rawJson?.[MANUAL_CATALOG_REVIEW_KEY];
  if (!isRecord(value) || value.status !== "approved" || value.method !== "manual") return null;
  return validTimestamp(value.reviewed_at);
}

export function isFreshManualCatalogReview(rawJson: JsonRecord | null | undefined, nowMs = Date.now()) {
  const reviewedAt = getManualCatalogReviewAt(rawJson);
  if (!reviewedAt) return false;
  const reviewedAtMs = Date.parse(reviewedAt);
  return reviewedAtMs <= nowMs && nowMs - reviewedAtMs <= MANUAL_CATALOG_REVIEW_MAX_AGE_MS;
}
