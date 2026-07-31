import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  Bot,
  BriefcaseBusiness,
  CloudRain,
  Feather,
  Gamepad2,
  MonitorUp,
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
import RecentDealsRail from "@/components/RecentDealsRail";
import { categoryOptions } from "@/lib/category";
import { listProducts } from "@/lib/dataStore";
import { matchesUseCase, useCaseOptions, type UseCaseId } from "@/lib/dealIntelligence";
import { isPublicDealReady } from "@/lib/publicDeal";

export const dynamic = "force-dynamic";

const popularSearches = ["갤럭시북", "LG 그램", "QHD 모니터", "로봇청소기"];

const useCaseIcons: Record<UseCaseId, LucideIcon> = {
  office_student: BriefcaseBusiness,
  gaming: Gamepad2,
  creator: MonitorUp,
  portable: Feather,
  budget: BadgePercent,
  floor_care: Bot,
  air_care: Wind,
  rainy_season: CloudRain
};

export default async function HomePage() {
  const products = (await listProducts({ published: true }))
    .filter(isPublicDealReady)
    .sort((a, b) => (b.latest_score?.total_score ?? 0) - (a.latest_score?.total_score ?? 0));
  const featured = products.slice(0, 6);
  const counts = categoryOptions.map((category) => ({
    ...category,
    count: products.filter((product) => product.category === category.value).length
  }));
  const useCases = useCaseOptions.map((option) => ({
    ...option,
    count: products.filter((product) => matchesUseCase(product, option.id)).length
  }));

  return (
    <main>
      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_420px] lg:py-14">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-black text-pine">반품 노트북·디지털·소형가전 비교</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">가격보다 먼저, 살 만한 근거를 확인합니다</h1>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-steel">
              상품명과 모델을 검색하면 가격 차이, 반품등급, 핵심 스펙과 주의점을 한 번에 비교합니다. 확인되지 않은 반품 정보는 추측하지 않고 확인필요로 표시합니다.
            </p>
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
            <div className="mt-6 flex flex-wrap gap-2">
              <Link className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-5 py-3 text-sm font-black text-white hover:bg-ink" href="/deals">
                검수 완료 딜 <ArrowRight size={16} aria-hidden />
              </Link>
              <Link className="focus-ring rounded-lg border border-pine bg-white px-5 py-3 text-sm font-black text-pine hover:bg-pine hover:text-white" href="/picks/novatech-s1-window-cleaner">
                직접 검수 추천 상품
              </Link>
              <Link className="focus-ring rounded-lg border border-line px-5 py-3 text-sm font-black hover:bg-mist" href="/guide/return-checklist">
                수령 체크리스트
              </Link>
            </div>
          </div>
          <div className="lg:self-start">
            {featured[0] ? (
              <DealCard product={featured[0]} />
            ) : (
              <ApprovalSampleCard placement="home" />
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-ink bg-ink text-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-black text-lemon">FOR YOUR USE</p>
              <h2 className="mt-1 text-2xl font-black">어떤 용도로 찾으세요?</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/70">용도에 맞는 스펙과 반품 위험을 함께 추려서 보여드립니다.</p>
            </div>
            <Link className="focus-ring inline-flex items-center gap-2 text-sm font-black text-white hover:text-lemon" href="/deals">
              전체 조건에서 찾기 <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {useCases.map((item) => {
              const Icon = useCaseIcons[item.id];
              return (
                <Link
                  key={item.id}
                  className="focus-ring group flex min-h-28 items-start gap-3 rounded-lg border border-white/15 bg-white/5 p-4 hover:border-lemon hover:bg-white/10"
                  href={`/deals?useCase=${item.id}&sort=fit`}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white text-ink group-hover:bg-lemon">
                    <Icon size={19} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center justify-between gap-2">
                      <strong className="text-sm font-black">{item.label}</strong>
                      <span className="shrink-0 text-xs font-black text-lemon">{item.count ? `${item.count}개` : "필터 열기"}</span>
                    </span>
                    <span className="mt-1.5 block text-xs font-semibold leading-5 text-white/65">{item.description}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

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
        {featured.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featured.map((product) => (
              <DealCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col justify-between gap-4 border-y border-line py-6 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-lg font-black">자동 수집 딜은 검수 후 공개됩니다</h3>
              <p className="mt-1 text-sm font-semibold leading-6 text-steel">지금은 상품 정보와 쿠팡 이동 경로를 직접 확인한 추천 상품부터 살펴보세요.</p>
            </div>
            <Link className="focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-pine px-4 py-3 text-sm font-black text-white hover:bg-ink" href="/picks/novatech-s1-window-cleaner">
              직접 검수 추천 보기 <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        )}
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <h2 className="text-2xl font-black">카테고리별 추천</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {counts.map((category) => (
              <Link
                key={category.value}
                className="rounded-lg border border-line p-4 font-black hover:border-pine hover:bg-mist"
                href={`/deals/category/${category.value}`}
              >
                <span className="block text-sm text-steel">{category.label}</span>
                <span className="mt-1 block text-lg text-ink">{category.count ? `${category.count}개 공개` : "검수 등록 대기"}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

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
