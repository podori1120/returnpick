import { formatDate, formatPrice } from "@/lib/format";
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

export default function PriceHistory({ snapshots }: { snapshots?: ProductSnapshot[] | null }) {
  const items = (snapshots ?? []).slice(0, 6);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-black">가격·재고 변동 기록</h2>
      <div className="rounded-lg border border-line bg-white p-4">
        {items.length ? (
          <div className="space-y-3">
            {items.map((snapshot) => (
              <div key={snapshot.id} className="grid gap-2 rounded-lg bg-mist p-3 text-sm sm:grid-cols-[1fr_1fr_1fr]">
                <div>
                  <p className="text-xs font-bold text-steel">{formatDate(snapshot.observed_at)}</p>
                  <p className="mt-1 font-black">{snapshot.change_flags.map((flag) => changeLabels[flag] ?? flag).join(", ") || "관찰"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-steel">반품가 / 네이버</p>
                  <p className="mt-1 font-black">
                    {formatPrice(snapshot.return_price)} / {formatPrice(snapshot.naver_lowest_price)}
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
          <p className="text-sm font-semibold text-steel">아직 변동 기록이 없습니다.</p>
        )}
      </div>
    </section>
  );
}
