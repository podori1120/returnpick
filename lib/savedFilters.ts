export type SavedFilter = {
  label: string;
  href: string;
  savedAt: string;
};

export const savedFiltersStorageKey = "returnpick_saved_filters";
export const savedFiltersChangeEvent = "returnpick_saved_filters_changed";
export const maxSavedFilters = 8;
const internalOrigin = "https://returnpick.local";

type LabelOption = {
  id?: string;
  value?: string;
  label: string;
};

type SavedFilterLabelOptions = {
  useCases: ReadonlyArray<LabelOption>;
  categories: ReadonlyArray<LabelOption>;
  priceBands: ReadonlyArray<LabelOption>;
};

const conditionLabels = new Set(["미개봉", "최상", "상", "중", "알수없음", "확인필요"]);
const qualityLabels: Record<string, string> = {
  ready: "게시 적합",
  manual_check: "수동 확인",
  watch_price: "가격 관찰",
  hold: "보류 우선"
};
const stockLabels: Record<string, string> = {
  one: "재고 1개",
  in_stock: "재고 있음",
  unknown: "재고 확인필요"
};
const sortLabels: Record<string, string> = {
  fit: "용도 적합 순",
  discount: "할인율 순",
  confidence: "검수 신뢰도 순",
  latest: "최근 검증 순",
  price: "가격 높은 순",
  low_price: "가격 낮은 순"
};

function optionLabel(options: ReadonlyArray<LabelOption>, value: string | null, key: "id" | "value") {
  if (!value) return null;
  return options.find((option) => option[key] === value)?.label ?? null;
}

function positiveNumberLabel(value: string | null, suffix: string, formatter: (numberValue: number) => string) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? `${formatter(parsed)}${suffix}` : null;
}

function priceLabel(value: string | null, prefix: string) {
  return positiveNumberLabel(value, "", (numberValue) => `${prefix} ${Math.round(numberValue).toLocaleString("ko-KR")}원`);
}

export function buildSavedFilterLabel(params: URLSearchParams, options: SavedFilterLabelOptions) {
  const search = params.get("search")?.trim();
  const parts = [
    search ? `검색: ${search.slice(0, 28)}${search.length > 28 ? "…" : ""}` : null,
    optionLabel(options.categories, params.get("category"), "value"),
    optionLabel(options.useCases, params.get("useCase"), "id"),
    optionLabel(options.priceBands, params.get("priceBand"), "id"),
    conditionLabels.has(params.get("condition") ?? "") ? `등급 ${params.get("condition")}` : null,
    qualityLabels[params.get("quality") ?? ""] ?? null,
    stockLabels[params.get("stock") ?? ""] ?? null,
    positiveNumberLabel(params.get("minScore"), "", (value) => `점수 ${Math.round(value)}점 이상`),
    positiveNumberLabel(params.get("minDiscount"), "", (value) => `${Math.round(value)}% 할인 이상`),
    priceLabel(params.get("minPrice"), "최소"),
    priceLabel(params.get("maxPrice"), "최대"),
    sortLabels[params.get("sort") ?? ""] ?? null
  ];

  return parts.filter((part): part is string => Boolean(part)).join(" · ") || "전체 딜";
}

export function buildSavedFilterHref(pathname: string, search: string) {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return "/deals";
  const url = new URL(`${pathname}${search}`, internalOrigin);
  url.searchParams.delete("page");
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}`;
}

function canonicalSavedFilterHref(rawHref: string) {
  try {
    const url = new URL(rawHref, internalOrigin);
    return buildSavedFilterHref(url.pathname, url.search);
  } catch {
    return null;
  }
}

export function normalizeSavedFilters(value: unknown): SavedFilter[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value
    .flatMap((item): SavedFilter[] => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<SavedFilter>;
      const rawHref = typeof candidate.href === "string" ? candidate.href.trim().slice(0, 1200) : "";
      const label = typeof candidate.label === "string" ? candidate.label.trim().slice(0, 160) : "";
      if (!rawHref || !rawHref.startsWith("/") || rawHref.startsWith("//") || !label) return [];
      const href = canonicalSavedFilterHref(rawHref);
      if (!href || seen.has(href)) return [];
      seen.add(href);
      return [
        {
          href,
          label,
          savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : ""
        }
      ];
    })
    .slice(0, maxSavedFilters);
}
