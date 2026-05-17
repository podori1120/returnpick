"use client";

import { ExternalLink } from "lucide-react";
import { trackAffiliateEvent } from "@/lib/clientTracking";

export default function AffiliateButton({
  productId,
  href,
  className,
  label = "쿠팡에서 가격 확인",
  channel = "web"
}: {
  productId: string;
  href: string | null | undefined;
  className?: string;
  label?: string;
  channel?: string;
}) {
  if (!href) {
    return (
      <button
        className={className ?? "focus-ring inline-flex w-full items-center justify-center rounded-lg border border-line px-4 py-3 text-sm font-black text-steel"}
        disabled
        type="button"
      >
        링크 확인필요
      </button>
    );
  }

  return (
    <a
      className={
        className ??
        "focus-ring inline-flex w-full items-center justify-center gap-2 rounded-lg bg-pine px-4 py-3 text-sm font-black text-white hover:bg-ink"
      }
      href={href}
      onClick={() => trackAffiliateEvent({ productId, eventType: "affiliate_click", channel })}
      rel="sponsored nofollow noreferrer"
      target="_blank"
    >
      {label} <ExternalLink size={16} aria-hidden />
    </a>
  );
}
