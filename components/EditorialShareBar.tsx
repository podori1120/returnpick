"use client";

import { Check, Link2, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { trackAffiliateEvent } from "@/lib/clientTracking";

type ShareStatus = "shared" | "copied" | "error" | null;

function buildTrackedShareUrl(canonicalUrl: string) {
  const url = new URL(canonicalUrl);
  url.searchParams.set("utm_source", "customer_share");
  url.searchParams.set("utm_medium", "referral");
  url.searchParams.set("utm_campaign", "novatech_s1_window_cleaner");
  return url.toString();
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
    if (!document.execCommand("copy")) {
      throw new Error("CLIPBOARD_COPY_FAILED");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

export default function EditorialShareBar({ canonicalUrl, title }: { canonicalUrl: string; title: string }) {
  const shareUrl = useMemo(() => buildTrackedShareUrl(canonicalUrl), [canonicalUrl]);
  const [status, setStatus] = useState<ShareStatus>(null);

  function recordShare(nextStatus: Exclude<ShareStatus, "error" | null>) {
    setStatus(nextStatus);
    trackAffiliateEvent({
      eventType: "share_copy",
      channel: "web_editorial_share",
      utmSource: "customer_share",
      context: "editorial_pick"
    });
    window.setTimeout(() => setStatus((current) => (current === nextStatus ? null : current)), 1800);
  }

  async function share() {
    setStatus(null);
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: "창문 로봇청소기 구매 전 확인사항을 함께 살펴보세요.",
          url: shareUrl
        });
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
    try {
      await copyToClipboard(shareUrl);
      recordShare("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mt-2 border-t border-line pt-2 sm:mt-4 sm:pt-4">
      <p className="text-xs font-black text-steel">구매 전 체크 내용 공유</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
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
    </div>
  );
}
