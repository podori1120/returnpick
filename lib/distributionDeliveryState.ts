export type DistributionDeliveryMode = "draft" | "publish";
export type DistributionDeliveryState = "pending" | "succeeded" | "ambiguous" | "failed";

export type DistributionDeliverySnapshot = {
  status: DistributionDeliveryState;
  delivery_mode: DistributionDeliveryMode;
  provider_post_id: string | null;
};

export type DistributionClaimOperation = "insert" | "retry_failed" | "promote_draft";
export type DistributionClaimRejection =
  | "already_distributed"
  | "pending"
  | "ambiguous"
  | "draft_post_id_missing";

export type DistributionClaimPlan =
  | { action: "claim"; operation: DistributionClaimOperation }
  | { action: "reject"; reason: DistributionClaimRejection };

/**
 * Pure delivery state planner. Database writes still use request-key compare-and-set,
 * so this plan never grants a claim by itself.
 */
export function planDistributionClaim(
  existing: DistributionDeliverySnapshot | null,
  requestedMode: DistributionDeliveryMode
): DistributionClaimPlan {
  if (!existing) return { action: "claim", operation: "insert" };

  if (existing.status === "pending") return { action: "reject", reason: "pending" };
  if (existing.status === "ambiguous") return { action: "reject", reason: "ambiguous" };

  if (existing.status === "failed") {
    if (existing.provider_post_id) return { action: "reject", reason: "ambiguous" };
    return { action: "claim", operation: "retry_failed" };
  }

  if (existing.delivery_mode === "draft" && requestedMode === "publish") {
    if (!existing.provider_post_id) return { action: "reject", reason: "draft_post_id_missing" };
    return { action: "claim", operation: "promote_draft" };
  }

  return { action: "reject", reason: "already_distributed" };
}

export function isPrewriteFailureRetryable(operation: DistributionClaimOperation) {
  return operation !== "promote_draft";
}

export type BloggerProviderWritePlan =
  | { action: "insert_new_post"; isDraft: boolean }
  | { action: "publish_existing_draft"; postId: string };

export function planBloggerProviderWrite(
  operation: DistributionClaimOperation,
  requestedMode: DistributionDeliveryMode,
  providerPostId: string | null
): BloggerProviderWritePlan {
  if (operation === "promote_draft") {
    if (!providerPostId) throw new Error("BLOGGER_DRAFT_POST_ID_MISSING");
    return { action: "publish_existing_draft", postId: providerPostId };
  }
  return { action: "insert_new_post", isDraft: requestedMode === "draft" };
}
