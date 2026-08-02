import type { ProductSnapshot, ProductWithScore, SnapshotChangeFlag } from "@/lib/types";

export type DiscoveryObservation = {
  observedAt: string;
  flags: SnapshotChangeFlag[];
  labels: string[];
};

export type DiscoveryUpdate = {
  product: ProductWithScore;
  observedAt: string;
  flags: SnapshotChangeFlag[];
  labels: string[];
};

const changeLabels: Partial<Record<SnapshotChangeFlag, string>> = {
  NEW_PRODUCT: "신규 관찰",
  SOURCE_PRICE_CHANGED: "판매가 변동",
  RETURN_PRICE_CHANGED: "반품가 변동",
  NEW_PRICE_CHANGED: "새상품가 변동",
  NAVER_PRICE_CHANGED: "네이버 기준가 변동",
  STOCK_CHANGED: "재고 변동",
  CONDITION_CHANGED: "반품등급 변동",
  SOLD_OUT: "품절 확인",
  BACK_IN_STOCK: "재입고 확인"
};

function isValidTimestamp(value: string | null | undefined): value is string {
  return Boolean(value && Number.isFinite(new Date(value).getTime()));
}

function isSyntheticProduct(product: Pick<ProductWithScore, "source" | "source_product_id" | "raw_json">) {
  const source = product.source.trim().toLowerCase();
  const provider = typeof product.raw_json?.provider === "string" ? product.raw_json.provider.toLowerCase() : "";
  const demoSeed = product.raw_json?.demo_seed;

  return (
    !source ||
    source === "mock" ||
    source.includes("mock") ||
    source.includes("demo") ||
    provider.includes("mock") ||
    provider.includes("demo") ||
    demoSeed === true ||
    typeof demoSeed === "string" ||
    product.source_product_id?.startsWith("seed-") === true
  );
}

function uniqueSnapshots(product: ProductWithScore) {
  const snapshots = [product.latest_snapshot, ...(product.snapshots ?? []), ...(product.product_snapshots ?? [])].filter(
    (snapshot): snapshot is ProductSnapshot => Boolean(snapshot)
  );
  const seen = new Set<string>();
  return snapshots
    .filter((snapshot) => {
      if (seen.has(snapshot.id)) return false;
      seen.add(snapshot.id);
      return true;
    })
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at));
}

function isSourcingSnapshot(snapshot: ProductSnapshot) {
  return snapshot.raw_json?.observation_origin === "sourcing";
}

export function getProductDiscoveryObservation(product: ProductWithScore): DiscoveryObservation | null {
  if (product.source === "manual_admin" || isSyntheticProduct(product)) return null;

  const sourceSnapshot = uniqueSnapshots(product).find(isSourcingSnapshot);
  const observedAt = sourceSnapshot?.observed_at ?? (isValidTimestamp(product.last_observed_at) ? product.last_observed_at : null);
  if (!observedAt) return null;

  const flags = Array.from(new Set(sourceSnapshot?.change_flags ?? []));
  const labels = flags.map((flag) => changeLabels[flag]).filter((label): label is string => Boolean(label));
  return { observedAt, flags, labels };
}

export function getDiscoveryUpdates(
  products: ProductWithScore[],
  isPublicReady: (product: ProductWithScore) => boolean,
  limit = 6
): DiscoveryUpdate[] {
  const safeLimit = Math.max(0, Math.min(24, Math.floor(limit)));
  if (safeLimit === 0) return [];

  return products
    .filter(isPublicReady)
    .map((product) => {
      const observation = getProductDiscoveryObservation(product);
      return observation ? { product, ...observation } : null;
    })
    .filter((update): update is DiscoveryUpdate => Boolean(update))
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt) || (b.product.latest_score?.total_score ?? 0) - (a.product.latest_score?.total_score ?? 0))
    .slice(0, safeLimit);
}
