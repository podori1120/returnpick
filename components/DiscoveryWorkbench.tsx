import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BatteryCharging,
  Bot,
  CloudRain,
  Laptop2,
  Monitor,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Wind,
  type LucideIcon
} from "lucide-react";
import { categoryOptions } from "@/lib/category";
import { homeCategoryDetails } from "@/lib/homeDiscovery";
import type { Category } from "@/lib/types";

const popularSearches = ["갤럭시북", "LG 그램", "QHD 모니터", "로봇청소기"];

const categoryIcons: Record<Category, LucideIcon> = {
  laptop: Laptop2,
  monitor: Monitor,
  robot_vacuum: Bot,
  cordless_vacuum: BatteryCharging,
  air_purifier: Wind,
  dehumidifier: CloudRain
};

const interpretationSignals = [
  {
    icon: SlidersHorizontal,
    title: "가격 근거",
    body: "네이버 최저가, 새상품가, 수집가 순으로 기준을 세웁니다. 근거가 없으면 확인필요로 남깁니다."
  },
  {
    icon: ShieldCheck,
    title: "반품 상태",
    body: "반품등급과 반품가가 확인된 경우만 안정성에 반영하고, 웹 단서는 보조 근거로 구분합니다."
  },
  {
    icon: BadgeCheck,
    title: "사양 적합",
    body: "상품명에서 읽은 RAM·SSD·화면·용량을 용도와 맞춰 보고 상세 옵션을 다시 확인하게 합니다."
  },
  {
    icon: Search,
    title: "추가 확인",
    body: "배터리·필터·도킹·FreeDOS처럼 구매 뒤 비용이 될 수 있는 위험을 먼저 표시합니다."
  }
] as const;

type DiscoveryWorkbenchProps = {
  placement: "home" | "deals" | "picks";
  showCategoryRail?: boolean;
  title?: string;
  description?: string;
};

export default function DiscoveryWorkbench({
  placement,
  showCategoryRail = true,
  title = "상품명을 찾고, 살 만한 근거부터 비교하세요",
  description = "리턴픽은 가격 숫자 하나만 보여주지 않습니다. 같은 모델인지, 반품 상태가 확인됐는지, 구매 뒤 추가 비용이 생기는지 순서대로 해석합니다."
}: DiscoveryWorkbenchProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-white shadow-soft" aria-labelledby={`discovery-workbench-${placement}`}>
      <div className="border-b border-line bg-mist p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-black text-pine">리턴픽 비교 기준</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-ink" id={`discovery-workbench-${placement}`}>
              {title}
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-steel">{description}</p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-pine" aria-hidden>
            <Search size={20} />
          </span>
        </div>

        <form action="/deals" className="mt-5 flex flex-col gap-2 sm:flex-row" role="search">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">상품명·브랜드·모델명 검색</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-steel" size={19} aria-hidden />
            <input
              className="focus-ring h-12 w-full rounded-lg border border-line bg-white pl-11 pr-4 text-sm font-bold text-ink placeholder:text-steel"
              name="search"
              placeholder="상품명·브랜드·모델명 검색"
              type="search"
            />
          </label>
          <button className="focus-ring inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-black text-white hover:bg-pine" type="submit">
            비교 시작 <ArrowRight size={17} aria-hidden />
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
      </div>

      {showCategoryRail ? (
        <div className="border-b border-line p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black text-pine">카테고리 둘러보기</p>
              <h3 className="mt-1 text-lg font-black">찾는 품목의 기준부터 열어보세요</h3>
            </div>
            <Link className="focus-ring inline-flex items-center gap-1 text-xs font-black text-pine hover:text-ink" href="/guide/safe-categories">
              안전 카테고리 안내 <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
          <div className="hide-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="카테고리별 구매 기준">
            {categoryOptions.map((category) => {
              const Icon = categoryIcons[category.value];
              return (
                <Link
                  key={category.value}
                  className="focus-ring group flex min-w-[150px] flex-1 flex-col rounded-lg border border-line bg-white p-3 hover:border-pine hover:bg-mist sm:min-w-[165px]"
                  href={`/deals/category/${category.value}`}
                >
                  <span className="flex size-9 items-center justify-center rounded-md bg-mist text-pine group-hover:bg-pine group-hover:text-white">
                    <Icon size={18} aria-hidden />
                  </span>
                  <strong className="mt-3 text-sm font-black text-ink">{category.label}</strong>
                  <span className="mt-1 text-xs font-semibold leading-5 text-steel">{homeCategoryDetails[category.value].description}</span>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-pine group-hover:text-ink">
                    기준 보기 <ArrowRight size={13} aria-hidden />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="p-5 sm:p-6">
        <div>
          <p className="text-xs font-black text-pine">리턴픽이 딜을 읽는 방법</p>
          <h3 className="mt-1 text-lg font-black">리턴픽이 상품을 해석하는 네 가지 신호</h3>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {interpretationSignals.map((signal) => {
            const Icon = signal.icon;
            return (
              <div key={signal.title} className="rounded-lg border border-line bg-mist p-4">
                <Icon className="text-pine" size={20} aria-hidden />
                <h4 className="mt-3 text-sm font-black text-ink">{signal.title}</h4>
                <p className="mt-1 text-xs font-semibold leading-5 text-steel">{signal.body}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs font-bold leading-5 text-steel">
          공개 상품이 생기면 같은 기준으로 점수·가격 비교·위험 플래그를 나란히 보여드립니다. 확인되지 않은 정보는 좋은 숫자로 바꾸지 않습니다.
        </p>
      </div>
    </section>
  );
}
