import AffiliateNotice from "@/components/AffiliateNotice";
import AffiliateButton from "@/components/AffiliateButton";
import { DealViewTracker } from "@/components/AffiliateEventTracker";
import Checklist from "@/components/Checklist";
import CompareButton from "@/components/CompareButton";
import DealQualityCard from "@/components/DealQualityCard";
import PriceComparison from "@/components/PriceComparison";
import PriceHistory from "@/components/PriceHistory";
import RelatedDeals from "@/components/RelatedDeals";
import RiskFlags from "@/components/RiskFlags";
import ReturnEvidence from "@/components/ReturnEvidence";
import ScoreBadge from "@/components/ScoreBadge";
import VerdictBadge from "@/components/VerdictBadge";
import { getCategoryLabel } from "@/lib/category";
import { getDiscountRate, getUseCaseMatches } from "@/lib/dealIntelligence";
import { formatPercent, formatPrice } from "@/lib/format";
import { getLatestScore } from "@/lib/scoring";
import type { ProductWithScore } from "@/lib/types";

export default function DealDetail({ product, relatedProducts = [] }: { product: ProductWithScore; relatedProducts?: ProductWithScore[] }) {
  const score = getLatestScore(product);
  const buyUrl = product.affiliate_url;
  const useCases = getUseCaseMatches(product).slice(0, 4);
  const discount = getDiscountRate(product);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 lg:pb-8">
      <DealViewTracker productId={product.id} title={product.title} />
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="space-y-6">
          <div className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
            <div className="aspect-[16/9] bg-line">
              {product.image_url ? (
                <img className="h-full w-full object-cover" src={product.image_url} alt={product.title} />
              ) : (
                <div className="flex h-full items-center justify-center font-black text-steel">ReturnPick</div>
              )}
            </div>
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-pine/10 px-2.5 py-1 text-xs font-black text-pine">{getCategoryLabel(product.category)}</span>
                <VerdictBadge verdict={score?.verdict} />
                <span className="rounded-md bg-mist px-2.5 py-1 text-xs font-bold text-steel">반품등급 {product.condition_grade}</span>
                <span className="rounded-md bg-mist px-2.5 py-1 text-xs font-bold text-steel">할인율 {formatPercent(discount)}</span>
              </div>
              <h1 className="text-2xl font-black leading-tight sm:text-3xl">{product.title}</h1>
              {product.public_note ? <p className="text-sm font-semibold leading-6 text-steel">{product.public_note}</p> : null}
              <div className="flex flex-wrap gap-2">
                <CompareButton productId={product.id} title={product.title} />
                <AffiliateButton
                  productId={product.id}
                  href={buyUrl}
                  className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-pine px-4 py-2 text-sm font-black text-white hover:bg-ink"
                />
              </div>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-black">가격 비교</h2>
            <PriceComparison product={product} />
            <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-pine">Coupang Partners</p>
                  <p className="mt-1 text-sm font-semibold text-steel">
                    가격과 재고는 쿠팡에서 다시 확인하세요. 버튼을 누르면 쿠팡 파트너스 링크가 새 탭으로 열립니다.
                  </p>
                </div>
                <AffiliateButton
                  productId={product.id}
                  href={buyUrl}
                  className="focus-ring inline-flex min-w-[180px] items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-black text-white hover:bg-pine"
                />
              </div>
            </div>
          </section>

          <DealQualityCard product={product} />
          <ReturnEvidence product={product} />

          <section className="space-y-3">
            <h2 className="text-lg font-black">어떤 사람에게 맞는가</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {useCases.map((item) => (
                <div key={item.id} className="rounded-lg border border-line bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black">{item.label}</p>
                    <span className="rounded-md bg-pine/10 px-2 py-1 text-xs font-black text-pine">{item.score}점</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-steel">{item.reason}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-black">추천 이유</h2>
            <div className="rounded-lg border border-line bg-white p-4">
              <ul className="space-y-2 text-sm font-semibold leading-6 text-ink">
                {(score?.reasons?.length ? score.reasons : ["관리자 검토 후 게시된 상품입니다."]).map((reason) => (
                  <li key={reason}>• {reason}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-black">위험 플래그</h2>
            <div className="rounded-lg border border-line bg-white p-4">
              <RiskFlags flags={score?.risk_flags} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-black">수령 후 체크리스트</h2>
            <Checklist category={product.category} />
          </section>

          <PriceHistory snapshots={product.snapshots ?? product.product_snapshots} />
          <RelatedDeals products={relatedProducts} />
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-steel">리턴픽 점수</p>
                <p className="mt-1 text-sm font-semibold text-steel">{score?.verdict ?? "판정대기"}</p>
              </div>
              <ScoreBadge score={score?.total_score} />
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-bold text-steel">반품가</span>
                <span className="font-black">{formatPrice(product.return_price)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-bold text-steel">재고</span>
                <span className="font-black">{product.stock_count ?? "확인필요"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-bold text-steel">브랜드</span>
                <span className="font-black">{product.brand ?? "확인필요"}</span>
              </div>
            </div>
            <AffiliateButton productId={product.id} href={buyUrl} />
            <p className="mt-3 text-xs font-semibold leading-5 text-steel">
              이 버튼은 쿠팡 파트너스 제휴 링크입니다. 구매가 발생하면 운영자가 수수료를 받을 수 있습니다.
            </p>
          </div>
          <AffiliateNotice />
        </aside>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 p-3 shadow-soft backdrop-blur lg:hidden">
        <div className="mx-auto max-w-7xl">
          <AffiliateButton productId={product.id} href={buyUrl} />
          <p className="mt-1 text-center text-[11px] font-semibold text-steel">제휴 링크이며 구매 시 운영자가 수수료를 받을 수 있습니다.</p>
        </div>
      </div>
    </main>
  );
}
