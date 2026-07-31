import type { Category } from "@/lib/types";

export const categories: Record<Category, { label: string; short: string }> = {
  laptop: { label: "노트북", short: "노트북" },
  monitor: { label: "모니터", short: "모니터" },
  robot_vacuum: { label: "로봇청소기", short: "로봇청소기" },
  cordless_vacuum: { label: "무선청소기", short: "무선청소기" },
  air_purifier: { label: "공기청정기", short: "공기청정기" },
  dehumidifier: { label: "제습기", short: "제습기" }
};

export const categoryOptions = Object.entries(categories).map(([value, meta]) => ({
  value: value as Category,
  label: meta.label
}));

export function isKnownCategory(value: string | null | undefined): value is Category {
  return Boolean(value && Object.prototype.hasOwnProperty.call(categories, value));
}

export function getCategoryLabel(category: string | null | undefined) {
  if (!isKnownCategory(category)) return "기타";
  return categories[category].label;
}
