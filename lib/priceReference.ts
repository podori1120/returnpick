import { calculateDiscountRate } from "@/lib/format";
import { getNaverPriceTrust } from "@/lib/naverPriceTrust";
import type { SourcedProduct } from "@/lib/types";

export type PriceReferenceSource = "naver_lowest_price" | "new_price" | "source_price" | "none";
type PriceReferenceProduct = Pick<
  SourcedProduct,
  "category" | "title" | "brand" | "model_name" | "spec_json" | "raw_json" | "naver_lowest_price" | "new_price" | "source_price" | "return_price"
>;

export function getPriceReferenceInfo(product: PriceReferenceProduct) {
  const naverTrust = getNaverPriceTrust(product);
  if (naverTrust.trustedPrice) {
    return {
      value: naverTrust.trustedPrice,
      source: "naver_lowest_price" as PriceReferenceSource,
      label: "네이버 최저가",
      confidence: naverTrust.label,
      note: naverTrust.note,
      naverTrust
    };
  }

  if (product.new_price) {
    return {
      value: product.new_price,
      source: "new_price" as PriceReferenceSource,
      label: "새상품 기준가",
      confidence: "대체 기준",
      note:
        naverTrust.status === "unverified"
          ? `${naverTrust.note} 수집된 새상품가를 대체 기준으로 사용합니다.`
          : "네이버 최저가가 없어서 수집된 새상품가를 보수적 기준으로 사용합니다.",
      naverTrust
    };
  }

  if (product.source_price) {
    return {
      value: product.source_price,
      source: "source_price" as PriceReferenceSource,
      label: "수집 당시 가격",
      confidence: "임시 기준",
      note:
        naverTrust.status === "unverified"
          ? `${naverTrust.note} 수집 당시 가격을 임시 기준으로 사용합니다.`
          : "네이버 최저가와 새상품가가 없어 수집 당시 가격을 임시 기준으로 사용합니다.",
      naverTrust
    };
  }

  return {
    value: null,
    source: "none" as PriceReferenceSource,
    label: "가격 기준 없음",
    confidence: "확인필요",
    note: naverTrust.status === "unverified" ? naverTrust.note : "네이버 최저가, 새상품가, 수집가가 모두 없어 가격 비교가 제한됩니다.",
    naverTrust
  };
}

export function getAppliedDiscountRate(product: PriceReferenceProduct) {
  const reference = getPriceReferenceInfo(product);
  const dealPrice = product.return_price ?? product.source_price ?? product.new_price;
  return calculateDiscountRate(reference.value, dealPrice);
}
