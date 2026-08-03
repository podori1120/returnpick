export const COMPARE_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_COMPARE_ITEMS = 12;

export function normalizeCompareProductId(id: string) {
  return id.trim().toLowerCase();
}

export function compareProductIdsEqual(left: string, right: string) {
  if (left === right) return true;
  return COMPARE_UUID_PATTERN.test(left) && COMPARE_UUID_PATTERN.test(right) && normalizeCompareProductId(left) === normalizeCompareProductId(right);
}
