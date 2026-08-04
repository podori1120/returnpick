import { AlertTriangle, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import AffiliateButton from "@/components/AffiliateButton";
import AffiliateInlineDisclosure from "@/components/AffiliateInlineDisclosure";
import PurchaseVerificationStrip from "@/components/PurchaseVerificationStrip";
import { getCoupangOutboundLink } from "@/lib/coupangLink";
import { getPurchaseDecision } from "@/lib/purchaseDecision";
import { formatPercent, formatPrice } from "@/lib/format";
import { isDemoProduct } from "@/lib/publicDeal";
import type { ProductWithScore } from "@/lib/types";

function toneClass(tone: string) {
  if (tone === "ready") return "border-pine bg-pine/10 text-pine";
  if (tone === "check") return "border-lemon bg-lemon/20 text-ink";
  return "border-coral bg-coral/10 text-coral";
}

export default function PurchaseDecisionPanel({ product }: { product: ProductWithScore }) {
  const decision = getPurchaseDecision(product);
  const demoProduct = isDemoProduct(product);
  const outboundLink = getCoupangOutboundLink(product);
  const affiliateReady = !demoProduct && outboundLink.isAffiliate;

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <div className={`rounded-lg border p-4 ${toneClass(decision.tone)}`}>
          <p className="text-xs font-black">30초 구매 판단</p>
          <p className="mt-2 text-4xl font-black">{decision.confidence}</p>
          <p className="mt-1 text-sm font-black">{decision.verdict}</p>
          <div className="mt-4 space-y-2 text-xs font-bold">
            <div className="flex justify-between gap-3">
              <span>현재가</span>
              <span>{formatPrice(decision.dealPrice)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>기준가</span>
              <span>{formatPrice(decision.referencePrice)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>차이</span>
              <span>{formatPercent(decision.discountRate)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">살지 말지 빠르게 판단하기</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-steel">
                리턴픽 점수와 가격 비교, 반품 리스크를 합쳐 구매 직전 확인 순서로 정리했습니다.
              </p>
            </div>
          </div>

          <PurchaseVerificationStrip freshness={decision.freshness} />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold leading-5 text-steel">
              위 항목을 쿠팡 화면에서 맞춰본 뒤 구매를 결정하세요. 버튼은 사용자가 직접 누를 때만 새 탭으로 열립니다.
            </p>
            <AffiliateButton
              productId={product.id}
              href={affiliateReady ? outboundLink.href : null}
              label={demoProduct ? "데모 상품 · 구매 링크 없음" : affiliateReady ? "쿠팡에서 실시간 가격 확인" : "링크 확인필요"}
              disabledLabel={demoProduct ? "데모 상품 · 구매 링크 없음" : "링크 확인필요"}
              placement="detail_decision"
              context="deal_detail"
              sponsored={affiliateReady}
              className="focus-ring inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-pine px-4 py-3 text-sm font-black text-white hover:bg-ink sm:w-auto sm:min-w-[220px]"
            />
            {affiliateReady ? <AffiliateInlineDisclosure className="mt-2 sm:mt-0 sm:max-w-sm" /> : null}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-mist p-4">
              <div className="flex items-center gap-2 text-sm font-black text-pine">
                <CheckCircle2 size={16} aria-hidden /> 좋은 점
              </div>
              <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-ink">
                {(decision.goodSignals.length ? decision.goodSignals : ["가격과 반품 조건을 상세에서 확인하세요."]).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg bg-mist p-4">
              <div className="flex items-center gap-2 text-sm font-black text-coral">
                <AlertTriangle size={16} aria-hidden /> 구매 전 확인
              </div>
              <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-ink">
                {(decision.cautions.length ? decision.cautions : ["가격과 재고는 쿠팡 화면에서 최종 확인하세요."]).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg bg-mist p-4">
              <div className="flex items-center gap-2 text-sm font-black text-steel">
                <Clock3 size={16} aria-hidden /> 다음 행동
              </div>
              <ol className="mt-3 space-y-2 text-sm font-semibold leading-6 text-ink">
                {decision.nextSteps.map((item, index) => (
                  <li key={item}>
                    {index + 1}. {item}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-3 text-xs font-bold text-steel">
            <ShieldCheck size={16} className="text-pine" aria-hidden />
            <span>
              {demoProduct
                ? "로컬 데모 상품은 구매 링크와 수익 이벤트를 연결하지 않습니다."
                : affiliateReady
                ? "구매 버튼은 사용자가 직접 누를 때만 새 탭으로 열리며, 링크 근처에 제휴 안내를 표시합니다."
                : "상품별 파트너스 링크가 확인되기 전에는 구매 버튼을 비활성화합니다."}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
