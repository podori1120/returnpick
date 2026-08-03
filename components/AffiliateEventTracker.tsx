"use client";

import { useEffect } from "react";
import { getCurrentUtmSource, getStoredJsonArray, getUtmSource, setStoredJsonArray, trackAffiliateEvent } from "@/lib/clientTracking";
import { getProductImpressionStorageKey } from "@/lib/impressionTracking";

export function ProductImpressionTracker({ productIds, channel = "web", context }: { productIds: string[]; channel?: string; context?: string }) {
  useEffect(() => {
    const seenKey = getProductImpressionStorageKey(channel, context);
    const seen = new Set(getStoredJsonArray<string>(seenKey));
    const nextIds = productIds.filter((id) => !seen.has(id)).slice(0, 24);
    for (const id of nextIds) {
      seen.add(id);
      trackAffiliateEvent({ productId: id, eventType: "impression", channel, context });
    }
    setStoredJsonArray(seenKey, Array.from(seen).slice(-500));
  }, [channel, context, productIds]);

  return null;
}

export function DealViewTracker({ productId, title, context = "deal_detail" }: { productId: string; title: string; context?: string }) {
  useEffect(() => {
    const currentUtmSource = getCurrentUtmSource();
    const utmSource = currentUtmSource ?? getUtmSource();
    const isTelegramLanding = currentUtmSource === "telegram";
    trackAffiliateEvent({
      productId,
      eventType: isTelegramLanding ? "telegram_detail_click" : "detail_view",
      channel: isTelegramLanding ? "telegram" : "web",
      utmSource,
      context
    });

    const recentKey = "returnpick_recent_deals";
    const recent = getStoredJsonArray<{ id: string; title: string; at: string }>(recentKey).filter((item) => item.id !== productId);
    recent.unshift({ id: productId, title, at: new Date().toISOString() });
    setStoredJsonArray(recentKey, recent.slice(0, 20));
  }, [context, productId, title]);

  return null;
}

export function EditorialPickViewTracker() {
  useEffect(() => {
    const currentUtmSource = getCurrentUtmSource();
    const utmSource = currentUtmSource ?? getUtmSource();
    const isTelegramLanding = currentUtmSource === "telegram";
    trackAffiliateEvent({
      eventType: isTelegramLanding ? "telegram_detail_click" : "detail_view",
      channel: isTelegramLanding ? "telegram_editorial_pick" : "web_editorial_pick",
      utmSource,
      context: "editorial_pick"
    });
  }, []);

  return null;
}

export function ApprovalSampleViewTracker() {
  useEffect(() => {
    const currentUtmSource = getCurrentUtmSource();
    const utmSource = currentUtmSource ?? getUtmSource();
    trackAffiliateEvent({
      eventType: "detail_view",
      channel: "web_approval_sample_detail",
      utmSource,
      context: "approval_sample"
    });
  }, []);

  return null;
}

const editorialCardTracking = {
  home: {
    context: "editorial_home_card",
    channel: "web_editorial_card_home"
  },
  deals: {
    context: "editorial_deals_card",
    channel: "web_editorial_card_deals"
  },
  picks: {
    context: "editorial_picks_card",
    channel: "web_editorial_card_picks"
  }
} as const;

export function EditorialPickImpressionTracker({ placement }: { placement: keyof typeof editorialCardTracking }) {
  useEffect(() => {
    const tracking = editorialCardTracking[placement];
    const seenKey = "returnpick_impressed_editorial_surfaces";
    const seen = new Set(getStoredJsonArray<string>(seenKey));
    if (seen.has(tracking.context)) return;

    trackAffiliateEvent({
      eventType: "impression",
      channel: tracking.channel,
      context: tracking.context
    });
    seen.add(tracking.context);
    setStoredJsonArray(seenKey, Array.from(seen));
  }, [placement]);

  return null;
}
