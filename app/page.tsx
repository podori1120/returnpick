import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BatteryCharging,
  Bot,
  CloudRain,
  Laptop2,
  Monitor,
  Search,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Wind,
  type LucideIcon
} from "lucide-react";
import AffiliateNotice from "@/components/AffiliateNotice";
import ApprovalSampleCard from "@/components/ApprovalSampleCard";
import DealCard from "@/components/DealCard";
import DemoModeNotice from "@/components/DemoModeNotice";
import PurposeDealExplorer, { type PurposeExplorerItem } from "@/components/PurposeDealExplorer";
import RecentDealsRail from "@/components/RecentDealsRail";
import { categoryOptions, getCategoryLabel } from "@/lib/category";
import { listProducts } from "@/lib/dataStore";
import { getUseCaseMatches } from "@/lib/dealIntelligence";
import { approvalSampleProduct } from "@/lib/approvalSample";
import { homeCategoryDetails, homePurposeOptions } from "@/lib/homeDiscovery";
import { isDemoProduct, isPublicDealVisible } from "@/lib/publicDeal";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

const popularSearches = ["갤럭시북", "LG 그램", "QHD 모니터", "로봇청소기"];

const categoryIcons: Record<Category, LucideIcon> = {
  laptop: Laptop2,
  monitor: Monitor,
  robot_vacuum: Bot,
  cordless_vacuum: BatteryCharging,
  air_purifier: Wind,
  dehumidifier: CloudRain
};

