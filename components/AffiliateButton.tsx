"use client";

import { ExternalLink } from "lucide-react";
import { getUtmSource, trackAffiliateEvent } from "@/lib/clientTracking";
import { isUsableAffiliateUrl } from "@/lib/coupangLink";

function cleanTrackingPlacement(value?: string) {
  const cleaned = value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return cleaned || null;
}

function buildTrackingChannel(channel: string | undefined, placement: string | undefined, utmSource: string | null) {
  const base = channel ?? (utmSource === "telegram" ? "telegram" : "web");
  const cleanedPlacement = cleanTrackingPlacement(placement);
  return cleanedPlacement ? `${base}_${cleanedPlacement}`.slice(0, 80) : base;
}

export default function AffiliateButton({
  productId,
  href,
  className,
  label = "쿠팡에서 가격 확인",
  disabledLabel = "링크 확인필요",
  channel,
  placement,
  context,
  sponsored = true
}: {
  productId: string;
  href: string | null | undefined;
  className?: string;
  label?: string;
  disabledLabel?: string;
  channel?: string;
  placement?: string;
  context?: string;
  sponsored?: boolean;
}) {
  const affiliateHref = typeof href === "string" ? href.trim() : "";
  const affiliateLinkReady = isUsableAffiliateUrl(affiliateHref);

  if (!affiliateLinkReady) {
    return (
      <button
        className={className ?? "focus-ring inline-flex w-full items-center justify-center rounded-lg border border-line px-4 py-3 text-sm font-black text-steel"}
        disabled
        type="button"
      >
        {disabledLabel}
      </button>
    );
  }

  return (
    <a
      className={
        className ??
        "focus-ring inline-flex w-full items-center justify-center gap-2 rounded-lg bg-pine px-4 py-3 text-sm font-black text-white hover:bg-ink"
      }
      href={affiliateHref}
      onClick={() => {
        const utmSource = getUtmSource();
        const resolvedChannel = buildTrackingChannel(channel, placement, utmSource);
        if (sponsored) trackAffiliateEvent({ productId, eventType: "affiliate_click", channel: resolvedChannel, utmSource, context });
      }}
      rel={sponsored ? "sponsored nofollow noopener noreferrer" : "nofollow noopener noreferrer"}
      target="_blank"
    >
      {label} <ExternalLink size={16} aria-hidden />
    </a>
  );
}
