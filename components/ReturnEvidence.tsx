import type { JsonValue, SourcedProduct } from "@/lib/types";

function getEvidence(raw: Record<string, JsonValue>) {
  const info = raw.web_return_info;
  if (!info || typeof info !== "object" || Array.isArray(info)) return null;
  const evidence = Array.isArray(info.evidence) ? info.evidence.filter((item): item is string => typeof item === "string") : [];
  const confidence = typeof info.confidence === "number" ? info.confidence : null;
  const isReturnCandidate = Boolean(info.is_return_candidate);
  if (!isReturnCandidate && evidence.length === 0) return null;
  return { evidence, confidence, isReturnCandidate };
}

export default function ReturnEvidence({ product }: { product: SourcedProduct }) {
  const data = getEvidence(product.raw_json);
  if (!data) return null;

  return (
    <section className="rounded-lg border border-line bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-steel">웹 참고 근거</p>
          <h2 className="mt-1 text-lg font-black">반품 정보 단서</h2>
        </div>
        {data.confidence != null ? <span className="rounded-lg bg-mist px-3 py-2 text-sm font-black text-steel">{data.confidence}</span> : null}
      </div>
      <ul className="mt-3 space-y-1 text-sm font-semibold leading-6 text-steel">
        {(data.evidence.length ? data.evidence : ["웹 문구에서 반품 후보 표현을 확인했습니다."]).map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </section>
  );
}
