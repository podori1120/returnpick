import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatDate, formatPrice } from "@/lib/format";
import { summarizePriceTrend } from "@/lib/priceTrend";
import type { ProductSnapshot } from "@/lib/types";

const changeLabels: Record<string, string> = {
  NEW_PRODUCT: "신규",
  SOURCE_PRICE_CHANGED: "수집가 변경",
  RETURN_PRICE_CHANGED: "반품가 변경",
  NEW_PRICE_CHANGED: "새상품가 변경",
  NAVER_PRICE_CHANGED: "네이버가 변경",
  STOCK_CHANGED: "재고 변경",
  CONDITION_CHANGED: "등급 변경",
  SOLD_OUT: "품절",
  BACK_IN_STOCK: "재입고"
};

const priceSourceLabels = {
  return_price: "반품가",
  source_price: "수집 당시 가격",
  new_price: "새상품가"
} as const;

export default function PriceHistory({ snapshots }: { snapshots?: ProductSnapshot[] | null }) {
  const items = (snapshots ?? []).slice(0, 6);
  const trend = summarizePriceTrend(snapshots);
  const chartMin = trend.points.length ? Math.min(...trend.points.map((point) => point.price)) : 0;
  const chartMax = trend.points.length ? Math.max(...trend.points.map((point) => point.price)) : 0;
  const chartRange = Math.max(1, chartMax - chartMin);
  const trendTone = trend.trend === "down" ? "text-pine" : trend.trend === "up" ? "text-coral" : "text-steel";
  const trendLabel = trend.trend === "down" ? "하락" : trend.trend === "up" ? "상승" : trend.trend === "steady" ? "보합" : "판단 대기";
  const TrendIcon = trend.trend === "down" ? ArrowDownRight : trend.trend === "up" ? ArrowUpRight : Minus;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-black">가격·재고 변동 기록</h2>
      <div className="rounded-lg border border-line bg-white p-4">
        {trend.points.length ? (
          <div className="border-b border-line pb-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md bg-mist p-3">
                <p className="text-xs font-bold text-steel">최저 관찰가</p>
                <p className="mt-1 text-lg font-black">{formatPrice(trend.lowestPrice)}</p>
                <p className="mt-1 text-[11px] font-bold text-steel">실제 가격 기록 {trend.points.length}회</p>
              </div>
              <div className="rounded-md bg-mist p-3">
                <p className="text-xs font-bold text-steel">최근 관찰가</p>
                <p className="mt-1 text-lg font-black">{formatPrice(trend.latestPrice)}</p>
                <p className="mt-1 text-[11px] font-bold text-steel">{formatDate(trend.latestObservedAt)} 기준</p>
              </div>
              <div className="rounded-md bg-mist p-3">
                <p className="text-xs font-bold text-steel">최근 흐름</p>
                <p className={`mt-1 inline-flex items-center gap-1 text-lg font-black ${trendTone}`}>
                  <TrendIcon size={18} aria-hidden /> {trendLabel}
                </p>
                <p className="mt-1 text-[11px] font-bold text-steel">첫 관찰가 대비 {trend.delta === null ? "비교 불가" : formatPrice(Math.abs(trend.delta))}</p>
              </div>
            </div>
            {trend.points.length > 1 ? (
              <div className="mt-4 rounded-md border border-line bg-mist px-3 pb-3 pt-4" role="img" aria-label="실제 관찰 가격 흐름">
                <div className="flex h-24 items-end gap-1.5 sm:gap-2">
                  {trend.points.map((point) => {
                    const height = 20 + Math.round(((point.price - chartMin) / chartRange) * 80);
                    return (
                      <div className="flex min-w-0 flex-1 items-end" key={point.id} title={`${formatDate(point.observedAt)} · ${priceSourceLabels[point.source]} · ${formatPrice(point.price)}`}>
                        <span className="block w-full rounded-t-sm bg-pine/70" style={{ height: `${height}%` }} />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-between gap-2 text-[11px] font-bold text-steel">
                  <span>{formatDate(trend.points[0].observedAt)}</span>
                  <span>{formatDate(trend.points.at(-1)?.observedAt)}</span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {items.length ? (
          <div className={`${trend.points.length ? "pt-4" : ""} space-y-3`}>
            {items.map((snapshot) => (
              <div key={snapshot.id} className="grid gap-2 rounded-lg bg-mist p-3 text-sm sm:grid-cols-[1fr_1fr_1fr]">
                <div>
                  <p className="text-xs font-bold text-steel">{formatDate(snapshot.observed_at)}</p>
                  <p className="mt-1 font-black">{snapshot.change_flags.map((flag) => changeLabels[flag] ?? flag).join(", ") || "관찰"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-steel">반품가 / 수집 당시 가격</p>
                  <p className="mt-1 font-black">
                    {formatPrice(snapshot.return_price)} / {formatPrice(snapshot.source_price)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-steel">재고 / 등급</p>
                  <p className="mt-1 font-black">
                    {snapshot.stock_count ?? "확인필요"} / {snapshot.condition_grade}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={`${trend.points.length ? "pt-4" : ""} text-sm font-semibold text-steel`}>가격이 포함된 변동 기록이 아직 없습니다.</p>
        )}
      </div>
    </section>
  );
}
