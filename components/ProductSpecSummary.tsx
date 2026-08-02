import { BadgeCheck, ScanSearch } from "lucide-react";
import { getProductSpecRows } from "@/lib/productSpecs";
import type { ProductWithScore } from "@/lib/types";

export default function ProductSpecSummary({ product }: { product: ProductWithScore }) {
  const rows = getProductSpecRows(product);
  const confirmedCount = rows.filter((row) => row.isConfirmedInTitle).length;

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft" aria-labelledby="product-spec-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black text-pine">
            <ScanSearch size={15} aria-hidden /> 제목 기반 자동 해석
          </p>
          <h2 className="mt-1 text-xl font-black" id="product-spec-heading">
            상품명에서 확인된 핵심 사양
          </h2>
        </div>
        <span className="rounded-md bg-pine/10 px-2.5 py-1 text-xs font-black text-pine">{confirmedCount}개 표기</span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div key={row.key} className="rounded-lg border border-line bg-mist p-3">
            <p className="text-xs font-black text-steel">{row.label}</p>
            <p className={row.isConfirmedInTitle ? "mt-1 text-sm font-black text-ink" : "mt-1 text-sm font-black text-coral"}>
              {row.value}
            </p>
            {!row.isConfirmedInTitle ? <p className="mt-1 text-[11px] font-bold leading-4 text-coral">상품 상세에서 최종 확인</p> : null}
          </div>
        ))}
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs font-semibold leading-5 text-steel">
        <BadgeCheck className="mt-0.5 shrink-0 text-pine" size={15} aria-hidden />
        위 내용은 상품명에서 자동으로 읽은 정보입니다. 상품 상세의 옵션, 구성품, 실제 사양이 다를 수 있으니 구매 직전 쿠팡 페이지에서 다시 확인하세요.
      </p>
    </section>
  );
}
