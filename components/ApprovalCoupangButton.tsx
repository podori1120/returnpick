"use client";

import { ExternalLink } from "lucide-react";
import {
  getCurrentUtmSource,
  getUtmSource,
  trackAffiliateEvent,
  type ManualAffiliateEventContext
} from "@/lib/clientTracking";
import { isCoupangPartnersLink } from "@/lib/coupangLink";

export default function ApprovalCoupangButton({
  href,
  className = "focus-ring mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-pine px-4 py-3 text-sm font-black text-white hover:bg-ink",
  label = "쿠팡에서 가격 확인",
  channel = "web_approval_sample",
  telegramChannel,
  context = "approval_sample"
}: {
  href: string;
  className?: string;
  label?: string;
  channel?: string;
  telegramChannel?: string;
  context?: ManualAffiliateEventContext;
}) {
  const partnerLinkReady = isCoupangPartnersLink(href);

  if (!partnerLinkReady) {
    return (
      <button className={className.replace("bg-pine", "border border-line text-steel").replace("text-white", "")} disabled type="button">
        쿠팡 파트너스 링크 확인 필요
      </button>
    );
  }

  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      onClick={() => {
        const currentUtmSource = getCurrentUtmSource();
        const utmSource = currentUtmSource ?? getUtmSource();
        trackAffiliateEvent({
          eventType: "affiliate_click",
          channel: currentUtmSource === "telegram" && telegramChannel ? telegramChannel : channel,
          utmSource,
          context
        });
      }}
    >
      {label} <ExternalLink size={16} aria-hidden />
    </a>
  );
}
