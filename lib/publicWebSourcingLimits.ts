export const MAX_PUBLIC_WEB_KEYWORD_LIMIT = 8;

export function parsePositiveInteger(value: unknown) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function resolveSourcingKeywordLimit(sourceMode: string, requestedLimit: unknown) {
  const requested = parsePositiveInteger(requestedLimit);
  if (sourceMode !== "public_web_only") return requested;
  return Math.min(requested ?? MAX_PUBLIC_WEB_KEYWORD_LIMIT, MAX_PUBLIC_WEB_KEYWORD_LIMIT);
}
