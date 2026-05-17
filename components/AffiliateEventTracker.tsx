"use client";

import { useEffect } from "react";
import { getUtmSource, trackAffiliateEvent } from "@/lib/clientTracking";

export function ProductImpressionTracker({ productIds, channel = "web" }: { productIds: string[]; channel?: string }) {
  useEffect(() => {
    const seenKey = "returnpick_impressed_deals";
    const seen = new Set(JSON.parse(window.localStorage.getItem(seenKey) || "[]") as string[]);
    const nextIds = productIds.filter((id) => !seen.has(id)).slice(0, 24);
    for (const id of nextIds) {
      seen.add(id);
      trackAffiliateEvent({ productId: id, eventType: "impression", channel });
    }
    window.localStorage.setItem(seenKey, JSON.stringify(Array.from(seen).slice(-500)));
  }, [channel, productIds]);

  return null;
}

export function DealViewTracker({ productId, title }: { productId: string; title: string }) {
  useEffect(() => {
    const utmSource = getUtmSource();
    trackAffiliateEvent({
      productId,
      eventType: utmSource === "telegram" ? "telegram_detail_click" : "detail_view",
      channel: utmSource === "telegram" ? "telegram" : "web",
      utmSource
    });

    const recentKey = "returnpick_recent_deals";
    const recent = (JSON.parse(window.localStorage.getItem(recentKey) || "[]") as Array<{ id: string; title: string; at: string }>).filter(
      (item) => item.id !== productId
    );
    recent.unshift({ id: productId, title, at: new Date().toISOString() });
    window.localStorage.setItem(recentKey, JSON.stringify(recent.slice(0, 20)));
  }, [productId, title]);

  return null;
}
