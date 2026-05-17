export function formatPrice(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "확인필요";
  return `${value.toLocaleString("ko-KR")}원`;
}

export function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "확인필요";
  return `${Math.round(value * 100)}%`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").trim();
}

export function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateDiscountRate(referencePrice?: number | null, dealPrice?: number | null) {
  if (!referencePrice || !dealPrice || referencePrice <= 0) return null;
  return (referencePrice - dealPrice) / referencePrice;
}
