"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, Clock3, Link2Off, MousePointerClick, PackageSearch, TrendingUp } from "lucide-react";
import { getCategoryLabel } from "@/lib/category";
import { formatDate } from "@/lib/format";

type Metrics = {
  total: number;
  published: number;
  needsReview: number;
  approved: number;
  highScore: number;
  averageScore: number;
  unknownCondition: number;
  missingReturnPrice: number;
  missingAffiliateUrl: number;
  badPrice: number;
  changedRecently: number;
  qualityBuckets: {
    ready: number;
    manual_check: number;
    watch_price: number;
    hold: number;
  };
  latestRun: {
    status: string;
    started_at: string;
    found_count: number;
    inserted_count: number;
    updated_count: number;
    error_count: number;
  } | null;
  priorityQueue: Array<{
    id: string;
    title: string;
    category: string;
    status: string;
    score: number;
    verdict: string | null;
    quality_label: string;
    confidence: number;
    blockers: string[];
    warnings: string[];
  }>;
};

type RevenueMetrics = {
  totals: {
    impression: number;
    detail_view: number;
    affiliate_click: number;
    telegram_detail_click: number;
  };
  funnel: {
    impressions: number;
    detail_views: number;
    affiliate_clicks: number;
    detail_ctr: number;
    affiliate_ctr: number;
  };
  ctaReady: number;
  missingAffiliateUrl: number;
  productMetrics: Array<{
    product_id: string;
    title: string;
    category: string;
    score: number;
    impressions: number;
    detail_views: number;
    affiliate_clicks: number;
    telegram_clicks: number;
    detail_ctr: number;
    affiliate_ctr: number;
    cta_ready: boolean;
  }>;
  categoryMetrics: Array<{
    category: string;
    product_count: number;
    impressions: number;
    detail_views: number;
    affiliate_clicks: number;
    detail_ctr: number;
    affiliate_ctr: number;
  }>;
};

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

