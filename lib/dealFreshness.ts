import type { ProductWithScore } from "@/lib/types";

export type DealFreshnessStatus = "fresh" | "stale" | "unknown";

export type DealFreshness = {
  status: DealFreshnessStatus;
  observedAt: string | null;
  ageHours: number | null;
  label: string;
  description: string;
};

const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

function latestValidTimestamp(values: Array<string | null | undefined>) {
  let latest: { value: string; time: number } | null = null;

  for (const value of values) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) continue;
    if (!latest || time > latest.time) latest = { value, time };
  }

  return latest;
}

export function getDealFreshnessFromTimestamps(values: Array<string | null | undefined>, nowMs = Date.now()): DealFreshness {
  const latest = latestValidTimestamp(values);
  if (!latest) {
    return {
      status: "unknown",
      observedAt: null,
      ageHours: null,
      label: "수집 시각 없음",
      description: "자동 수집 시각이 없어 쿠팡에서 현재 가격·재고·반품 조건을 먼저 확인해야 합니다."
    };
  }

  const ageMs = Math.max(0, nowMs - latest.time);
  const ageHours = Math.floor(ageMs / (60 * 60 * 1000));
  if (ageMs <= FRESH_WINDOW_MS) {
    return {
      status: "fresh",
      observedAt: latest.value,
      ageHours,
      label: "24시간 내 수집",
      description: "마지막 자동 수집 시각입니다. 현재 가격·재고·배송·반품 조건은 쿠팡에서 최종 확인하세요."
    };
  }

  return {
    status: "stale",
    observedAt: latest.value,
    ageHours,
    label: "재확인 우선",
    description: "마지막 자동 수집 후 24시간이 지났습니다. 가격·재고·반품 조건을 쿠팡에서 먼저 확인하세요."
  };
}

export function getDealFreshness(product: ProductWithScore, nowMs = Date.now()) {
  if (product.last_observed_at && Number.isFinite(new Date(product.last_observed_at).getTime())) {
    return getDealFreshnessFromTimestamps([product.last_observed_at], nowMs);
  }

  return getDealFreshnessFromTimestamps(
    [
      product.latest_snapshot?.observed_at,
      ...(product.snapshots ?? []).map((snapshot) => snapshot.observed_at),
      ...(product.product_snapshots ?? []).map((snapshot) => snapshot.observed_at)
    ],
    nowMs
  );
}
