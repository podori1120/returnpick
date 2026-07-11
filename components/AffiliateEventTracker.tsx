"use client";

import { useEffect } from "react";
import { getCurrentUtmSource, getStoredJsonArray, getUtmSource, setStoredJsonArray, trackAffiliateEvent } from "@/lib/clientTracking";

export function ProductImpressionTracker({ productIds, channel = "web" }: { productIds: string[]; channel?: string }) {
  useEffect(() => {
    const seenKey = "returnpick_impressed_deals";
    const seen = new Set(getStoredJsonArray<string>(seenKey));
    const nextIds = productIds.filter((id) => !seen.has(id)).slice(0, 24);
    for (const id of nextIds) {
      seen.add(id);
      trackAffiliateEvent({ productId: id, eventType: "impression", channel });
    }
    setStoredJsonArray(seenKey, Array.from(seen).slice(-500));
  }, [channel, productIds]);

  return null;
}

export function DealViewTracker({ productId, title }: { productId: string; title: string }) {
  useEffect(() => {
    const currentUtmSource = getCurrentUtmSource();
    const utmSource = currentUtmSource ?? getUtmSource();
    const isTelegramLanding = currentUtmSource === "telegram";
    trackAffiliateEvent({
      productId,
      eventType: isTelegramLanding ? "telegram_detail_click" : "detail_view",
      channel: isTelegramLanding ? "telegram" : "web",
      utmSource
    });

    const recentKey = "returnpick_recent_deals";
    const recent = getStoredJsonArray<{ id: string; title: string; at: string }>(recentKey).filter((item) => item.id !== productId);
    recent.unshift({ id: productId, title, at: new Date().toISOString() });
    setStoredJsonArray(recentKey, recent.slice(0, 20));
  }, [productId, title]);

  return null;
}
