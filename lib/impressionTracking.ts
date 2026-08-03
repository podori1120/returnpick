export function getProductImpressionStorageKey(channel?: string, context?: string | null) {
  const scope = [channel, context]
    .map((value) => value?.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48))
    .filter(Boolean)
    .join(":");
  return scope ? `returnpick_impressed_deals:${scope}` : "returnpick_impressed_deals";
}
