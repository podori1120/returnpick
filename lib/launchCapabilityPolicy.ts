export type CapabilityReadinessItem = {
  id: string;
  state: string;
};

export type CapabilityLaunchStep = {
  status: string;
  blocking?: boolean;
};

export const CORE_RUNTIME_ITEM_IDS = ["supabase", "site", "approval_link", "admin_password", "cron_secret"] as const;
export const OPTIONAL_CAPABILITY_ITEM_IDS = ["naver", "telegram"] as const;
export const OPTIONAL_CONNECTION_CHECK_IDS = ["naver", "telegram"] as const;

export function getOptionalConnectionCheckIds(apiKeysReady = true) {
  return [
    ...(apiKeysReady ? [] : ["coupang"]),
    ...OPTIONAL_CONNECTION_CHECK_IDS
  ];
}

export function getRequiredReadinessItemIds(publicWebEnabled: boolean) {
  return [
    ...CORE_RUNTIME_ITEM_IDS,
    ...(publicWebEnabled ? ["public_web"] : [])
  ];
}

export function getRequiredConnectionCheckIds(publicWebEnabled: boolean, apiKeysReady = true) {
  return [
    ...(apiKeysReady ? ["coupang"] : []),
    "supabase",
    "data_quality",
    "site_live",
    "cron",
    ...(publicWebEnabled ? ["public_web"] : [])
  ];
}

export function getLaunchBlockingItemIds(items: CapabilityReadinessItem[], publicWebEnabled: boolean) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  return getRequiredReadinessItemIds(publicWebEnabled).filter((id) => itemById.get(id)?.state !== "ready");
}

export function getOptionalMissingItemIds(items: CapabilityReadinessItem[]) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  return OPTIONAL_CAPABILITY_ITEM_IDS.filter((id) => itemById.get(id)?.state !== "ready");
}

export function evaluateLaunchReadiness(items: CapabilityReadinessItem[], publicWebEnabled: boolean) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const apiKeysReady = itemById.get("coupang")?.state === "ready";
  const runtimeReady = CORE_RUNTIME_ITEM_IDS.every((id) => itemById.get(id)?.state === "ready");
  const blockingItemIds = getLaunchBlockingItemIds(items, publicWebEnabled);
  const optionalMissingItemIds = getOptionalMissingItemIds(items);

  return {
    apiKeysReady,
    runtimeReady,
    // Manual product-level Partners links can operate before the separate Coupang API permission is issued.
    // The API remains an automation capability, not a prerequisite for publishing verified manual links.
    launchReady: runtimeReady && blockingItemIds.length === 0,
    blockingItemIds,
    optionalMissingItemIds
  };
}

export function isCapabilityReady(items: CapabilityReadinessItem[], capabilityId: string) {
  return items.find((item) => item.id === capabilityId)?.state === "ready";
}

export function hasBlockingLaunchError(steps: CapabilityLaunchStep[]) {
  return steps.some((step) => step.status === "error" && step.blocking !== false);
}
