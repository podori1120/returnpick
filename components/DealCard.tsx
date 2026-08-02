import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import AffiliateButton from "@/components/AffiliateButton";
import { getCategoryLabel } from "@/lib/category";
import { getCoupangOutboundLink } from "@/lib/coupangLink";
import { getDealPrice, getDiscountRate, getPrimaryUseCase, getReferencePrice } from "@/lib/dealIntelligence";
import { formatPercent, formatPrice } from "@/lib/format";
import { getDealQuality, getReturnEvidenceLabel } from "@/lib/quality";
import { getPurchaseDecision } from "@/lib/purchaseDecision";
import { getDealFreshness } from "@/lib/dealFreshness";
import { getLatestScore } from "@/lib/scoring";
import type { ProductWithScore } from "@/lib/types";
import CompareButton from "@/components/CompareButton";
import SavedDealButton from "@/components/SavedDealButton";
import ScoreBadge from "@/components/ScoreBadge";
import VerdictBadge from "@/components/VerdictBadge";

export default function DealCard({ product }: { product: ProductWithScore }) {
  const score = getLatestScore(product);
  const reference = getReferencePrice(product);
  const deal = getDealPrice(product);
  const discount = getDiscountRate(product);
  const quality = getDealQuality(product);
  const primaryUseCase = getPrimaryUseCase(product);
  const decision = getPurchaseDecision(product);
  const freshness = getDealFreshness(product);
  const firstReason = score?.reasons?.[0] ?? product.public_note;
  const primaryCheck = quality.blockers[0] ?? quality.warnings[0];
  const riskCount = score?.risk_flags?.length ?? 0;
  const outboundLink = getCoupangOutboundLink(product);

  return (
    <article className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
      <Link href={`/deals/${product.id}`} className="block">
        <div className="aspect-[16/10] bg-line">
          {product.image_url ? (
            <img className="h-full w-full object-cover" src={product.image_url} alt={product.title} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm font-bold text-steel">ReturnPick</div>
          )}
        </div>
      </Link>
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black text-pine">{getCategoryLabel(product.category)}</p>
            <Link href={`/deals/${product.id}`} className="mt-1 line-clamp-2 text-base font-black leading-6 hover:text-pine">
              {product.title}
            </Link>
          </div>
          <ScoreBadge score={score?.total_score} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <VerdictBadge verdict={score?.verdict} />
          <span className="rounded-md bg-mist px-2.5 py-1 text-xs font-bold text-steel">상태 {product.condition_grade}</span>
          <span className={product.return_price && !["확인필요", "알수없음"].includes(product.condition_grade) ? "rounded-md bg-pine/10 px-2.5 py-1 text-xs font-bold text-pine" : "rounded-md bg-coral/10 px-2.5 py-1 text-xs font-bold text-coral"}>
            {getReturnEvidenceLabel(product)}
          </span>
          <span className="rounded-md bg-mist px-2.5 py-1 text-xs font-bold text-steel">
            {quality.label} {quality.confidence}
          </span>
          {riskCount ? <span className="rounded-md bg-coral/10 px-2.5 py-1 text-xs font-bold text-coral">주의 {riskCount}</span> : null}
          {primaryUseCase ? <span className="rounded-md bg-pine/10 px-2.5 py-1 text-xs font-bold text-pine">{primaryUseCase.label}</span> : null}
          {product.stock_count ? <span className="rounded-md bg-mist px-2.5 py-1 text-xs font-bold text-steel">재고 {product.stock_count}</span> : null}
          <span
            className={`rounded-md px-2.5 py-1 text-xs font-bold ${freshness.status === "fresh" ? "bg-pine/10 text-pine" : freshness.status === "stale" ? "bg-coral/10 text-coral" : "bg-lemon/25 text-ink"}`}
            data-freshness-status={freshness.status}
            title={freshness.description}
          >
            {freshness.label}
          </span>
        </div>
        {firstReason || primaryCheck ? (
          <div className="space-y-2 rounded-lg bg-mist p-3 text-xs font-bold leading-5 text-steel">
            {firstReason ? (
              <p className="line-clamp-2 flex gap-2">
                <CheckCircle2 className="mt-0.5 shrink-0 text-pine" size={14} aria-hidden />
                <span>{firstReason}</span>
              </p>
            ) : null}
            {primaryCheck ? (
              <p className="line-clamp-2 flex gap-2">
                <AlertTriangle className="mt-0.5 shrink-0 text-coral" size={14} aria-hidden />
                <span>{primaryCheck}</span>
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-xs font-bold text-steel">판매가</p>
            <p className="font-black">{formatPrice(deal)}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-steel">할인율</p>
            <p className="font-black">{formatPercent(discount)}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-steel">기준가</p>
            <p className="font-black">{formatPrice(reference)}</p>
          </div>
        </div>
        <div className="rounded-lg border border-line bg-mist p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-steel">구매 판단</p>
              <p className="mt-1 text-sm font-black text-ink">{decision.verdict}</p>
            </div>
            <span className="rounded-md bg-white px-2.5 py-1 text-xs font-black text-pine">{decision.confidence}</span>
          </div>
          <p className="mt-2 line-clamp-1 text-xs font-bold text-steel">
            {decision.goodSignals[0] ?? decision.cautions[0] ?? "상세에서 가격과 반품 조건을 확인하세요."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/deals/${product.id}`}
            className="focus-ring min-w-[140px] flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-black text-white hover:bg-pine"
          >
            자세히 보기 <ArrowRight size={16} aria-hidden />
          </Link>
          <CompareButton productId={product.id} title={product.title} />
          <SavedDealButton productId={product.id} title={product.title} />
        </div>
        {outboundLink.isAffiliate ? (
          <div className="border-t border-line pt-3">
            <AffiliateButton
              productId={product.id}
              href={outboundLink.href}
              label="쿠팡에서 가격 확인"
              placement="deal_card"
              context="deal_card"
              className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-lg bg-pine px-4 py-3 text-sm font-black text-white hover:bg-ink"
            />
            <p className="mt-2 text-[11px] font-semibold leading-4 text-steel">
              이 페이지의 일부 링크는 제휴 링크이며, 구매가 발생하면 운영자가 수수료를 받을 수 있습니다. 가격과 재고, 반품등급은 수시로 변동될 수 있습니다. <Link className="font-black text-pine underline" href="/disclosure">제휴 안내</Link>
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}
