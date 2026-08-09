import type { ProductSnapshot } from "./types";

export type SnapshotPriceSource = "return_price" | "source_price" | "new_price";

export type PriceTrendPoint = {
  id: string;
  observedAt: string;
  price: number;
  source: SnapshotPriceSource;
};

export type PriceTrendSummary = {
  points: PriceTrendPoint[];
  lowestPrice: number | null;
  earliestPrice: number | null;
  latestPrice: number | null;
  latestObservedAt: string | null;
  delta: number | null;
  trend: "down" | "up" | "steady" | "unknown";
};

export type RecentPriceWindowSummary = {
  days: number;
  points: PriceTrendPoint[];
  lowestPrice: number | null;
  latestPrice: number | null;
  latestObservedAt: string | null;
};

function getSnapshotPrice(snapshot: ProductSnapshot): { price: number; source: SnapshotPriceSource } | null {
  const candidates: Array<[SnapshotPriceSource, number | null]> = [
    ["return_price", snapshot.return_price],
    ["source_price", snapshot.source_price],
    ["new_price", snapshot.new_price]
  ];
  const match = candidates.find(([, value]) => typeof value === "number" && Number.isSafeInteger(value) && value > 0);
  return match ? { source: match[0], price: match[1] as number } : null;
}

export function summarizePriceTrend(snapshots?: ProductSnapshot[] | null): PriceTrendSummary {
  const points = (snapshots ?? [])
    .map((snapshot) => {
      const price = getSnapshotPrice(snapshot);
      if (!price || !snapshot.id || !snapshot.observed_at || !Number.isFinite(Date.parse(snapshot.observed_at))) return null;
      return { id: snapshot.id, observedAt: snapshot.observed_at, ...price };
    })
    .filter((point): point is PriceTrendPoint => Boolean(point))
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));

  const first = points[0] ?? null;
  const latest = points.at(-1) ?? null;
  const lowestPrice = points.length ? Math.min(...points.map((point) => point.price)) : null;
  const comparable = Boolean(first && points.length > 1 && points.every((point) => point.source === first.source));
  const delta = comparable && first && latest ? latest.price - first.price : null;
  const trend = delta === null ? "unknown" : delta < 0 ? "down" : delta > 0 ? "up" : "steady";

  return {
    points,
    lowestPrice,
    earliestPrice: first?.price ?? null,
    latestPrice: latest?.price ?? null,
    latestObservedAt: latest?.observedAt ?? null,
    delta,
    trend
  };
}

export function summarizeRecentPriceWindow(
  snapshots?: ProductSnapshot[] | null,
  days = 30,
  now = new Date()
): RecentPriceWindowSummary {
  const windowDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 30;
  const nowMs = now.getTime();
  const endMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  const startMs = endMs - windowDays * 24 * 60 * 60 * 1000;
  const points = summarizePriceTrend(snapshots).points.filter((point) => {
    const observedMs = Date.parse(point.observedAt);
    return observedMs >= startMs && observedMs <= endMs;
  });
  const latest = points.at(-1) ?? null;

  return {
    days: windowDays,
    points,
    lowestPrice: points.length ? Math.min(...points.map((point) => point.price)) : null,
    latestPrice: latest?.price ?? null,
    latestObservedAt: latest?.observedAt ?? null
  };
}
