import type { JsonValue, SourcedProduct } from "@/lib/types";

export type NaverPriceTrustStatus = "verified_api" | "verified_manual" | "unverified" | "missing";
export type NaverPriceTrustSource = "naver_price_lookup" | "naver_price_backfill" | "admin_manual" | null;

type NaverPriceIdentity = Pick<SourcedProduct, "category" | "title" | "brand" | "model_name" | "spec_json">;
type NaverPriceProduct = NaverPriceIdentity & Pick<SourcedProduct, "naver_lowest_price" | "raw_json">;

export type NaverPriceTrust = {
  status: NaverPriceTrustStatus;
  source: NaverPriceTrustSource;
  storedPrice: number | null;
  trustedPrice: number | null;
  checkedAt: string | null;
  label: string;
  note: string;
};

const acceptedSkuReasons = new Set(["EXACT_MODEL_CODE", "EXACT_MODEL_NAME", "SPEC_IDENTITY"]);

function normalizedText(value: unknown) {
  return typeof value === "string" ? value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim() : "";
}

function stableJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
    .join(",")}}`;
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function getNaverProductFingerprint(product: NaverPriceIdentity) {
  const identity = stableJson({
    category: product.category,
    title: normalizedText(product.title),
    brand: normalizedText(product.brand),
    model_name: normalizedText(product.model_name),
    spec_json: product.spec_json ?? {}
  });
  return `v1:${fnv1a(identity)}`;
}

function recordOf(value: JsonValue | undefined) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function positivePrice(value: unknown) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? Math.round(price) : null;
}

function dateValue(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return value;
}

function apiEvidenceIsTrusted(record: Record<string, JsonValue>, price: number, fingerprint: string) {
  if (record.status !== "ok" || positivePrice(record.price) !== price || record.product_fingerprint !== fingerprint) return false;
  const match = recordOf(record.match);
  if (!match) return false;
  const confidence = match.sku_confidence;
  const reason = match.sku_reason_code;
  return (
    (confidence === "strong" || confidence === "moderate") &&
    typeof reason === "string" &&
    acceptedSkuReasons.has(reason) &&
    Number(match.sku_score) > 0
  );
}

function manualEvidenceIsTrusted(record: Record<string, JsonValue>, price: number, fingerprint: string) {
  return record.status === "confirmed" && positivePrice(record.price) === price && record.product_fingerprint === fingerprint;
}

export function withNaverPriceFingerprint(record: Record<string, JsonValue>, product: NaverPriceIdentity) {
  return {
    ...record,
    product_fingerprint: getNaverProductFingerprint(product)
  } satisfies Record<string, JsonValue>;
}

export function mergeManualNaverPriceEvidence(
  rawJson: Record<string, JsonValue>,
  product: NaverPriceIdentity,
  price: number | null,
  checkedAt = new Date().toISOString(),
  evidence?: { sourceUrl?: string | null; matchedTitle?: string | null }
) {
  return {
    ...rawJson,
    naver_price_manual: {
      status: price == null ? "cleared" : "confirmed",
      price,
      product_fingerprint: getNaverProductFingerprint(product),
      checked_at: checkedAt,
      source_url: evidence?.sourceUrl ?? null,
      matched_title: evidence?.matchedTitle ?? null
    }
  } satisfies Record<string, JsonValue>;
}

export function getNaverPriceTrust(product: NaverPriceProduct): NaverPriceTrust {
  const storedPrice = positivePrice(product.naver_lowest_price);
  if (storedPrice == null) {
    return {
      status: "missing",
      source: null,
      storedPrice: null,
      trustedPrice: null,
      checkedAt: null,
      label: "네이버 가격 없음",
      note: "동일 상품으로 확인된 네이버 가격이 아직 없습니다."
    };
  }

  const fingerprint = getNaverProductFingerprint(product);
  const candidates: Array<{ source: Exclude<NaverPriceTrustSource, null>; record: Record<string, JsonValue>; manual: boolean }> = [];
  const manual = recordOf(product.raw_json?.naver_price_manual);
  const backfill = recordOf(product.raw_json?.naver_price_backfill);
  const lookup = recordOf(product.raw_json?.naver_price_lookup);
  if (manual) candidates.push({ source: "admin_manual", record: manual, manual: true });
  if (backfill) candidates.push({ source: "naver_price_backfill", record: backfill, manual: false });
  if (lookup) candidates.push({ source: "naver_price_lookup", record: lookup, manual: false });

  for (const candidate of candidates) {
    const trusted = candidate.manual
      ? manualEvidenceIsTrusted(candidate.record, storedPrice, fingerprint)
      : apiEvidenceIsTrusted(candidate.record, storedPrice, fingerprint);
    if (!trusted) continue;
    return {
      status: candidate.manual ? "verified_manual" : "verified_api",
      source: candidate.source,
      storedPrice,
      trustedPrice: storedPrice,
      checkedAt: dateValue(candidate.record.checked_at) ?? dateValue(candidate.record.updated_at),
      label: candidate.manual ? "관리자 동일 상품 확인" : "네이버 동일 SKU 확인",
      note: candidate.manual
        ? "관리자가 동일 모델과 핵심 옵션을 대조해 확인한 네이버 가격입니다."
        : "네이버 쇼핑 API 결과에서 모델과 핵심 옵션이 일치한 가격입니다."
    };
  }

  return {
    status: "unverified",
    source: null,
    storedPrice,
    trustedPrice: null,
    checkedAt: null,
    label: "네이버 가격 검증 필요",
    note: "저장된 네이버 가격은 동일 상품 검증 증거가 없어 점수와 할인율 계산에서 제외했습니다."
  };
}
