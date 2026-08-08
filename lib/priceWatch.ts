export type PriceWatchItem = {
  productId: string;
  title: string;
  targetPrice: number;
  createdAt: string;
};

export const priceWatchStorageKey = "returnpick_price_watches";
export const priceWatchChangeEvent = "returnpick_price_watches_changed";
export const maxPriceWatches = 12;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizePriceWatch(value: unknown): PriceWatchItem | null {
  if (!isRecord(value)) return null;

  const productId = typeof value.productId === "string" ? value.productId.trim() : "";
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const targetPrice = typeof value.targetPrice === "number" ? value.targetPrice : Number(value.targetPrice);
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";

  if (!productId || !title || !Number.isSafeInteger(targetPrice) || targetPrice <= 0 || !createdAt || Number.isNaN(Date.parse(createdAt))) {
    return null;
  }

  return { productId, title, targetPrice, createdAt };
}

function normalizeItems(items: unknown[]) {
  const seen = new Set<string>();
  return items
    .map(normalizePriceWatch)
    .filter((item): item is PriceWatchItem => {
      if (!item || seen.has(item.productId)) return false;
      seen.add(item.productId);
      return true;
    })
    .slice(0, maxPriceWatches);
}

export function getPriceWatchItems(): PriceWatchItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(priceWatchStorageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return normalizeItems(parsed);
  } catch {
    return [];
  }
}

export function getPriceWatchItem(productId: string) {
  return getPriceWatchItems().find((item) => item.productId === productId) ?? null;
}

export function setPriceWatchItems(items: PriceWatchItem[]) {
  if (typeof window === "undefined") return;

  const normalized = normalizeItems(items);
  try {
    window.localStorage.setItem(priceWatchStorageKey, JSON.stringify(normalized));
    window.dispatchEvent(new Event(priceWatchChangeEvent));
  } catch {
    // Local storage is best-effort and must never block product browsing.
  }
}

export function upsertPriceWatch(item: PriceWatchItem) {
  const next = [item, ...getPriceWatchItems().filter((current) => current.productId !== item.productId)];
  setPriceWatchItems(next);
}

export function removePriceWatch(productId: string) {
  setPriceWatchItems(getPriceWatchItems().filter((item) => item.productId !== productId));
}

export function evaluatePriceWatch(currentPrice: number | null | undefined, targetPrice: number | null | undefined) {
  if (typeof currentPrice !== "number" || typeof targetPrice !== "number" || !Number.isSafeInteger(currentPrice) || !Number.isSafeInteger(targetPrice) || currentPrice <= 0 || targetPrice <= 0) return "unknown" as const;
  return currentPrice <= targetPrice ? "hit" as const : "above" as const;
}
