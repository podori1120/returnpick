"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BadgePercent,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  Gamepad2,
  ShieldCheck,
  Wind,
  type LucideIcon
} from "lucide-react";
import { getCategoryLabel } from "@/lib/category";
import { homePurposeOptions, type HomePurposeId } from "@/lib/homeDiscovery";

export type PurposeDealSummary = {
  href: string;
  title: string;
  categoryLabel: string;
  score: number | null;
  fitScore: number;
  verdict: string | null;
  conditionGrade: string;
};

export type PurposeEditorialFallback = {
  href: string;
  label: string;
  title: string;
  description: string;
};

export type PurposeExplorerItem = {
  id: HomePurposeId;
  count: number;
  topDeal: PurposeDealSummary | null;
  editorialFallback?: PurposeEditorialFallback | null;
};

const purposeIcons: Record<(typeof homePurposeOptions)[number]["icon"], LucideIcon> = {
  briefcase: BriefcaseBusiness,
  gamepad: Gamepad2,
  bot: Bot,
  wind: Wind,
  percent: BadgePercent
};

export default function PurposeDealExplorer({
  items,
  initialPurposeId
}: {
  items: PurposeExplorerItem[];
  initialPurposeId: HomePurposeId;
}) {
  const [selectedId, setSelectedId] = useState<HomePurposeId>(initialPurposeId);
  const selectedIndex = homePurposeOptions.findIndex((item) => item.id === selectedId);
  const selected = homePurposeOptions[selectedIndex] ?? homePurposeOptions[0];
  const selectedMetrics = items.find((item) => item.id === selected.id) ?? { id: selected.id, count: 0, topDeal: null, editorialFallback: null };
  const SelectedIcon = purposeIcons[selected.icon];

  function selectRelative(offset: number) {
    const nextIndex = (selectedIndex + offset + homePurposeOptions.length) % homePurposeOptions.length;
    const nextId = homePurposeOptions[nextIndex].id;
    setSelectedId(nextId);
    requestAnimationFrame(() => document.getElementById(`purpose-tab-${nextId}`)?.focus());
  }

  return (
    <section className="border-y border-ink bg-ink text-white" aria-labelledby="purpose-heading">
      <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:py-11">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-black text-lemon">용도별 추천</p>
            <h2 className="mt-1 text-2xl font-black" id="purpose-heading">어떤 용도로 찾으세요?</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/70">
              용도를 고르면 먼저 볼 사양과 반품 위험을 알려드리고, 조건을 통과한 딜이 있으면 바로 연결합니다.
            </p>
          </div>
          <Link className="focus-ring inline-flex items-center gap-2 text-sm font-black text-white hover:text-lemon" href="/deals">
            전체 검수 딜 보기 <ArrowRight size={16} aria-hidden />
          </Link>
        </div>

        <div className="hide-scrollbar mt-6 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2" role="tablist" aria-label="추천 목적 선택">
            {homePurposeOptions.map((option) => {
              const metrics = items.find((item) => item.id === option.id);
              const Icon = purposeIcons[option.icon];
              const selectedTab = option.id === selected.id;
              return (
                <button
                  key={option.id}
                  aria-controls={`purpose-panel-${option.id}`}
                  aria-selected={selectedTab}
                  className={selectedTab
                    ? "focus-ring inline-flex min-h-12 items-center gap-2 rounded-md bg-lemon px-4 text-sm font-black text-ink"
                    : "focus-ring inline-flex min-h-12 items-center gap-2 rounded-md border border-white/20 bg-white/5 px-4 text-sm font-black text-white hover:border-white/50 hover:bg-white/10"}
                  id={`purpose-tab-${option.id}`}
                  onClick={() => setSelectedId(option.id)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowRight") {
                      event.preventDefault();
                      selectRelative(1);
                    }
                    if (event.key === "ArrowLeft") {
                      event.preventDefault();
                      selectRelative(-1);
                    }
                  }}
                  role="tab"
                  tabIndex={selectedTab ? 0 : -1}
                  type="button"
                >
                  <Icon size={17} aria-hidden />
                  <span>{option.label}</span>
                  {metrics?.count ? <span className="rounded bg-ink/10 px-1.5 py-0.5 text-[11px]">{metrics.count}</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div
          aria-labelledby={`purpose-tab-${selected.id}`}
          className="mt-6 grid gap-7 border-t border-white/15 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]"
          id={`purpose-panel-${selected.id}`}
          role="tabpanel"
        >
          <div>
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white text-ink">
                <SelectedIcon size={21} aria-hidden />
              </span>
              <div>
                <p className="text-xs font-black text-lemon">{selected.eyebrow}</p>
                <h3 className="mt-1 text-xl font-black">{selected.label}용 반품 딜 기준</h3>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/70">{selected.description}</p>
              </div>
            </div>
            <ul className="mt-5 grid gap-2 sm:grid-cols-3">
              {selected.checks.map((check) => (
                <li key={check} className="flex min-h-16 items-start gap-2 border-t border-white/15 py-3 text-sm font-bold leading-5 text-white/85">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-lemon" size={16} aria-hidden />
                  <span>{check}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-white/15 pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
            {selectedMetrics.topDeal ? (
              <>
                <p className="text-xs font-black text-lemon">이 목적의 최고 적합 딜</p>
                <p className="mt-2 text-lg font-black leading-7">{selectedMetrics.topDeal.title}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                  <span className="rounded-md bg-white/10 px-2.5 py-1">{selectedMetrics.topDeal.categoryLabel}</span>
                  <span className="rounded-md bg-white/10 px-2.5 py-1">상태 {selectedMetrics.topDeal.conditionGrade}</span>
                  <span className="rounded-md bg-lemon px-2.5 py-1 text-ink">용도 적합도 {selectedMetrics.topDeal.fitScore}점</span>
                  {selectedMetrics.topDeal.score != null ? <span className="rounded-md bg-lemon px-2.5 py-1 text-ink">{selectedMetrics.topDeal.score}점</span> : null}
                  {selectedMetrics.topDeal.verdict ? <span className="rounded-md bg-pine px-2.5 py-1">{selectedMetrics.topDeal.verdict}</span> : null}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link className="focus-ring inline-flex items-center gap-2 rounded-md bg-white px-4 py-3 text-sm font-black text-ink hover:bg-lemon" href={selectedMetrics.topDeal.href}>
                    검수 근거 확인 <ArrowRight size={16} aria-hidden />
                  </Link>
                  <Link
                    className="focus-ring inline-flex items-center gap-2 rounded-md border border-white/25 px-4 py-3 text-sm font-black text-white hover:border-lemon hover:text-lemon"
                    href={`/deals?useCase=${selected.primaryUseCaseId}&sort=fit`}
                  >
                    {selectedMetrics.count}개 비교
                  </Link>
                </div>
              </>
            ) : selectedMetrics.editorialFallback ? (
              <>
                <div className="flex items-center gap-2 text-lemon">
                  <ShieldCheck size={18} aria-hidden />
                  <p className="text-xs font-black">현재 바로 확인 가능한 직접 검수 콘텐츠</p>
                </div>
                <p className="mt-2 text-lg font-black leading-7">{selectedMetrics.editorialFallback.title}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-white/70">
                  {selectedMetrics.editorialFallback.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link className="focus-ring inline-flex items-center gap-2 rounded-md bg-white px-4 py-3 text-sm font-black text-ink hover:bg-lemon" href={selectedMetrics.editorialFallback.href}>
                    {selectedMetrics.editorialFallback.label} <ArrowRight size={16} aria-hidden />
                  </Link>
                  <Link className="focus-ring inline-flex items-center gap-2 rounded-md border border-white/25 px-4 py-3 text-sm font-black text-white hover:border-lemon hover:text-lemon" href={selected.guideHref}>
                    구매 기준 보기 <ArrowRight size={16} aria-hidden />
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-lemon">
                  <ShieldCheck size={18} aria-hidden />
                  <p className="text-xs font-black">검수 완료 딜 준비 중</p>
                </div>
                <p className="mt-2 text-lg font-black leading-7">이 용도의 상품이 들어오기 전에도 비교 기준을 바로 확인할 수 있습니다.</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-white/70">
                  자동 수집 후보가 관리자 검수와 상품별 파트너스 링크 확인을 통과하면 이 탭에 자동으로 표시됩니다. 지금은 아래 가이드에서 같은 기준으로 비교를 시작하세요.
                </p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {selected.guideLinks.slice(0, 2).map((guide) => (
                    <Link
                      key={guide.href}
                      className="focus-ring inline-flex items-center justify-between gap-2 rounded-md border border-white/20 px-3 py-3 text-sm font-black text-white hover:border-lemon hover:text-lemon"
                      href={guide.href}
                    >
                      {guide.label} <ArrowRight size={15} aria-hidden />
                    </Link>
                  ))}
                </div>
                <Link className="focus-ring mt-3 inline-flex items-center gap-2 text-sm font-black text-lemon hover:text-white" href={selected.guideHref}>
                  수령 후 체크리스트 보기 <ArrowRight size={16} aria-hidden />
                </Link>
              </>
            )}

            <div className="mt-6 border-t border-white/15 pt-4">
              <p className="text-xs font-black text-white/55">먼저 읽을 구매 가이드</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selected.guideLinks.map((guide) => (
                  <Link
                    key={guide.href}
                    className="focus-ring rounded-md border border-white/20 px-3 py-2 text-xs font-black text-white hover:border-lemon hover:text-lemon"
                    href={guide.href}
                  >
                    {guide.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-6 border-t border-white/15 pt-4">
              <p className="text-xs font-black text-white/55">관련 카테고리</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selected.categories.map((category) => (
                  <Link
                    key={category}
                    className="focus-ring rounded-md border border-white/20 px-3 py-2 text-xs font-black text-white hover:border-lemon hover:text-lemon"
                    href={`/deals/category/${category}`}
                  >
                    {getCategoryLabel(category)}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
