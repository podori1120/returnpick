import type { AffiliateEventType } from "@/lib/types";

const sessionKey = "returnpick_anon_session_id";

export function getAnonSessionId() {
  if (typeof window === "undefined") return null;
  const existing = window.localStorage.getItem(sessionKey);
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.localStorage.setItem(sessionKey, next);
  return next;
}

export function getUtmSource() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("utm_source");
}

export function trackAffiliateEvent(input: {
  productId: string;
  eventType: AffiliateEventType;
  channel?: string;
  utmSource?: string | null;
}) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    product_id: input.productId,
    event_type: input.eventType,
    channel: input.channel ?? "web",
    anon_session_id: getAnonSessionId(),
    referrer: document.referrer || null,
    utm_source: input.utmSource ?? getUtmSource()
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/events", new Blob([payload], { type: "application/json" }));
    return;
  }

  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true
  });
}
