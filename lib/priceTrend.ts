import type { ProductSnapshot, ProductWithScore } from "./types";

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
  averagePrice: number | null;
  latestPrice: number | null;
  latestObservedAt: string | null;
};

export type RecentPricePositionStatus = "lowest" | "good" | "below_average" | "average_or_above" | "unknown";

export type RecentPricePosition = {
  days: number;
  status: RecentPricePositionStatus;
  label: string;
  description: string;
  currentPrice: number | null;
  lowestPrice: number | null;
  averagePrice: number | null;
  sampleCount: number;
  source: SnapshotPriceSource | null;
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
  now = new Date(),
  source?: SnapshotPriceSource
): RecentPriceWindowSummary {
  const windowDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 30;
  const nowMs = now.getTime();
  const endMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  const startMs = endMs - windowDays * 24 * 60 * 60 * 1000;
  const points = summarizePriceTrend(snapshots).points.filter((point) => {
    const observedMs = Date.parse(point.observedAt);
    return observedMs >= startMs && observedMs <= endMs && (!source || point.source === source);
  });
  const latest = points.at(-1) ?? null;

  return {
    days: windowDays,
    points,
    lowestPrice: points.length ? Math.min(...points.map((point) => point.price)) : null,
    averagePrice: points.length ? Math.round(points.reduce((total, point) => total + point.price, 0) / points.length) : null,
    latestPrice: latest?.price ?? null,
    latestObservedAt: latest?.observedAt ?? null
  };
}

export function getProductPriceSource(product: Pick<ProductWithScore, "return_price" | "source_price" | "new_price">): SnapshotPriceSource | null {
  if (typeof product.return_price === "number" && Number.isSafeInteger(product.return_price) && product.return_price > 0) return "return_price";
  if (typeof product.source_price === "number" && Number.isSafeInteger(product.source_price) && product.source_price > 0) return "source_price";
  if (typeof product.new_price === "number" && Number.isSafeInteger(product.new_price) && product.new_price > 0) return "new_price";
  return null;
}

export function getRecentPricePosition(
  snapshots: ProductSnapshot[] | null | undefined,
  currentPrice: number | null | undefined,
  currentSource: SnapshotPriceSource | null | undefined,
  days = 30,
  now = new Date()
): RecentPricePosition {
  const recent = summarizeRecentPriceWindow(snapshots, days, now, currentSource ?? undefined);
  const comparablePoints = recent.points;
  const windowDays = recent.days;
  const base = {
    days: windowDays,
    currentPrice: typeof currentPrice === "number" && Number.isSafeInteger(currentPrice) && currentPrice > 0 ? currentPrice : null,
    lowestPrice: comparablePoints.length ? Math.min(...comparablePoints.map((point) => point.price)) : null,
    averagePrice: comparablePoints.length ? Math.round(comparablePoints.reduce((total, point) => total + point.price, 0) / comparablePoints.length) : null,
    sampleCount: comparablePoints.length,
    source: currentSource ?? null
  };

  if (base.currentPrice == null || currentSource == null || comparablePoints.length < 2 || base.averagePrice == null || base.lowestPrice == null) {
    return {
      ...base,
      status: "unknown",
      label: "가격 시점 확인필요",
      description: `동일 가격 기준 관찰이 ${windowDays}일 안에 2회 이상 쌓이면 가격 시점을 표시합니다.`
    };
  }

  if (base.currentPrice <= base.lowestPrice) {
    return {
      ...base,
      status: "lowest",
      label: "최근 관찰 최저",
      description: `ReturnPick의 최근 ${windowDays}일 동일 가격 기준 관찰 최저 수준입니다. 시장 전체 최저가는 아니며 구매 전 쿠팡에서 다시 확인하세요.`
    };
  }

  const averageGap = (base.averagePrice - base.currentPrice) / base.averagePrice;
  if (averageGap >= 0.05) {
    return {
      ...base,
      status: "good",
      label: "좋은 구매 시점",
      description: `최근 ${windowDays}일 동일 가격 기준 관찰 평균보다 약 ${Math.round(averageGap * 100)}% 낮습니다. 자체 관찰 기준이므로 구매 전 조건을 다시 확인하세요.`
    };
  }

  if (base.currentPrice < base.averagePrice) {
    return {
      ...base,
      status: "below_average",
      label: "평균보다 낮음",
      description: `최근 ${windowDays}일 동일 가격 기준 관찰 평균보다 낮은 편입니다. 시장 전체 최저가를 뜻하지 않습니다.`
    };
  }

  return {
    ...base,
    status: "average_or_above",
    label: "평균권·상회",
    description: `최근 ${windowDays}일 동일 가격 기준 관찰 평균 이상입니다. 급하지 않다면 가격을 더 비교해 보세요.`
  };
}

/** Rank only positive, fresh timing evidence for conservative public sorting. */
export function getRecentPriceTimingRank(
  position: Pick<RecentPricePosition, "status" | "currentPrice">,
  isFresh: boolean
) {
  if (!isFresh || position.currentPrice == null) return 0;

  return {
    lowest: 4,
    good: 3,
    below_average: 2,
    average_or_above: 1,
    unknown: 0
  }[position.status];
}
