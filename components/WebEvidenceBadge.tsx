import { Info } from "lucide-react";
import { getPublicWebEvidence } from "@/lib/publicWebEvidence";
import type { SourcedProduct } from "@/lib/types";

export default function WebEvidenceBadge({ product }: { product: Pick<SourcedProduct, "raw_json"> }) {
  const evidence = getPublicWebEvidence(product.raw_json);
  if (!evidence) return null;

  const confidenceLabel = evidence.confidence != null ? `추출 참고점수 ${evidence.confidence}` : null;
  const accessibleLabel = `웹 참고 근거${confidenceLabel ? `, ${confidenceLabel}` : ""}. 보조 단서이며, 최종 반품 조건은 쿠팡에서 확인하세요.`;

  return (
    <>
      <span
        className="inline-flex min-w-0 items-center gap-1 rounded-md bg-lemon/30 px-2.5 py-1 text-[11px] font-bold text-amber-800"
        title={accessibleLabel}
        aria-label={accessibleLabel}
      >
        <Info size={13} aria-hidden />
        <span>웹 참고 근거</span>
        {confidenceLabel ? <span aria-hidden>· {confidenceLabel}</span> : null}
      </span>
      <span className="basis-full text-[10px] font-semibold leading-4 text-amber-800">보조 단서 · 최종 반품 조건은 쿠팡에서 확인</span>
    </>
  );
}
