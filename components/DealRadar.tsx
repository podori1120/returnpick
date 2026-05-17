import Link from "next/link";
import { BadgeCheck, Radar, Target, TrendingDown } from "lucide-react";
import { buildDealRadar, getDiscountRate, type UseCaseId } from "@/lib/dealIntelligence";
import { formatPercent } from "@/lib/format";
import type { ProductWithScore } from "@/lib/types";

export default function DealRadar({
  products,
  useCaseLinks,
  priceBandLinks
}: {
  products: ProductWithScore[];
  useCaseLinks: Array<{ id: UseCaseId; label: string; description: string; href: string; count: number }>;
  priceBandLinks: Array<{ label: string; description: string; href: string; count: number }>;
}) {
  const radar = buildDealRadar(products);
  const topDiscountRate = radar.topDiscount ? getDiscountRate(radar.topDiscount) : null;

  return (
    <section className="grid gap-3 xl:grid-cols-[1.1fr_1fr]">
      <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
        <div className="flex items-center gap-2">
          <Radar className="text-pine" size={20} aria-hidden />
          <div>
            <p className="text-xs font-black text-pine">Deal Radar</p>
            <h2 className="text-lg font-black">현재 필터 기준 핵심 신호</h2>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-line p-3">
            <div className="flex items-center gap-2 text-xs font-black text-steel">
              <Target size={14} aria-hidden />
              최고 점수
            </div>
            <p className="mt-2 line-clamp-1 text-sm font-black">{radar.topScore?.title ?? "없음"}</p>
            <p className="mt-1 text-2xl font-black text-pine">{radar.topScore?.latest_score?.total_score ?? 0}점</p>
          </div>
          <div className="rounded-lg border border-line p-3">
            <div className="flex items-center gap-2 text-xs font-black text-steel">
              <TrendingDown size={14} aria-hidden />
              최대 할인
            </div>
            <p className="mt-2 line-clamp-1 text-sm font-black">{radar.topDiscount?.title ?? "없음"}</p>
            <p className="mt-1 text-2xl font-black text-pine">{formatPercent(topDiscountRate)}</p>
          </div>
          <div className="rounded-lg border border-line p-3">
            <div className="flex items-center gap-2 text-xs font-black text-steel">
              <BadgeCheck size={14} aria-hidden />
              게시 적합
            </div>
            <p className="mt-2 text-2xl font-black text-pine">{radar.readyCount.toLocaleString("ko-KR")}개</p>
            <p className="mt-1 text-xs font-bold text-steel">반품 확인 {radar.verifiedCount.toLocaleString("ko-KR")}개</p>
          </div>
          <div className="rounded-lg border border-line p-3">
            <p className="text-xs font-black text-steel">강한 카테고리</p>
            <p className="mt-2 text-2xl font-black text-pine">{radar.categorySignals[0]?.label ?? "-"}</p>
            <p className="mt-1 text-xs font-bold text-steel">
              평균 {radar.categorySignals[0]?.avgScore ?? 0}점 · {formatPercent(radar.categorySignals[0]?.avgDiscount)}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {radar.categorySignals.slice(0, 6).map((item) => (
            <div key={item.category} className="rounded-lg bg-mist p-3 text-sm">
              <p className="font-black">{item.label}</p>
              <p className="mt-1 text-xs font-bold text-steel">
                {item.count}개 · 평균 {item.avgScore}점 · 적합 {item.readyCount}개
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
          <p className="text-xs font-black text-pine">Use Case</p>
          <h2 className="text-lg font-black">용도별 바로 찾기</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {useCaseLinks.map((item) => (
              <Link key={item.id} className="rounded-lg border border-line p-3 text-sm hover:border-pine hover:bg-mist" href={item.href}>
                <span className="flex items-center justify-between gap-2 font-black text-ink">
                  {item.label}
                  <span className="text-pine">{item.count}</span>
                </span>
                <span className="mt-1 block text-xs font-bold leading-5 text-steel">{item.description}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
          <p className="text-xs font-black text-pine">Budget</p>
          <h2 className="text-lg font-black">가격대별 탐색</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {priceBandLinks.map((item) => (
              <Link key={item.label} className="rounded-lg border border-line p-3 text-sm hover:border-pine hover:bg-mist" href={item.href}>
                <span className="flex items-center justify-between gap-2 font-black text-ink">
                  {item.label}
                  <span className="text-pine">{item.count}</span>
                </span>
                <span className="mt-1 block text-xs font-bold leading-5 text-steel">{item.description}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
