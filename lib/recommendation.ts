import type { PriceBandId, UseCaseId } from "./dealIntelligence";
import type { Category, ProductWithScore } from "./types";

export const MAX_RECOMMENDATIONS = 6;

export type RecommendationSearchParams = Record<string, string | string[] | undefined>;

export type RecommendationFilters = {
  useCase?: UseCaseId;
  category?: Category;
  priceBand?: PriceBandId;
  minScore?: number;
};

export type RecommendationMatch = {
  product: ProductWithScore;
  fitScore: number | null;
  conditionMatchScore: number | null;
  score: number;
  qualityConfidence: number;
  discountRate: number | null;
  dealPrice: number | null;
};

export type RecommendationDependencies = {
  categoryOptions: ReadonlyArray<{ value: Category }>;
  useCaseOptions: ReadonlyArray<{ id: UseCaseId }>;
  priceBandOptions: ReadonlyArray<{ id: PriceBandId }>;
  getDealPrice: (product: ProductWithScore) => number | null;
  getDiscountRate: (product: ProductWithScore) => number | null;
  getUseCaseMatches: (product: ProductWithScore) => ReadonlyArray<{ id: UseCaseId; score: number }>;
  matchesUseCase: (product: ProductWithScore, useCaseId: UseCaseId) => boolean;
  matchesPriceBand: (product: ProductWithScore, priceBandId: PriceBandId) => boolean;
  getQualityConfidence: (product: ProductWithScore) => number;
};

function firstParam(value: string | string[] | undefined) {
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = first?.trim();
  return trimmed || undefined;
}

function findOption<T extends string>(value: string | undefined, options: ReadonlyArray<{ id: T }>) {
  return value && options.some((option) => option.id === value) ? (value as T) : undefined;
}

function findCategory(value: string | undefined, options: ReadonlyArray<{ value: Category }>) {
  return value && options.some((option) => option.value === value) ? (value as Category) : undefined;
}

function parseMinScore(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 100 ? parsed : undefined;
}

export function parseRecommendationParams(
  searchParams: RecommendationSearchParams,
  dependencies: Pick<RecommendationDependencies, "categoryOptions" | "useCaseOptions" | "priceBandOptions">
): RecommendationFilters {
  return {
    useCase: findOption(firstParam(searchParams.useCase), dependencies.useCaseOptions),
    category: findCategory(firstParam(searchParams.category), dependencies.categoryOptions),
    priceBand: findOption(firstParam(searchParams.priceBand), dependencies.priceBandOptions),
    minScore: parseMinScore(firstParam(searchParams.minScore))
  };
}

function matchesFilters(product: ProductWithScore, filters: RecommendationFilters, dependencies: RecommendationDependencies) {
  if (filters.category && product.category !== filters.category) return false;
  if (filters.useCase && !dependencies.matchesUseCase(product, filters.useCase)) return false;
  if (filters.priceBand && !dependencies.matchesPriceBand(product, filters.priceBand)) return false;
  if (filters.minScore !== undefined && (product.latest_score?.total_score ?? 0) < filters.minScore) return false;
  return true;
}

function getFitScore(product: ProductWithScore, filters: RecommendationFilters, dependencies: RecommendationDependencies) {
  const signals: number[] = [];
  if (filters.useCase) {
    const match = dependencies.getUseCaseMatches(product).find((item) => item.id === filters.useCase);
    signals.push(match?.score ?? 0);
  }
  if (filters.category) signals.push(product.category === filters.category ? 100 : 0);
  if (filters.priceBand) signals.push(dependencies.matchesPriceBand(product, filters.priceBand) ? 100 : 0);
  if (!signals.length) return null;
  return Math.round(signals.reduce((sum, value) => sum + value, 0) / signals.length);
}

export function rankRecommendationProducts(
  products: readonly ProductWithScore[],
  filters: RecommendationFilters,
  dependencies: RecommendationDependencies
): RecommendationMatch[] {
  return products
    .filter((product) => matchesFilters(product, filters, dependencies))
    .map((product) => {
      const matchScore = getFitScore(product, filters, dependencies);
      return {
        product,
        fitScore: filters.useCase ? matchScore : null,
        conditionMatchScore: !filters.useCase && matchScore !== null ? matchScore : null,
        matchScore: matchScore ?? -1,
        score: product.latest_score?.total_score ?? 0,
        qualityConfidence: dependencies.getQualityConfidence(product),
        discountRate: dependencies.getDiscountRate(product),
        dealPrice: dependencies.getDealPrice(product)
      };
    })
    .sort(
      (a, b) =>
        b.matchScore - a.matchScore ||
        b.score - a.score ||
        b.qualityConfidence - a.qualityConfidence ||
        (b.discountRate ?? -1) - (a.discountRate ?? -1) ||
        a.product.id.localeCompare(b.product.id)
    )
    .slice(0, MAX_RECOMMENDATIONS)
    .map(({ matchScore: _matchScore, ...match }) => match);
}

export function recommendProducts(
  products: readonly ProductWithScore[],
  searchParams: RecommendationSearchParams,
  dependencies: RecommendationDependencies
) {
  const filters = parseRecommendationParams(searchParams, dependencies);
  return { filters, matches: rankRecommendationProducts(products, filters, dependencies) };
}
