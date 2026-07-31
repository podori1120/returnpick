import { CheckCircle2, Clock3 } from "lucide-react";
import type { DealFreshness } from "@/lib/dealFreshness";
import { formatDate } from "@/lib/format";

function freshnessTone(status: DealFreshness["status"]) {
  if (status === "fresh") return "bg-pine/10 text-pine";
  if (status === "stale") return "bg-coral/10 text-coral";
  return "bg-lemon/25 text-ink";
}

const finalChecks = ["동일 모델·용량·색상", "현재 가격·재고·배송", "반품등급·구성품·교환 조건"];

export default function PurchaseVerificationStrip({ freshness }: { freshness: DealFreshness }) {
  return (
    <div className="grid gap-4 border-y border-line py-4 lg:grid-cols-[minmax(210px,0.8fr)_1.7fr]" data-freshness-status={freshness.status}>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Clock3 size={17} className="text-pine" aria-hidden />
          <p className="text-sm font-black">마지막 가격·재고 관찰</p>
          <span className={`rounded-md px-2 py-1 text-xs font-black ${freshnessTone(freshness.status)}`}>{freshness.label}</span>
        </div>
        <p className="mt-2 text-sm font-black text-ink">
          {freshness.observedAt ? formatDate(freshness.observedAt) : "관찰 기록 확인필요"}
        </p>
        <p className="mt-1 text-xs font-semibold leading-5 text-steel">{freshness.description}</p>
      </div>

      <div>
        <p className="text-sm font-black">쿠팡에서 마지막으로 맞춰볼 항목</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-3">
          {finalChecks.map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs font-bold leading-5 text-steel">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-pine" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
