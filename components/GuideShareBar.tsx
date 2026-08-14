"use client";

import { Check, Link2, Share2 } from "lucide-react";
import { useState } from "react";
import { trackAffiliateEvent } from "@/lib/clientTracking";

type GuideShareContext = "high_value_guide" | "search_guide";
type ShareStatus = "shared" | "copied" | "error" | null;

const sharePathPattern = /^\/guide\/(?:high-value|search\/[a-z0-9-]+)$/;

function buildShareUrl(sharePath: string) {
  if (typeof window === "undefined" || !sharePathPattern.test(sharePath)) return null;
  try {
    const url = new URL(sharePath, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    url.searchParams.set("utm_source", "guide_share");
    url.searchParams.set("utm_medium", "referral");
    url.searchParams.set("utm_campaign", "returnpick_guide");
    return url.toString();
  } catch {
    return null;
  }
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
  document.body.appendChild(textarea);
  try {
    textarea.select();
    if (!document.execCommand("copy")) throw new Error("CLIPBOARD_COPY_FAILED");
  } finally {
    document.body.removeChild(textarea);
  }
}

export default function GuideShareBar({
  sharePath,
  title,
  context
}: {
  sharePath: string;
  title: string;
  context: GuideShareContext;
}) {
  const [status, setStatus] = useState<ShareStatus>(null);
  const channel = context === "high_value_guide" ? "web_high_value_guide_share" : "web_search_guide_share";

  function recordShare(nextStatus: Exclude<ShareStatus, "error" | null>) {
    setStatus(nextStatus);
    trackAffiliateEvent({
      eventType: "share_copy",
      channel,
      utmSource: "guide_share",
      context
    });
    window.setTimeout(() => setStatus((current) => (current === nextStatus ? null : current)), 1800);
  }

  async function share() {
    setStatus(null);
    const shareUrl = buildShareUrl(sharePath);
    if (!shareUrl) {
      setStatus("error");
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({ title, text: `${title} 구매 전 확인사항을 함께 살펴보세요.`, url: shareUrl });
        recordShare("shared");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await copyToClipboard(shareUrl);
      recordShare("copied");
    } catch {
      setStatus("error");
    }
  }

  async function copy() {
    setStatus(null);
    const shareUrl = buildShareUrl(sharePath);
    if (!shareUrl) {
      setStatus("error");
      return;
    }

    try {
      await copyToClipboard(shareUrl);
      recordShare("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="rounded-lg border border-line bg-white p-4" aria-labelledby={`${context}-share-title`}>
      <p id={`${context}-share-title`} className="text-sm font-black text-pine">
        이 가이드 공유하기
      </p>
      <p className="mt-1 text-xs font-semibold leading-5 text-steel">구매 전 확인 기준만 담은 ReturnPick 내부 링크를 공유합니다.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-black text-ink hover:border-pine hover:bg-mist"
          onClick={share}
          type="button"
        >
          {status === "shared" ? <Check size={15} aria-hidden /> : <Share2 size={15} aria-hidden />}
          {status === "shared" ? "공유 완료" : "추천 링크 공유"}
        </button>
        <button
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-black text-ink hover:border-pine hover:bg-mist"
          onClick={copy}
          type="button"
        >
          {status === "copied" ? <Check size={15} aria-hidden /> : <Link2 size={15} aria-hidden />}
          {status === "copied" ? "링크 복사됨" : "링크 복사"}
        </button>
      </div>
      <p className="mt-2 min-h-4 text-xs font-semibold text-coral" role="status" aria-live="polite">
        {status === "error" ? "공유 링크를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요." : ""}
      </p>
    </section>
  );
}