export default async function HomePage() {
  const products = (await listProducts({ published: true }))
    .filter(isPublicDealVisible)
    .sort((a, b) => (b.latest_score?.total_score ?? 0) - (a.latest_score?.total_score ?? 0));
  const featured = products.slice(0, 6);
  const demoCount = products.filter(isDemoProduct).length;
  const hasPublishedDeals = products.length > 0;
  const counts = categoryOptions.map((category) => ({
    ...category,
    count: products.filter((product) => product.category === category.value).length,
    description: homeCategoryDetails[category.value].description
  }));
  const purposeItems: PurposeExplorerItem[] = homePurposeOptions.map((purpose) => {
    const matchingProducts = products
      .map((product) => {
        const purposeMatches = getUseCaseMatches(product).filter((match) => purpose.useCaseIds.includes(match.id));
        return { product, fitScore: Math.max(...purposeMatches.map((match) => match.score), 0) };
      })
      .filter((item) => item.fitScore >= 60)
      .sort((a, b) => b.fitScore - a.fitScore || (b.product.latest_score?.total_score ?? 0) - (a.product.latest_score?.total_score ?? 0));
    const topDeal = matchingProducts[0];
    return {
      id: purpose.id,
      count: matchingProducts.length,
      topDeal: topDeal
        ? {
            href: `/deals/${topDeal.product.id}`,
            title: topDeal.product.title,
            categoryLabel: getCategoryLabel(topDeal.product.category),
            score: topDeal.product.latest_score?.total_score ?? null,
            fitScore: topDeal.fitScore,
            verdict: topDeal.product.latest_score?.verdict ?? null,
            conditionGrade: topDeal.product.condition_grade
          }
        : null
    };
  });
  const initialPurposeId = purposeItems.find((item) => item.count > 0)?.id ?? homePurposeOptions[0].id;

  return (
    <main>
      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-4 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:py-4">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-black text-pine">
              {hasPublishedDeals ? "반품 노트북·디지털·소형가전 비교" : "오늘의 직접 검수 추천"}
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
              {hasPublishedDeals ? "가격보다 먼저, 살 만한 근거를 확인합니다" : "사기 전에, 확인할 것부터 정리했습니다"}
            </h1>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-steel">
              {hasPublishedDeals
                ? "상품명과 모델을 검색하면 가격 차이, 반품등급, 핵심 스펙과 주의점을 한 번에 비교합니다. 확인되지 않은 반품 정보는 추측하지 않고 확인필요로 표시합니다."
                : `${approvalSampleProduct.name}의 핵심 사양과 구매 전 확인사항을 직접 정리했습니다. 가격·재고·배송 조건은 쿠팡에서 최종 확인하며, 확인되지 않은 반품 정보는 추측하지 않습니다.`}
            </p>
            {hasPublishedDeals ? (
              <>
                <form action="/deals" className="mt-6 flex max-w-2xl gap-2" role="search">
                  <label className="relative min-w-0 flex-1">
                    <span className="sr-only">상품 검색</span>
                    <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-steel" size={20} aria-hidden />
                    <input
                      className="focus-ring h-12 w-full rounded-lg border border-line bg-white pl-12 pr-4 text-sm font-bold text-ink placeholder:text-steel"
                      name="search"
                      placeholder="상품명·브랜드·모델명 검색"
                    />
                  </label>
                  <button className="focus-ring inline-flex h-12 shrink-0 items-center gap-2 rounded-lg bg-ink px-5 text-sm font-black text-white hover:bg-pine" type="submit">
                    딜 찾기 <ArrowRight size={17} aria-hidden />
                  </button>
                </form>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-steel">
                  <span>많이 찾는 검색</span>
                  {popularSearches.map((keyword) => (
                    <Link
                      key={keyword}
                      className="focus-ring rounded-md border border-line bg-white px-2.5 py-1.5 text-ink hover:border-pine hover:text-pine"
                      href={`/deals?search=${encodeURIComponent(keyword)}`}
                    >
                      {keyword}
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-4 max-w-2xl border-y border-line py-3 sm:mt-6 sm:py-4">
                <p className="text-xs font-black text-pine">현재 공개된 직접 검수 콘텐츠 1건</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-steel">
                  실제 구매 경로와 검수 근거가 확인된 콘텐츠만 먼저 보여드립니다. 자동 수집 딜은 상품별 파트너스 링크와 검수를 마친 뒤 추가됩니다.
                </p>
              </div>
            )}
            {!hasPublishedDeals ? (
              <Link
                className="focus-ring mt-4 grid max-w-2xl grid-cols-[72px_minmax(0,1fr)] items-center gap-3 rounded-lg border border-line bg-mist p-2 lg:hidden"
                href={approvalSampleProduct.detailPath}
              >
                <span className="relative h-[72px] overflow-hidden rounded-md bg-white">
                  <Image alt={approvalSampleProduct.imageAlt} className="object-cover" fill priority sizes="72px" src={approvalSampleProduct.imageSrc} />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-black text-pine">직접 검수 추천</span>
                  <strong className="mt-1 line-clamp-1 block text-sm font-black text-ink">{approvalSampleProduct.name}</strong>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-black text-steel">
                    검수 내용 보기 <ArrowRight size={13} aria-hidden />
                  </span>
                </span>
              </Link>
            ) : null}
            <div className={hasPublishedDeals ? "mt-6 flex flex-wrap gap-2" : "mt-3 flex flex-wrap gap-2 sm:mt-6"}>
              <Link
                className={hasPublishedDeals
                  ? "focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-5 py-3 text-sm font-black text-white hover:bg-ink"
                  : "focus-ring hidden items-center gap-2 rounded-lg bg-pine px-5 py-3 text-sm font-black text-white hover:bg-ink sm:inline-flex"}
                href={hasPublishedDeals ? "/deals" : approvalSampleProduct.detailPath}
              >
                {hasPublishedDeals ? "검수 완료 딜" : "첫 추천 구매 전 체크"} <ArrowRight size={16} aria-hidden />
              </Link>
              {hasPublishedDeals ? (
                <Link className="focus-ring rounded-lg border border-pine bg-white px-5 py-3 text-sm font-black text-pine hover:bg-pine hover:text-white" href={approvalSampleProduct.detailPath}>
                  직접 검수 추천 상품
                </Link>
              ) : null}
              <Link className="focus-ring rounded-lg border border-line px-5 py-3 text-sm font-black hover:bg-mist" href="/guide/return-checklist">
                수령 체크리스트
              </Link>
            </div>
          </div>
          <div className={hasPublishedDeals ? "lg:self-start" : "hidden lg:block lg:self-start"}>
            {featured[0] ? (
              <DealCard product={featured[0]} />
            ) : (
              <ApprovalSampleCard placement="home" />
            )}
          </div>
        </div>
      </section>

      {demoCount ? (
        <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
          <DemoModeNotice count={demoCount} />
        </section>
      ) : null}

      <section className="border-b border-line bg-mist" aria-labelledby="category-heading">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-black text-pine">CATEGORY</p>
              <h2 className="mt-1 text-2xl font-black" id="category-heading">카테고리부터 골라보세요</h2>
              <p className="mt-1 text-sm font-semibold text-steel">상품이 없어도 카테고리별 반품 구매 기준을 먼저 확인할 수 있습니다.</p>
            </div>
            <Link className="focus-ring inline-flex items-center gap-2 text-sm font-black text-pine hover:text-ink" href="/guide/safe-categories">
              카테고리 안전성 보기 <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {counts.map((category) => {
              const Icon = categoryIcons[category.value];
              return (
                <Link
                  key={category.value}
                  className="focus-ring group flex min-h-36 flex-col rounded-lg border border-line bg-white p-4 hover:border-pine hover:bg-mist"
                  href={`/deals/category/${category.value}`}
                >
                  <span className="flex size-10 items-center justify-center rounded-md bg-mist text-pine group-hover:bg-pine group-hover:text-white">
                    <Icon size={20} aria-hidden />
                  </span>
                  <strong className="mt-3 text-sm font-black text-ink">{category.label}</strong>
                  <span className="mt-1 text-xs font-semibold leading-5 text-steel">{category.description}</span>
                  <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-black text-pine">
                    {category.count ? `${category.count}개 검수 완료` : "구매 기준 보기"} <ArrowRight size={13} aria-hidden />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <PurposeDealExplorer items={purposeItems} initialPurposeId={initialPurposeId} />

      {hasPublishedDeals ? (
        <section className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6">
          <RecentDealsRail />
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-black text-pine">Today</p>
              <h2 className="text-2xl font-black">오늘 볼 만한 딜</h2>
              <p className="mt-1 text-sm font-semibold text-steel">현재 공개 상품 {products.length.toLocaleString("ko-KR")}개</p>
            </div>
            <Link className="text-sm font-black text-pine hover:text-ink" href="/deals">
              더 보기
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featured.map((product) => (
              <DealCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:px-6 lg:grid-cols-3">
        {[
          { icon: Sparkles, title: "가격 차이", body: "네이버 최저가와 새상품가를 기준으로 실제로 싸게 살 만한지 먼저 봅니다." },
          { icon: ShieldCheck, title: "반품 상태", body: "등급과 반품가는 확인된 근거가 있을 때만 반영하고, 모호하면 보수적으로 낮춥니다." },
          { icon: TimerReset, title: "변동 체크", body: "가격과 재고는 자주 바뀌기 때문에 수집 시점과 변동 기록을 함께 보여줍니다." }
        ].map((item) => (
          <div key={item.title} className="rounded-lg border border-line bg-white p-5">
            <item.icon className="text-pine" size={24} aria-hidden />
            <h3 className="mt-3 text-lg font-black">{item.title}</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-steel">{item.body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        <AffiliateNotice />
      </section>
    </main>
  );
}
