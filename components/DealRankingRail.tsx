import Link from "next/link";
import { ArrowRight, CheckCircle2, Medal, ShieldCheck } from "lucide-react";
import AffiliateButton from "@/components/AffiliateButton";
import CompareButton from "@/components/CompareButton";
import PriceTimingSignal from "@/components/PriceTimingSignal";
import SavedDealButton from "@/components/SavedDealButton";
import WebEvidenceBadge from "@/components/WebEvidenceBadge";
import { getCategoryLabel } from "@/lib/category";
import { getCoupangOutboundLink } from "@/lib/coupangLink";
import { getDealPrice, getDiscountRate, getReferencePrice } from "@/lib/dealIntelligence";
import { getDealFreshness } from "@/lib/dealFreshness";
import { formatPercent, formatPrice } from "@/lib/format";
import { getReturnEvidenceLabel } from "@/lib/quality";
import { getLatestScore } from "@/lib/scoring";
import { getProductPriceSource, getRecentPricePosition } from "@/lib/priceTrend";
import type { ProductWithScore } from "@/lib/types";

export default function DealRankingRail({ products }: { products: ProductWithScore[] }) {
  const rankedProducts = [...products]
    .sort((a, b) => (getLatestScore(b)?.total_score ?? 0) - (getLatestScore(a)?.total_score ?? 0))
    .slice(0, 6);
  if (!rankedProducts.length) return null;

  return (
    <section className="border-y border-line bg-white py-8 sm:py-10" aria-labelledby="deal-ranking-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-black text-pine"><Medal size={16} aria-hidden /> 점수순 추천</p>
            <h2 className="mt-1 text-2xl font-black" id="deal-ranking-heading">지금 먼저 비교할 딜</h2>
            <p className="mt-1 text-sm font-semibold text-steel">점수·가격·반품 확인 상태를 한 줄씩 훑고, 필요한 상품만 상세로 들어가세요.</p>
          </div>
          <Link className="focus-ring inline-flex items-center gap-2 text-sm font-black text-pine hover:text-ink" href="/deals">
            전체 딜 비교 <ArrowRight size={16} aria-hidden />
          </Link>
        </div>

        <ol className="mt-5 grid gap-3 lg:grid-cols-2">
          {rankedProducts.map((product, index) => {
            const score = getLatestScore(product);
            const dealPrice = getDealPrice(product);
            const referencePrice = getReferencePrice(product);
            const outboundLink = getCoupangOutboundLink(product);
            const freshness = getDealFreshness(product);
            const pricePosition = getRecentPricePosition(product.snapshots ?? product.product_snapshots, dealPrice, getProductPriceSource(product), 30);

            return (
              <li key={product.id} className="rounded-lg border border-line bg-mist p-3 sm:p-4">
                <div className="flex min-w-0 gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-ink text-sm font-black text-lemon" aria-label={`${index + 1}위`}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Link href={`/deals/${product.id}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-line sm:h-24 sm:w-24">
                    {product.image_url ? <img className="h-full w-full object-cover" src={product.image_url} alt={product.title} /> : <span className="flex h-full items-center justify-center text-xs font-bold text-steel">ReturnPick</span>}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-pine">{getCategoryLabel(product.category)}</p>
                    <Link href={`/deals/${product.id}`} className="mt-1 line-clamp-2 text-sm font-black leading-5 text-ink hover:text-pine">
                      {product.title}
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-black">
                      <span className="rounded bg-pine/10 px-2 py-1 text-pine">{score?.total_score ?? "확인필요"}점</span>
                      <span className="rounded bg-white px-2 py-1 text-steel">상태 {product.condition_grade}</span>
                      <span className={product.return_price && !["확인필요", "알수없음"].includes(product.condition_grade) ? "rounded bg-white px-2 py-1 text-pine" : "rounded bg-coral/10 px-2 py-1 text-coral"}>
                        {getReturnEvidenceLabel(product)}
                      </span>
                      <WebEvidenceBadge product={product} />
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 border-y border-line/80 py-3 text-xs">
                  <div><p className="font-bold text-steel">판매가</p><p className="mt-1 font-black text-ink">{formatPrice(dealPrice)}</p></div>
                  <div><p className="font-bold text-steel">할인율</p><p className="mt-1 font-black text-pine">{formatPercent(getDiscountRate(product))}</p></div>
                  <div><p className="font-bold text-steel">기준가</p><p className="mt-1 font-black text-ink">{formatPrice(referencePrice)}</p></div>
                </div>
                {freshness.status === "fresh" && pricePosition.currentPrice != null ? (
                  <div className="mt-3">
                    <PriceTimingSignal freshness={freshness} pricePosition={pricePosition} />
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link href={`/deals/${product.id}`} className="focus-ring inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-ink px-3 py-2 text-xs font-black text-white hover:bg-pine">
                    검수 근거 보기 <ArrowRight size={14} aria-hidden />
                  </Link>
                  <CompareButton productId={product.id} title={product.title} />
                  <SavedDealButton productId={product.id} title={product.title} />
                </div>

                {outboundLink.isAffiliate ? (
                  <div className="mt-3 border-t border-line pt-3">
                    <AffiliateButton
                      productId={product.id}
                      href={outboundLink.href}
                      label="쿠팡에서 가격 확인"
                      placement="home_ranking"
                      context="home_ranking"
                      className="focus-ring inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-pine px-3 py-2 text-xs font-black text-white hover:bg-ink"
                    />
                    <p className="mt-2 flex gap-1.5 text-[11px] font-semibold leading-4 text-steel"><CheckCircle2 className="mt-0.5 shrink-0 text-pine" size={13} aria-hidden /> 이 페이지의 일부 링크는 제휴 링크이며 구매가 발생하면 운영자가 수수료를 받을 수 있습니다. <Link className="font-black text-pine underline" href="/disclosure">제휴 안내</Link></p>
                  </div>
                ) : (
                  <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-3 text-[11px] font-black text-coral"><ShieldCheck size={13} aria-hidden /> 상품별 쿠팡 링크 확인 후 구매 버튼이 열립니다.</p>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
