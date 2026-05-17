import clsx from "clsx";
import { getDealQuality } from "@/lib/quality";
import type { ProductWithScore } from "@/lib/types";

export default function DealQualityCard({ product }: { product: ProductWithScore }) {
  const quality = getDealQuality(product);

  return (
    <section className="rounded-lg border border-line bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-steel">검수 신뢰도</p>
          <h2 className="mt-1 text-lg font-black">{quality.label}</h2>
        </div>
        <span
          className={clsx(
            "rounded-lg px-3 py-2 text-sm font-black",
            quality.status === "ready" && "bg-pine text-white",
            quality.status === "manual_check" && "bg-lemon text-ink",
            quality.status === "watch_price" && "bg-steel text-white",
            quality.status === "hold" && "bg-coral text-white"
          )}
        >
          {quality.confidence}
        </span>
      </div>

      {quality.blockers.length ? (
        <div className="mt-4">
          <p className="text-xs font-black text-coral">확인 필요</p>
          <ul className="mt-2 space-y-1 text-sm font-semibold text-ink">
            {quality.blockers.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {quality.warnings.length ? (
        <div className="mt-4">
          <p className="text-xs font-black text-steel">주의 항목</p>
          <ul className="mt-2 space-y-1 text-sm font-semibold text-steel">
            {quality.warnings.slice(0, 4).map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
