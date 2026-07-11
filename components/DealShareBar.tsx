"use client";

import { Link2, Send, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { trackAffiliateEvent } from "@/lib/clientTracking";

function withUtmSource(url: string, utmSource: string, utmMedium: string) {
  const next = new URL(url);
  next.searchParams.set("utm_source", utmSource);
  next.searchParams.set("utm_medium", utmMedium);
  return next.toString();
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.left = "-1000px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export default function DealShareBar({ productId, canonicalUrl }: { productId: string; canonicalUrl: string }) {
  const telegramUrl = useMemo(() => withUtmSource(canonicalUrl, "telegram", "share"), [canonicalUrl]);
  const [copied, setCopied] = useState<null | "plain" | "telegram">(null);

  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-black text-ink hover:bg-mist"
        type="button"
        onClick={async () => {
          await copyToClipboard(canonicalUrl);
          setCopied("plain");
          trackAffiliateEvent({ productId, eventType: "share_copy", channel: "web" });
          window.setTimeout(() => setCopied((value) => (value === "plain" ? null : value)), 1500);
        }}
      >
        {copied === "plain" ? <Check size={14} aria-hidden /> : <Link2 size={14} aria-hidden />}
        링크 복사
      </button>
      <button
        className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-black text-ink hover:bg-mist"
        type="button"
        onClick={async () => {
          await copyToClipboard(telegramUrl);
          setCopied("telegram");
          trackAffiliateEvent({ productId, eventType: "share_copy", channel: "web", utmSource: "telegram" });
          window.setTimeout(() => setCopied((value) => (value === "telegram" ? null : value)), 1500);
        }}
      >
        {copied === "telegram" ? <Check size={14} aria-hidden /> : <Send size={14} aria-hidden />}
        텔레그램용 복사
      </button>
    </div>
  );
}
