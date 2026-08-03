import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Search, ShieldCheck } from "lucide-react";
import AffiliateNotice from "@/components/AffiliateNotice";
import ApprovalSampleCard from "@/components/ApprovalSampleCard";
import DealCard from "@/components/DealCard";
import { ProductImpressionTracker } from "@/components/AffiliateEventTracker";
import SearchIntentRail from "@/components/SearchIntentRail";
import { categoryOptions, getCategoryLabel } from "@/lib/category";
import { listProducts } from "@/lib/dataStore";
import {
  getDealPrice,
  getDiscountRate,
  getUseCaseMatches,
  matchesPriceBand,
  matchesUseCase,
  priceBandOptions,
  useCaseOptions,
  type UseCaseId
} from "@/lib/dealIntelligence";
import { formatPercent } from "@/lib/format";
import { isPublicDealReady, isPublicDealVisible } from "@/lib/publicDeal";
import { getDealQuality } from "@/lib/quality";
import {
  MAX_RECOMMENDATIONS,
  parseRecommendationParams,
  rankRecommendationProducts,
  type RecommendationDependencies,
  type RecommendationFilters
} from "@/lib/recommendation";
import { getSiteUrl } from "@/lib/siteUrl";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

const siteUrl = getSiteUrl();
const canonicalUrl = `${siteUrl}/recommend`;
const pageTitle = "용도·예산 맞춤 반품 딜 추천";
const pageDescription = "사용 목적, 카테고리와 예산에 맞춰 현재 공개된 반품 딜만 용도 적합도와 검수 점수 순으로 비교합니다.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: { canonical: canonicalUrl },
  robots: { index: true, follow: true },
  openGraph: {
    title: `${pageTitle} | ReturnPick`,
    description: pageDescription,
    url: canonicalUrl,
    type: "website",
    locale: "ko_KR",
    siteName: "ReturnPick",
    images: [{ url: `${siteUrl}/opengraph-image` }]
  },
  twitter: {
    card: "summary_large_image",
    title: `${pageTitle} | ReturnPick`,
    description: pageDescription,
    images: [`${siteUrl}/twitter-image`]
  }
};

const recommendationDependencies: RecommendationDependencies = {
  categoryOptions,
  useCaseOptions,
  priceBandOptions,
  getDealPrice,
  getDiscountRate,
  getUseCaseMatches,
  matchesUseCase,
  matchesPriceBand,
  getQualityConfidence: (product) => getDealQuality(product).confidence
};

const categoryGuideSlugs: Record<Category, string> = {
  laptop: "return-laptop",
  monitor: "qhd-monitor",
  robot_vacuum: "robot-vacuum",
  cordless_vacuum: "cordless-vacuum",
  air_purifier: "air-purifier",
  dehumidifier: "dehumidifier"
};

const useCaseGuideSlugs: Partial<Record<UseCaseId, string>> = {
  office_student: "student-laptop",
  gaming: "gaming-laptop",
  creator: "return-laptop",
  portable: "return-laptop",
  floor_care: "robot-vacuum",
  air_care: "air-purifier",
  rainy_season: "dehumidifier"
};

function getGuideHref(filters: RecommendationFilters) {
  if (filters.category) return `/guide/search/${categoryGuideSlugs[filters.category]}`;
  const useCaseGuide = filters.useCase ? useCaseGuideSlugs[filters.useCase] : undefined;
  if (useCaseGuide) return `/guide/search/${useCaseGuide}`;
  return "/guide/safe-categories";
}

function getGuideLabel(filters: RecommendationFilters) {
  if (filters.category) return `${getCategoryLabel(filters.category)} 구매 가이드`;
  const useCase = useCaseOptions.find((option) => option.id === filters.useCase);
  return useCase ? `${useCase.label} 구매 가이드` : "안전 카테고리 가이드";
}

function getFilterSummary(filters: RecommendationFilters) {
  const labels = [
    useCaseOptions.find((option) => option.id === filters.useCase)?.label,
    categoryOptions.find((option) => option.value === filters.category)?.label,
    priceBandOptions.find((option) => option.id === filters.priceBand)?.label,
    filters.minScore !== undefined ? `최소 ${filters.minScore}점` : undefined
  ].filter((label): label is string => Boolean(label));

  return labels.length ? labels.join(" · ") : "전체 공개 딜";
}

function EmptyRecommendationLinks({ filters }: { filters: RecommendationFilters }) {
  const guideHref = getGuideHref(filters);
  const guideLabel = getGuideLabel(filters);

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <Link className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-4 py-2.5 text-sm font-black text-white hover:bg-ink" href="/deals">
        전체 공개 딜 보기 <ArrowRight size={16} aria-hidden />
      </Link>
      <Link className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-black text-ink hover:border-pine hover:text-pine" href="/picks">
        검수 추천 콘텐츠 <ArrowRight size={16} aria-hidden />
      </Link>
      <Link className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-black text-ink hover:border-pine hover:text-pine" href={guideHref}>
        {guideLabel} <ArrowRight size={16} aria-hidden />
      </Link>
    </div>
  );
}

