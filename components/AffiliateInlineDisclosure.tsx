import Link from "next/link";

export default function AffiliateInlineDisclosure({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs font-semibold leading-5 text-steel ${className}`} data-affiliate-disclosure="inline">
      이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다. 가격과 재고, 반품등급은 수시로 변동될 수 있습니다. <Link className="font-black text-pine underline decoration-pine/30 underline-offset-4 hover:text-ink" href="/disclosure">제휴 안내</Link>
    </p>
  );
}
