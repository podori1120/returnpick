import { CheckCircle2, Clock3, Info, Minus } from "lucide-react";
import type { DealFreshness } from "@/lib/dealFreshness";
import { formatPrice } from "@/lib/format";
import type { RecentPricePosition } from "@/lib/priceTrend";

type PriceTimingSignalProps = {
  freshness: Pick<DealFreshness, "status">;
  pricePosition: RecentPricePosition;
};

function getTone(status: RecentPricePosition["status"]) {
  if (status === "lowest" || status === "good") {
    return {
      surface: "border-pine/20 bg-pine/5",
      badge: "bg-pine/10 text-pine",
      icon: CheckCircle2,
      iconClassName: "text-pine"
    };
  }

  if (status === "unknown") {
    return {
      surface: "border-line bg-mist",
      badge: "bg-white text-steel",
      icon: Info,
      iconClassName: "text-steel"
    };
  }

  return {
    surface: "border-line bg-mist",
    badge: "bg-white text-ink",
    icon: Minus,
    iconClassName: "text-steel"
  };
}

export default function PriceTimingSignal({ freshness, pricePosition }: PriceTimingSignalProps) {
  if (freshness.status !== "fresh" || pricePosition.currentPrice == null) return null;

  const tone = getTone(pricePosition.status);
  const ToneIcon = tone.icon;

  return (
    <div
      className={`rounded-lg border p-3 ${tone.surface}`}
      data-price-timing-signal="true"
      data-price-timing-status={pricePosition.status}
      data-price-position={pricePosition.status}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Clock3 className={`mt-0.5 shrink-0 ${tone.iconClassName}`} size={15} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="text-xs font-black text-steel">가격 시점</p>
            <span className={`max-w-full rounded-md px-2 py-1 text-xs font-black ${tone.badge}`}>
              <ToneIcon className="mr-1 inline-block align-[-2px]" size={13} aria-hidden />
              {pricePosition.label}
            </span>
          </div>
          <p className="mt-1 break-words text-xs font-bold leading-5 text-steel">{pricePosition.description}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-bold text-steel">
            {pricePosition.currentPrice != null ? <span>현재가 {formatPrice(pricePosition.currentPrice)}</span> : null}
            {pricePosition.averagePrice != null ? <span>관찰 평균 {formatPrice(pricePosition.averagePrice)}</span> : null}
            {pricePosition.lowestPrice != null ? <span>관찰 최저 {formatPrice(pricePosition.lowestPrice)}</span> : null}
            <span>동일 기준 관찰 {pricePosition.sampleCount}회</span>
          </div>
          <p className="mt-1 break-words text-[11px] font-semibold leading-4 text-steel">
            ReturnPick 자체 최근 관찰 기준이며 시장 전체 최저가를 뜻하지 않습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
