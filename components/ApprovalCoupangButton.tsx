"use client";

import { ExternalLink } from "lucide-react";

export default function ApprovalCoupangButton({
  href,
  className = "focus-ring mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-pine px-4 py-3 text-sm font-black text-white hover:bg-ink",
  label = "쿠팡에서 가격 확인"
}: {
  href: string;
  className?: string;
  label?: string;
}) {
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        event.preventDefault();
        const opened = window.open(href, "_blank", "noopener,noreferrer");
        if (opened) return;
        window.location.assign(href);
      }}
    >
      {label} <ExternalLink size={16} aria-hidden />
    </a>
  );
}