export default function AdminOpsDashboard({ password, refreshToken }: { password: string; refreshToken: number }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetrics | null>(null);

  async function loadMetrics() {
    const [metricsResponse, revenueResponse] = await Promise.all([
      fetch("/api/admin/metrics", { headers: headers(password) }),
      fetch("/api/admin/revenue-metrics", { headers: headers(password) })
    ]);
    const metricsData = await metricsResponse.json();
    const revenueData = await revenueResponse.json();
    setMetrics(metricsData.metrics ?? null);
    setRevenueMetrics(revenueData.metrics ?? null);
  }

  useEffect(() => {
    void loadMetrics();
  }, [password, refreshToken]);

  if (!metrics) {
    return (
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <p className="text-sm font-bold text-steel">운영 지표를 불러오는 중입니다.</p>
      </section>
    );
  }

  const cards = [
    { label: "검토 대기", value: metrics.needsReview, icon: PackageSearch, tone: "text-pine" },
    { label: "게시 중", value: metrics.published, icon: CheckCircle2, tone: "text-pine" },
    { label: "평균 점수", value: `${metrics.averageScore}점`, icon: BarChart3, tone: "text-lemon" },
    { label: "수동 확인", value: metrics.unknownCondition + metrics.missingReturnPrice, icon: AlertTriangle, tone: "text-coral" },
    { label: "구매 클릭", value: revenueMetrics?.funnel.affiliate_clicks ?? 0, icon: MousePointerClick, tone: "text-pine" },
    { label: "제휴 URL 누락", value: metrics.missingAffiliateUrl, icon: Link2Off, tone: "text-coral" },
    { label: "변동 감지", value: metrics.changedRecently, icon: Clock3, tone: "text-steel" }
  ];

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-line bg-white p-4 shadow-soft">
            <card.icon className={card.tone} size={20} aria-hidden />
            <p className="mt-3 text-xs font-black text-steel">{card.label}</p>
            <p className="mt-1 text-2xl font-black">{card.value}</p>
          </div>
        ))}
      </div>

      {revenueMetrics ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
          <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-pine" size={20} aria-hidden />
              <h2 className="text-lg font-black">수익 퍼널</h2>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg bg-mist p-3">
                <p className="font-bold text-steel">노출</p>
                <p className="mt-1 text-xl font-black">{revenueMetrics.funnel.impressions}</p>
              </div>
              <div className="rounded-lg bg-mist p-3">
                <p className="font-bold text-steel">상세 진입</p>
                <p className="mt-1 text-xl font-black">{revenueMetrics.funnel.detail_views}</p>
                <p className="mt-1 text-xs font-bold text-steel">CTR {revenueMetrics.funnel.detail_ctr}%</p>
              </div>
              <div className="rounded-lg bg-mist p-3">
                <p className="font-bold text-steel">구매 클릭</p>
                <p className="mt-1 text-xl font-black">{revenueMetrics.funnel.affiliate_clicks}</p>
                <p className="mt-1 text-xs font-bold text-steel">CTA {revenueMetrics.funnel.affiliate_ctr}%</p>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold text-steel">
              텔레그램 유입 {revenueMetrics.totals.telegram_detail_click} · CTA 준비 {revenueMetrics.ctaReady} · 링크 누락 {revenueMetrics.missingAffiliateUrl}
            </p>
          </div>

          <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <h2 className="text-lg font-black">클릭 상위 상품</h2>
            <div className="mt-4 space-y-2">
              {revenueMetrics.productMetrics.slice(0, 5).map((item) => (
                <div key={item.product_id} className="rounded-lg border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-black">{item.title}</p>
                    <span className={item.cta_ready ? "rounded-md bg-pine/10 px-2 py-1 text-xs font-black text-pine" : "rounded-md bg-coral/10 px-2 py-1 text-xs font-black text-coral"}>
                      {item.cta_ready ? "CTA 준비" : "링크 누락"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-steel">
                    상세 {item.detail_views} · 구매클릭 {item.affiliate_clicks} · 텔레그램 {item.telegram_clicks} · 전환 {item.affiliate_ctr}%
                  </p>
                </div>
              ))}
              {!revenueMetrics.productMetrics.length ? <p className="text-sm font-bold text-steel">아직 클릭 이벤트가 없습니다.</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <h2 className="text-lg font-black">운영 상태</h2>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-mist p-3">
              <p className="font-bold text-steel">게시 적합</p>
              <p className="mt-1 text-xl font-black">{metrics.qualityBuckets.ready}</p>
            </div>
            <div className="rounded-lg bg-mist p-3">
              <p className="font-bold text-steel">수동 확인</p>
              <p className="mt-1 text-xl font-black">{metrics.qualityBuckets.manual_check}</p>
            </div>
            <div className="rounded-lg bg-mist p-3">
              <p className="font-bold text-steel">가격 관찰</p>
              <p className="mt-1 text-xl font-black">{metrics.qualityBuckets.watch_price}</p>
            </div>
            <div className="rounded-lg bg-mist p-3">
              <p className="font-bold text-steel">보류 우선</p>
              <p className="mt-1 text-xl font-black">{metrics.qualityBuckets.hold}</p>
            </div>
          </div>
          {metrics.latestRun ? (
            <p className="mt-4 text-sm font-semibold leading-6 text-steel">
              최근 수집: {formatDate(metrics.latestRun.started_at)} · {metrics.latestRun.status} · 발견 {metrics.latestRun.found_count} ·
              오류 {metrics.latestRun.error_count}
            </p>
          ) : (
            <p className="mt-4 text-sm font-semibold text-steel">아직 수집 실행 기록이 없습니다.</p>
          )}
        </div>

        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <h2 className="text-lg font-black">검토 우선순위</h2>
          <div className="mt-4 space-y-2">
            {metrics.priorityQueue.map((item) => (
              <div key={item.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-pine">{getCategoryLabel(item.category)}</p>
                    <p className="line-clamp-1 text-sm font-black">{item.title}</p>
                  </div>
                  <span className="rounded-md bg-mist px-2 py-1 text-xs font-black text-steel">
                    {item.quality_label} · 신뢰 {item.confidence}
                  </span>
                </div>
                {[...item.blockers, ...item.warnings].slice(0, 2).length ? (
                  <p className="mt-2 text-xs font-semibold text-steel">{[...item.blockers, ...item.warnings].slice(0, 2).join(" · ")}</p>
                ) : null}
              </div>
            ))}
            {!metrics.priorityQueue.length ? <p className="text-sm font-bold text-steel">검토할 후보가 없습니다.</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
