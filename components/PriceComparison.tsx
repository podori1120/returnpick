import { formatPercent, formatPrice } from "@/lib/format";
import { getAppliedDiscountRate, getPriceReferenceInfo } from "@/lib/priceReference";
import { getDealPriceLabel } from "@/lib/quality";
import type { SourcedProduct } from "@/lib/types";

export default function PriceComparison({ product }: { product: SourcedProduct }) {
  const reference = getPriceReferenceInfo(product);
  const discount = getAppliedDiscountRate(product);
  const dealPrice = product.return_price ?? product.source_price ?? product.new_price;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <div className="rounded-lg border border-line bg-white p-4">
        <p className="text-xs font-bold text-steel">{getDealPriceLabel(product)}</p>
        <p className="mt-1 text-lg font-black">{formatPrice(dealPrice)}</p>
      </div>
      <div className="rounded-lg border border-line bg-white p-4">
        <p className="text-xs font-bold text-steel">수집 당시 가격</p>
        <p className="mt-1 text-lg font-black">{formatPrice(product.source_price)}</p>
      </div>
      <div className="rounded-lg border border-line bg-white p-4">
        <p className="text-xs font-bold text-steel">네이버 최저가</p>
        <p className="mt-1 text-lg font-black">{reference.naverTrust.trustedPrice ? formatPrice(reference.naverTrust.trustedPrice) : "검증 필요"}</p>
        <p className={reference.naverTrust.trustedPrice ? "mt-1 text-xs font-bold text-pine" : "mt-1 text-xs font-bold text-coral"}>
          {reference.naverTrust.label}
        </p>
      </div>
      <div className="rounded-lg border border-line bg-white p-4">
        <p className="text-xs font-bold text-steel">적용 기준가</p>
        <p className="mt-1 text-lg font-black">{formatPrice(reference.value)}</p>
        <p className="mt-1 text-xs font-bold text-steel">
          {reference.label} · {reference.confidence}
        </p>
      </div>
      <div className="rounded-lg border border-line bg-white p-4">
        <p className="text-xs font-bold text-steel">기준가 대비</p>
        <p className="mt-1 text-lg font-black">{formatPercent(discount)}</p>
      </div>
      <p className="rounded-lg bg-mist px-3 py-2 text-xs font-bold leading-5 text-steel sm:col-span-2 xl:col-span-5">
        {reference.note} 검증된 네이버 값이 없어도 새상품가나 수집가를 별도 표기한 대체 기준으로 계산합니다.
      </p>
    </div>
  );
}
