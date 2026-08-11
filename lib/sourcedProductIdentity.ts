import type { SourcedProduct } from "@/lib/types";

export type SourcedProductMatchMode = "source_or_title" | "source_identity_only";

type ProductIdentity = Pick<SourcedProduct, "source" | "source_product_id" | "category" | "title">;
type ProductReviewState = Pick<SourcedProduct, "sourcing_status" | "is_published" | "is_rejected" | "rejection_reason">;

const NEW_DISCOVERY_REVIEW_STATE: ProductReviewState = {
  sourcing_status: "needs_review",
  is_published: false,
  is_rejected: false,
  rejection_reason: null
};

export function matchesSourcedProductForUpsert(
  existing: ProductIdentity,
  incoming: ProductIdentity,
  mode: SourcedProductMatchMode = "source_or_title"
) {
  const sameSourceIdentity =
    Boolean(incoming.source_product_id) &&
    existing.source === incoming.source &&
    existing.source_product_id === incoming.source_product_id;
  if (sameSourceIdentity) return true;
  if (mode === "source_identity_only") return false;
  return existing.category === incoming.category && existing.title.toLowerCase() === incoming.title.toLowerCase();
}

export function preserveSourcedProductReviewState(existing: ProductReviewState): ProductReviewState {
  return {
    sourcing_status: existing.sourcing_status,
    is_published: existing.is_published,
    is_rejected: existing.is_rejected,
    rejection_reason: existing.rejection_reason
  };
}

export function resolveDiscoveryReviewState(saved: ProductReviewState, inserted: boolean): ProductReviewState {
  return inserted ? { ...NEW_DISCOVERY_REVIEW_STATE } : preserveSourcedProductReviewState(saved);
}
