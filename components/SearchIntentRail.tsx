import Link from "next/link";
import {
  ArrowRight,
  BatteryCharging,
  Bot,
  CloudRain,
  Gamepad2,
  GraduationCap,
  Laptop2,
  Monitor,
  Wind,
  type LucideIcon
} from "lucide-react";
import { searchIntentLandings, type SearchIntentIcon } from "@/lib/searchLandings";

const icons: Record<SearchIntentIcon, LucideIcon> = {
  laptop: Laptop2,
  monitor: Monitor,
  robot: Bot,
  cordless: BatteryCharging,
  air: Wind,
  dehumidifier: CloudRain,
  study: GraduationCap,
  gaming: Gamepad2
};

export default function SearchIntentRail({ limit = searchIntentLandings.length }: { limit?: number }) {
  const items = searchIntentLandings.slice(0, Math.max(1, limit));

  return (
    <section className="border-y border-line bg-white" aria-labelledby="search-intent-heading">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-black text-pine">검색 의도별 가이드</p>
            <h2 id="search-intent-heading" className="mt-1 text-2xl font-black">찾고 있는 제품으로 바로 들어가세요</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-steel">
              반품 상품을 검색할 때 먼저 확인할 사양과 위험을 주제별로 정리했습니다. 검수와 구매 링크 확인을 마친 상품만 각 페이지에 추가됩니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-4 py-2.5 text-sm font-black text-white hover:bg-ink" href="/guide/high-value">
              고가 제품 구매 가이드 모음 <ArrowRight size={16} aria-hidden />
            </Link>
            <Link className="focus-ring inline-flex items-center gap-2 text-sm font-black text-pine hover:text-ink" href="/deals">
              전체 공개 딜 보기 <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const Icon = icons[item.icon];
            return (
              <Link
                key={item.slug}
                className="focus-ring group flex min-h-32 flex-col rounded-lg border border-line bg-mist p-4 hover:border-pine hover:bg-white"
                href={`/guide/search/${item.slug}`}
              >
                <span className="flex size-9 items-center justify-center rounded-md bg-white text-pine group-hover:bg-pine group-hover:text-white">
                  <Icon size={18} aria-hidden />
                </span>
                <strong className="mt-3 text-sm font-black text-ink">{item.label}</strong>
                <span className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-steel">{item.searchLabel}</span>
                <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-black text-pine">
                  구매 기준 보기 <ArrowRight size={13} aria-hidden />
                </span>
              </Link>
            );
          })}
        </div>
        <p className="mt-4 text-xs font-semibold leading-5 text-steel">현재 딜이 없는 주제도 내용을 먼저 볼 수 있습니다. 가격·재고·반품등급은 확인된 값만 표시합니다.</p>
      </div>
    </section>
  );
}
