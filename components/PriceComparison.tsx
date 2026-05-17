import { calculateDiscountRate, formatPercent, formatPrice } from "@/lib/format";
import type { SourcedProduct } from "@/lib/types";

export default function PriceComparison({ product }: { product: SourcedProduct }) {
  const reference = product.naver_lowest_price ?? product.new_price ?? product.source_price;
  const deal = product.return_price ?? product.source_price;
  const discount = calculateDiscountRate(reference, deal);

  return (
    <div className="grid gap-3 sm:grid-cols-4">
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
        <p className="mt-1 text-lg font-black">{formatPrice(product.naver_lowest_price)}</p>
      </div>
      <div className="rounded-lg border border-line bg-white p-4">
        <p className="text-xs font-bold text-steel">최저가 대비</p>
        <p className="mt-1 text-lg font-black">{formatPercent(discount)}</p>
      </div>
    </div>
  );
}
