import type { JsonValue, SourcedProduct } from "@/lib/types";

export const MANUAL_PROMOTION_PROVENANCE_KEY = "manual_promotion";
export const MANUAL_PROMOTION_SOURCES = ["algumon_discovery", "hotdeals_discovery"] as const;

export type ManualPromotionSource = (typeof MANUAL_PROMOTION_SOURCES)[number];

export type ManualPromotionWriteState = Pick<SourcedProduct, "updated_at" | "is_published" | "sourcing_status">;

export function isManualPromotionSource(value: string | null | undefined): value is ManualPromotionSource {
  return MANUAL_PROMOTION_SOURCES.includes(value as ManualPromotionSource);
}

export function isManualPromotionConfirmation(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  return Object.keys(body).length === 1 && body.manual_review_confirmed === true;
}

export function isManualPromotionStateUnchanged(expected: ManualPromotionWriteState, latest: ManualPromotionWriteState) {
  return (
    expected.updated_at === latest.updated_at &&
    expected.is_published === false &&
    expected.sourcing_status !== "published" &&
    latest.is_published === false &&
    latest.sourcing_status !== "published"
  );
}

export function getManualPromotionDealPrice(product: Pick<SourcedProduct, "return_price" | "source_price" | "new_price">) {
  const value = product.return_price ?? product.source_price ?? product.new_price;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export function createManualPromotionRawJson(
  product: Pick<SourcedProduct, "raw_json" | "source" | "source_product_id" | "source_url" | "title" | "keyword">,
  promotedAt: string
) {
  return {
    ...(product.raw_json ?? {}),
    [MANUAL_PROMOTION_PROVENANCE_KEY]: {
      original_source: product.source,
      original_source_product_id: product.source_product_id,
      original_source_url: product.source_url,
      original_title: product.title,
      original_keyword: product.keyword,
      promoted_at: promotedAt
    }
  } satisfies Record<string, JsonValue>;
}