function RecommendationFiltersForm({ filters }: { filters: RecommendationFilters }) {
  return (
    <form action="/recommend" className="grid gap-3 rounded-lg border border-line bg-white p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-5" method="get">
      <label className="grid gap-1 text-xs font-black text-steel">
        <span>사용 목적</span>
        <select className="focus-ring rounded-lg border border-line px-3 py-2.5 text-sm font-bold text-ink" defaultValue={filters.useCase ?? ""} name="useCase">
          <option value="">전체 용도</option>
          {useCaseOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-black text-steel">
        <span>카테고리</span>
        <select className="focus-ring rounded-lg border border-line px-3 py-2.5 text-sm font-bold text-ink" defaultValue={filters.category ?? ""} name="category">
          <option value="">전체 카테고리</option>
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-black text-steel">
        <span>가격대</span>
        <select className="focus-ring rounded-lg border border-line px-3 py-2.5 text-sm font-bold text-ink" defaultValue={filters.priceBand ?? ""} name="priceBand">
          <option value="">전체 가격대</option>
          {priceBandOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-black text-steel">
        <span>최소 점수 <span className="font-semibold">(선택)</span></span>
        <input
          className="focus-ring rounded-lg border border-line px-3 py-2.5 text-sm font-bold text-ink"
          defaultValue={filters.minScore ?? ""}
          inputMode="numeric"
          max="100"
          min="0"
          name="minScore"
          placeholder="예: 70"
          step="1"
          type="number"
        />
      </label>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
        <button className="focus-ring inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-black text-white hover:bg-pine" type="submit">
          맞춤 딜 보기 <Search size={16} aria-hidden />
        </button>
        <Link className="focus-ring inline-flex min-h-[44px] items-center justify-center rounded-lg border border-line px-3 py-2.5 text-sm font-black text-steel hover:bg-mist" href="/recommend">
          초기화
        </Link>
      </div>
    </form>
  );
}

export default async function RecommendationPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const filters = parseRecommendationParams(resolvedSearchParams, recommendationDependencies);
  const allPublicProducts = (await listProducts({ published: true })).filter(
    (product) => isPublicDealVisible(product) && isPublicDealReady(product)
  );
  const recommendations = rankRecommendationProducts(allPublicProducts, filters, recommendationDependencies);
  const filterSummary = getFilterSummary(filters);
  const resultMetricLabel = filters.useCase ? "용도 적합도" : filters.category || filters.priceBand ? "조건 일치도" : "검수 점수";
  const hasInventory = allPublicProducts.length > 0;

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      <header className="border-b border-line pb-7">
        <div className="flex flex-wrap items-center gap-2 text-sm font-black text-pine">
          <Search size={18} aria-hidden />
          <span>ReturnPick 맞춤 추천</span>
        </div>
        <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-tight sm:text-4xl">내 용도와 예산에 맞는 딜 찾기</h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-steel">
          사용 목적, 카테고리와 가격대를 고르면 현재 공개 기준을 통과한 상품만 용도 적합도와 검수 점수 순으로 보여드립니다. 판매 가격이 없거나 품절인 상품은 제외하고, 반품등급·재고가 확인필요한 상품은 주의사항과 함께 표시합니다.
        </p>
      </header>

      <section aria-labelledby="recommend-filter-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-black text-pine">추천 조건</p>
            <h2 className="mt-1 text-2xl font-black" id="recommend-filter-heading">세 가지만 골라보세요</h2>
            <p className="mt-1 text-sm font-semibold text-steel">조건은 URL에 남아 팀원에게 공유하거나 나중에 다시 열 수 있습니다.</p>
          </div>
          <p className="text-xs font-bold text-steel">결과는 최대 {MAX_RECOMMENDATIONS}개</p>
        </div>
        <div className="mt-5">
          <RecommendationFiltersForm filters={filters} />
        </div>
      </section>

      {hasInventory && recommendations.length ? (
        <section aria-labelledby="recommend-results-heading">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
            <div>
              <p className="text-sm font-black text-pine">현재 공개된 검수 딜</p>
              <h2 className="mt-1 text-2xl font-black" id="recommend-results-heading">{filterSummary} 추천 결과</h2>
              <p className="mt-1 text-sm font-semibold text-steel">
                {resultMetricLabel}, 점수, 검수 신뢰도와 할인율을 차례로 비교한 {recommendations.length.toLocaleString("ko-KR")}개입니다.
              </p>
            </div>
            <Link className="focus-ring inline-flex items-center gap-2 text-sm font-black text-pine hover:text-ink" href="/deals">
              전체 딜 조건 바꾸기 <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          <ProductImpressionTracker
            productIds={recommendations.map((recommendation) => recommendation.product.id)}
            channel="web_recommend"
            context="recommendation_results"
          />
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {recommendations.map((recommendation) => (
              <div key={recommendation.product.id} className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-black text-steel">
                  {recommendation.fitScore !== null ? (
                    <span className="rounded-md bg-pine/10 px-2.5 py-1 text-pine">용도 적합도 {recommendation.fitScore}점</span>
                  ) : recommendation.conditionMatchScore !== null ? (
                    <span className="rounded-md bg-pine/10 px-2.5 py-1 text-pine">조건 일치도 {recommendation.conditionMatchScore}점</span>
                  ) : null}
                  <span className="rounded-md bg-mist px-2.5 py-1">검수 신뢰도 {recommendation.qualityConfidence}점</span>
                  <span className="rounded-md bg-mist px-2.5 py-1">할인율 {formatPercent(recommendation.discountRate)}</span>
                </div>
                <DealCard product={recommendation.product} />
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs font-semibold leading-5 text-steel">구매 버튼은 상품별 파트너스 링크가 확인된 경우에만 카드 안에 표시됩니다. 가격·재고·반품등급은 구매처에서 최종 확인하세요.</p>
        </section>
      ) : hasInventory ? (
        <section className="rounded-lg border border-line bg-mist p-6 sm:p-8" aria-labelledby="recommend-empty-filter-heading">
          <div className="flex size-11 items-center justify-center rounded-md bg-white text-pine">
            <ShieldCheck size={23} aria-hidden />
          </div>
          <h2 className="mt-4 text-2xl font-black" id="recommend-empty-filter-heading">선택한 조건의 공개 딜이 없습니다</h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-steel">
            현재 공개된 상품은 있지만 선택한 용도·카테고리·가격대 조합을 모두 통과한 상품이 없습니다. 조건을 넓히거나 아래의 전체 딜과 구매 가이드에서 확인된 정보부터 살펴보세요.
          </p>
          <EmptyRecommendationLinks filters={filters} />
        </section>
      ) : (
        <section className="rounded-lg border border-line bg-mist p-6 sm:p-8" aria-labelledby="recommend-empty-catalog-heading">
          <div className="flex size-11 items-center justify-center rounded-md bg-white text-pine">
            <CheckCircle2 size={23} aria-hidden />
          </div>
          <h2 className="mt-4 text-2xl font-black" id="recommend-empty-catalog-heading">현재 공개된 상품이 없습니다</h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-steel">
            상품 식별, 가격 근거, 검수와 상품별 파트너스 링크 확인을 마친 상품만 공개합니다. 지금은 재고·가격·조건을 숫자로 채우지 않고, 구매 가이드와 직접 검수 콘텐츠를 먼저 안내합니다.
          </p>
          <EmptyRecommendationLinks filters={filters} />
        </section>
      )}

      {!hasInventory ? (
        <section className="grid gap-6 border-y border-line py-7 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center" aria-labelledby="recommend-editorial-heading">
          <div className="px-1 py-3 lg:pr-8">
            <p className="text-sm font-black text-pine">상품이 들어오기 전</p>
            <h2 className="mt-2 text-2xl font-black" id="recommend-editorial-heading">검수 기준부터 확인하세요</h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-steel">
              오른쪽 카드는 실제 맞춤 추천 결과나 재고가 아니라, 직접 검수한 편집 콘텐츠입니다. 가격·재고·배송 조건은 해당 구매처에서 최종 확인하고, 자동 수집 상품은 공개 기준을 통과한 뒤에만 이 흐름에 추가됩니다.
            </p>
            <Link className="focus-ring mt-4 inline-flex items-center gap-2 text-sm font-black text-pine hover:text-ink" href={getGuideHref(filters)}>
              {getGuideLabel(filters)} 먼저 보기 <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          <ApprovalSampleCard placement="picks" />
        </section>
      ) : null}

      <SearchIntentRail limit={4} />

      <section className="flex items-start gap-3 rounded-lg border border-line bg-white p-5" aria-labelledby="recommend-rule-heading">
        <ShieldCheck className="mt-0.5 shrink-0 text-pine" size={20} aria-hidden />
        <div>
          <h2 className="text-sm font-black" id="recommend-rule-heading">공개 추천 원칙</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-steel">게시 상태와 공개 준비 기준을 모두 통과한 상품만 추천합니다. 판매 가격이 없거나 품절인 상품은 제외하고, 반품 근거·재고가 확인필요한 상품은 상세에서 확인할 점으로 안내합니다. 파트너스 링크가 확인되지 않은 상품에는 구매 버튼을 표시하지 않습니다.</p>
          <Link className="focus-ring mt-2 inline-flex text-xs font-black text-pine underline underline-offset-4 hover:text-ink" href="/guide/return-checklist">
            수령 체크리스트 보기
          </Link>
        </div>
      </section>

      <AffiliateNotice />
    </main>
  );
}
