import { formatPercent, formatPrice } from "@/lib/format";
import { getAppliedDiscountRate, getPriceReferenceInfo } from "@/lib/priceReference";
import type { SourcedProduct } from "@/lib/types";

export default function PriceComparison({ product }: { product: SourcedProduct }) {
  const reference = getPriceReferenceInfo(product);
  const discount = getAppliedDiscountRate(product);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <div className="rounded-lg border border-line bg-white p-4">
        <p className="text-xs font-bold text-steel">반품가</p>
        <p className="mt-1 text-lg font-black">{formatPrice(product.return_price)}</p>
      </div>
      <div className="rounded-lg border border-line bg-white p-4">
        <p className="text-xs font-bold text-steel">수집 당시 가격</p>
        <p className="mt-1 text-lg font-black">{formatPrice(product.source_price)}</p>
      </div>
      <div className="rounded-lg border border-line bg-white p-4">
        <p className="text-xs font-bold text-steel">네이버 최저가</p>
        <p className="mt-1 text-lg font-black">{product.naver_lowest_price ? formatPrice(product.naver_lowest_price) : "확인중"}</p>
        {!product.naver_lowest_price ? <p className="mt-1 text-xs font-bold text-coral">API 보강 필요</p> : null}
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
        {reference.note} 네이버 값이 비어 있어도 가격 판단은 중단하지 않고, 새상품가나 수집가를 별도 표기한 대체 기준으로 계산합니다.
      </p>
    </div>
  );
}
