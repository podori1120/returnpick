export type PriceWatchItem = {
  productId: string;
  title: string;
  targetPrice: number;
  createdAt: string;
  baselinePrice?: number | null;
};

export const priceWatchStorageKey = "returnpick_price_watches";
export const priceWatchChangeEvent = "returnpick_price_watches_changed";
export const priceWatchNotificationStorageKey = "returnpick_price_watch_notifications";
export const maxPriceWatches = 12;
const priceWatchNotificationSessionStorageKey = "returnpick_price_watch_notifications_session";
const priceWatchNotificationTtlMs = 180 * 24 * 60 * 60 * 1000;
const inMemoryPriceWatchNotificationKeys = new Set<string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeOptionalPrice(value: unknown) {
  const price = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

function normalizePriceWatch(value: unknown): PriceWatchItem | null {
  if (!isRecord(value)) return null;

  const productId = typeof value.productId === "string" ? value.productId.trim() : "";
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const targetPrice = typeof value.targetPrice === "number" ? value.targetPrice : Number(value.targetPrice);
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  const baselinePrice = normalizeOptionalPrice(value.baselinePrice);

  if (!productId || !title || !Number.isSafeInteger(targetPrice) || targetPrice <= 0 || !createdAt || Number.isNaN(Date.parse(createdAt))) {
    return null;
  }

  return { productId, title, targetPrice, createdAt, baselinePrice };
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

export function getPriceWatchPriceDelta(currentPrice: number | null | undefined, baselinePrice: number | null | undefined) {
  if (
    typeof currentPrice !== "number" ||
    typeof baselinePrice !== "number" ||
    !Number.isSafeInteger(currentPrice) ||
    !Number.isSafeInteger(baselinePrice) ||
    currentPrice <= 0 ||
    baselinePrice <= 0
  ) {
    return null;
  }

  return currentPrice - baselinePrice;
}

export function getPriceWatchNotificationKey(item: Pick<PriceWatchItem, "productId" | "targetPrice">, currentPrice: number | null | undefined) {
  if (
    !item.productId ||
    !Number.isSafeInteger(item.targetPrice) ||
    item.targetPrice <= 0 ||
    typeof currentPrice !== "number" ||
    !Number.isSafeInteger(currentPrice) ||
    currentPrice <= 0
  ) {
    return null;
  }

  return `${item.productId}:${item.targetPrice}:${currentPrice}`;
}

type PriceWatchNotificationEntry = {
  productId: string;
  key: string;
  notifiedAt: number;
};

type PriceWatchNotificationStorage = {
  storage: Storage;
  key: string;
};

function getPriceWatchNotificationStorages() {
  if (typeof window === "undefined") return [] as PriceWatchNotificationStorage[];

  const storages: PriceWatchNotificationStorage[] = [];
  try {
    if (window.localStorage) storages.push({ storage: window.localStorage, key: priceWatchNotificationStorageKey });
  } catch {
    // Fall through to session storage when persistent storage is unavailable.
  }
  try {
    const storage = window.sessionStorage;
    if (storage && !storages.some((entry) => entry.storage === storage)) storages.push({ storage, key: priceWatchNotificationSessionStorageKey });
  } catch {
    // A locked-down browser may reject both storage surfaces.
  }
  return storages;
}

function parsePriceWatchNotificationEntries(raw: string | null) {
  if (!raw) return [] as PriceWatchNotificationEntry[];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value): PriceWatchNotificationEntry[] => {
      if (typeof value === "string") {
        const separator = value.indexOf(":");
        const productId = separator > 0 ? value.slice(0, separator) : "";
        return productId ? [{ productId, key: value, notifiedAt: 0 }] : [];
      }
      if (!isRecord(value)) return [];
      const productId = typeof value.productId === "string" ? value.productId.trim() : "";
      const key = typeof value.key === "string" ? value.key.trim() : "";
      const notifiedAt = typeof value.notifiedAt === "number" ? value.notifiedAt : Number(value.notifiedAt);
      return productId && key && Number.isFinite(notifiedAt) ? [{ productId, key, notifiedAt }] : [];
    });
  } catch {
    return [];
  }
}

function readPriceWatchNotificationEntries() {
  const entries = getPriceWatchNotificationStorages().flatMap(({ storage, key }) => {
    try {
      return parsePriceWatchNotificationEntries(storage.getItem(key));
    } catch {
      return [] as PriceWatchNotificationEntry[];
    }
  });
  const cutoff = Date.now() - priceWatchNotificationTtlMs;
  const seenProducts = new Set<string>();

  return entries
    .filter((entry) => entry.notifiedAt === 0 || entry.notifiedAt >= cutoff)
    .sort((left, right) => right.notifiedAt - left.notifiedAt)
    .filter((entry) => {
      if (seenProducts.has(entry.productId)) return false;
      seenProducts.add(entry.productId);
      return true;
    });
}

function writePriceWatchNotificationEntries(entries: PriceWatchNotificationEntry[]) {
  const storages = getPriceWatchNotificationStorages();
  for (const { storage, key } of storages) {
    try {
      storage.setItem(key, JSON.stringify(entries));
    } catch {
      // Try the next storage surface; notification history is best-effort.
    }
  }
}

export function getPriceWatchNotificationKeys() {
  return [...new Set([...inMemoryPriceWatchNotificationKeys, ...readPriceWatchNotificationEntries().map((entry) => entry.key)])];
}

export function hasPriceWatchNotificationBeenSent(key: string | null | undefined) {
  return Boolean(key && getPriceWatchNotificationKeys().includes(key));
}

export function markPriceWatchNotificationSent(key: string | null | undefined, productId?: string | null) {
  if (typeof window === "undefined" || !key) return;

  const separator = key.indexOf(":");
  const normalizedProductId = productId?.trim() || (separator > 0 ? key.slice(0, separator) : "");
  if (!normalizedProductId) return;

  inMemoryPriceWatchNotificationKeys.add(key);
  writePriceWatchNotificationEntries([
    { productId: normalizedProductId, key, notifiedAt: Date.now() },
    ...readPriceWatchNotificationEntries().filter((entry) => entry.productId !== normalizedProductId)
  ]);
}
