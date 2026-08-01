import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Droplets, Gauge, ShieldCheck } from "lucide-react";
import ApprovalCoupangButton from "@/components/ApprovalCoupangButton";
import { EditorialPickImpressionTracker } from "@/components/AffiliateEventTracker";
import { approvalSampleProduct } from "@/lib/approvalSample";
import { isCoupangPartnersLink } from "@/lib/coupangLink";

const highlightIcons = [Gauge, Droplets, ShieldCheck];
const cardTracking = {
  home: { channel: "web_editorial_card_home", context: "editorial_home_card" },
  deals: { channel: "web_editorial_card_deals", context: "editorial_deals_card" },
  picks: { channel: "web_editorial_card_picks", context: "editorial_picks_card" }
} as const;

export default function ApprovalSampleCard({ placement }: { placement: "home" | "deals" | "picks" }) {
  const approvalUrlReady = isCoupangPartnersLink(process.env.NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL?.trim() ?? "");
  const tracking = cardTracking[placement];

  return (
    <article className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
      <EditorialPickImpressionTracker placement={placement} />
      <Link className="focus-ring group block" href={approvalSampleProduct.detailPath} aria-label={`${approvalSampleProduct.name} 상세 보기`}>
        <div className="relative aspect-[3/2] overflow-hidden bg-mist">
          <Image
            alt={approvalSampleProduct.imageAlt}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            fill
            priority={placement === "home"}
            sizes="(min-width: 1024px) 420px, (min-width: 768px) 50vw, 100vw"
            src={approvalSampleProduct.imageSrc}
          />
          <span className="absolute left-3 top-3 rounded-md bg-white/95 px-2.5 py-1 text-xs font-black text-ink shadow-soft">연출 이미지</span>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-black">
            <span className="rounded-md bg-pine/10 px-2.5 py-1 text-pine">직접 검수 추천</span>
            <span className="rounded-md bg-mist px-2.5 py-1 text-steel">{approvalSampleProduct.categoryLabel}</span>
          </div>
          <h2 className="mt-3 text-xl font-black leading-7 text-ink">{approvalSampleProduct.name}</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-steel">{approvalSampleProduct.subtitle}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {approvalSampleProduct.highlights.map((highlight, index) => {
              const Icon = highlightIcons[index];
              return (
                <span key={highlight} className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-md bg-mist px-2 py-2 text-center text-[11px] font-black text-ink">
                  <Icon className="text-pine" size={15} aria-hidden />
                  <span className="break-keep">{highlight}</span>
                </span>
              );
            })}
          </div>
          <p className="mt-3 text-xs font-semibold leading-5 text-steel">{approvalSampleProduct.imageNotice}</p>
          <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-pine group-hover:text-ink">
            검수 내용과 구매 전 확인사항 보기 <ArrowRight size={16} aria-hidden />
          </span>
        </div>
      </Link>
      <div className="border-t border-line p-5">
        <ApprovalCoupangButton
          href={process.env.NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL?.trim() ?? ""}
          label="쿠팡에서 가격 확인"
          channel={tracking.channel}
          context={tracking.context}
          className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-lg bg-pine px-4 py-3 text-sm font-black text-white hover:bg-ink"
        />
        <p className="mt-2 text-[11px] font-semibold leading-4 text-steel">
          {approvalUrlReady
            ? "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다. 가격과 재고, 배송 정보는 쿠팡 상품 페이지에서 최종 확인하세요."
            : "쿠팡 파트너스 링크 설정 상태를 확인하세요. 가격과 재고, 배송 정보는 쿠팡 상품 페이지에서 최종 확인하세요."}
        </p>
        <Link className="mt-2 inline-flex text-xs font-black text-pine underline decoration-pine/30 underline-offset-4 hover:text-ink" href="/disclosure">
          제휴 안내 자세히 보기
        </Link>
      </div>
    </article>
  );
}
