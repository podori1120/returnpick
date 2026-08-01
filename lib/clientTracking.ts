import type { AffiliateEventType } from "@/lib/types";

export type SavedDealItem = {
  id: string;
  title: string;
  savedAt: string;
};

export const savedDealsStorageKey = "returnpick_saved_deals";
export const savedDealsChangeEvent = "returnpick_saved_deals_changed";

export type ManualAffiliateEventContext =
  | "approval_sample"
  | "editorial_pick"
  | "editorial_home_card"
  | "editorial_deals_card"
  | "editorial_picks_card";

const sessionKey = "returnpick_anon_session_id";
const utmSourceKey = "returnpick_utm_source";
const utmSourceAtKey = "returnpick_utm_source_at";
const utmSourceTtlMs = 7 * 24 * 60 * 60 * 1000;

function storedValue(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStoredValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Tracking storage is best-effort; it must never block a purchase click.
  }
}

function removeStoredValue(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage errors in locked-down browser contexts.
  }
}

function randomByte() {
  if (globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(new Uint8Array(1))[0];
  }
  return Math.floor(Math.random() * 256);
}

function createUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) => (Number(char) ^ (randomByte() & (15 >> (Number(char) / 4)))).toString(16));
}

export function getAnonSessionId() {
  if (typeof window === "undefined") return null;
  const existing = storedValue(sessionKey);
  if (existing) return existing;
  const next = createUuid();
  setStoredValue(sessionKey, next);
  return next;
}

export function getCurrentUtmSource() {
  if (typeof window === "undefined") return null;
  const paramsSource = new URLSearchParams(window.location.search).get("utm_source");
  const source = paramsSource?.trim() || null;
  if (source) {
    setStoredValue(utmSourceKey, source);
    setStoredValue(utmSourceAtKey, String(Date.now()));
    return source;
  }

  return null;
}

export function getUtmSource() {
  if (typeof window === "undefined") return null;
  const source = getCurrentUtmSource();
  if (source) return source;

  const persisted = storedValue(utmSourceKey);
  if (!persisted) return null;

  const persistedAtRaw = storedValue(utmSourceAtKey);
  const persistedAt = persistedAtRaw ? Number(persistedAtRaw) : NaN;
  if (!Number.isFinite(persistedAt) || Date.now() - persistedAt > utmSourceTtlMs) {
    removeStoredValue(utmSourceKey);
    removeStoredValue(utmSourceAtKey);
    return null;
  }

  return persisted.trim() || null;
}

export function getStoredJsonArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = storedValue(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function setStoredJsonArray<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  setStoredValue(key, JSON.stringify(value));
}

export function getSavedDealItems() {
  return getStoredJsonArray<SavedDealItem>(savedDealsStorageKey)
    .filter((item) => typeof item?.id === "string" && typeof item?.title === "string" && item.id && item.title)
    .slice(0, 12);
}

export function setSavedDealItems(items: SavedDealItem[]) {
  setStoredJsonArray(savedDealsStorageKey, items.slice(0, 12));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(savedDealsChangeEvent));
  }
}

function sendEventWithFetch(payload: string) {
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true
  }).catch(() => undefined);
}

export function trackAffiliateEvent(input: {
  productId?: string | null;
  eventType: AffiliateEventType;
  channel?: string;
  utmSource?: string | null;
  context?: ManualAffiliateEventContext;
}) {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({
      product_id: input.productId,
      event_type: input.eventType,
      channel: input.channel ?? "web",
      anon_session_id: getAnonSessionId(),
      referrer: document.referrer || null,
      utm_source: input.utmSource ?? getUtmSource(),
      context: input.context ?? null
    });

    if (navigator.sendBeacon) {
      const queued = navigator.sendBeacon("/api/events", new Blob([payload], { type: "application/json" }));
      if (queued) return;
    }

    sendEventWithFetch(payload);
  } catch {
    // Analytics is best-effort. A failed tracker must never block navigation to Coupang.
  }
}
