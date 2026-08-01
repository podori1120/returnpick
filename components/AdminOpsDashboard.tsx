"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, BarChart3, CheckCircle2, Clock3, Link2Off, MousePointerClick, PackageSearch, RefreshCw, Send, TrendingUp } from "lucide-react";
import { openAdminCandidateQueue, scrollToAdminAnchor } from "@/lib/adminNavigation";
import { getCategoryLabel } from "@/lib/category";
import { formatDate } from "@/lib/format";

type Metrics = {
  total: number;
  published: number;
  publishedStatusCount: number;
  publicReady: number;
  hiddenPublishedWithoutAffiliate: number;
  hiddenPublishedWithQualityBlockers?: number;
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
  publicQualityBlocked?: number;
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
  channelMetrics: Array<{
    channel: string;
    impressions: number;
    detail_views: number;
    affiliate_clicks: number;
    telegram_clicks: number;
  }>;
  sourceMetrics: Array<{
    source: string;
    detail_views: number;
    affiliate_clicks: number;
    affiliate_ctr: number;
  }>;
  surfaceMetrics: Array<{
    context: string;
    impressions: number;
    detail_views: number;
    affiliate_clicks: number;
    telegram_clicks: number;
    detail_ctr: number;
    affiliate_ctr: number;
  }>;
  conversionOpportunities: Array<{
    product_id: string;
    title: string;
    category: string;
    score: number;
    detail_views: number;
    affiliate_clicks: number;
    affiliate_ctr: number;
    cta_ready: boolean;
  }>;
};

type MetricsResponse = {
  metrics?: Metrics;
  error?: string;
  message?: string;
};

type RevenueMetricsResponse = {
  metrics?: RevenueMetrics;
  error?: string;
  message?: string;
};

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

function noticeClassName(type: "info" | "error") {
  if (type === "error") return "border-coral/30 bg-coral/10 text-coral";
  return "border-line bg-mist text-steel";
}

function channelLabel(channel: string) {
  const labels: Record<string, string> = {
    web: "웹 기본",
    web_approval_sample: "직접 검수 추천 CTA",
    web_approval_sample_detail: "승인 샘플 상세 진입",
    web_editorial_pick: "추천 콘텐츠",
    telegram_editorial_pick: "텔레그램 추천 콘텐츠",
    web_editorial_card_picks: "검수 추천 모음 카드",
    telegram: "텔레그램 기본",
    web_detail_hero: "상세 상단 CTA",
    telegram_detail_hero: "텔레그램 상단 CTA",
    web_detail_decision: "30초 판단 CTA",
    telegram_detail_decision: "텔레그램 30초 판단 CTA",
    web_detail_price: "가격 비교 CTA",
    telegram_detail_price: "텔레그램 가격 비교 CTA",
    web_detail_sidebar: "데스크톱 사이드 CTA",
    telegram_detail_sidebar: "텔레그램 사이드 CTA",
    web_detail_mobile_sticky: "모바일 하단 CTA",
    telegram_detail_mobile_sticky: "텔레그램 모바일 하단 CTA"
  };
  return labels[channel] ?? channel.replace(/_/g, " ");
}

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    direct: "직접 방문",
    naver_blog: "네이버 블로그",
    telegram: "텔레그램"
  };
  return labels[source] ?? source.replace(/_/g, " ");
}

function surfaceLabel(context: string) {
  const labels: Record<string, string> = {
    approval_sample: "승인 샘플",
    editorial_pick: "편집 추천",
    editorial_home_card: "홈 추천 카드",
    editorial_deals_card: "딜 목록 추천 카드",
    editorial_picks_card: "검수 추천 모음 카드"
  };
  return labels[context] ?? context.replace(/_/g, " ");
}

export default function AdminOpsDashboard({ password, refreshToken }: { password: string; refreshToken: number }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "info" | "error"; message: string } | null>(null);

  async function loadMetrics() {
    setLoading(true);
    setNotice(null);
    try {
      const [metricsResponse, revenueResponse] = await Promise.all([
        fetch("/api/admin/metrics", { headers: headers(password) }),
        fetch("/api/admin/revenue-metrics", { headers: headers(password) })
      ]);
      const metricsData = (await metricsResponse.json().catch(() => ({}))) as MetricsResponse;
      const revenueData = (await revenueResponse.json().catch(() => ({}))) as RevenueMetricsResponse;

      if (!metricsResponse.ok || !metricsData.metrics) {
        setMetrics(null);
        setRevenueMetrics(null);
        setNotice({ type: "error", message: metricsData.message ?? metricsData.error ?? "운영 지표를 불러오지 못했습니다." });
        return;
      }

      setMetrics(metricsData.metrics);
      if (!revenueResponse.ok || !revenueData.metrics) {
        setRevenueMetrics(null);
        setNotice({ type: "error", message: revenueData.message ?? revenueData.error ?? "운영 기본 지표는 불러왔지만 수익 퍼널을 불러오지 못했습니다." });
        return;
      }

      setRevenueMetrics(revenueData.metrics);
    } catch {
      setMetrics(null);
      setRevenueMetrics(null);
      setNotice({ type: "error", message: "네트워크 문제로 운영 지표를 불러오지 못했습니다." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMetrics();
  }, [password, refreshToken]);

  if (!metrics) {
    return (
      <section id="admin-ops-dashboard" className="scroll-mt-4 rounded-lg border border-line bg-white p-5 shadow-soft">
        <p className="text-sm font-bold text-steel">{loading ? "운영 지표를 불러오는 중입니다." : "운영 지표를 불러오지 못했습니다."}</p>
        {notice ? (
          <p className={`mt-3 rounded-lg border px-3 py-2 text-sm font-bold ${noticeClassName(notice.type)}`} role="status" aria-live="polite">
            {notice.message}
          </p>
        ) : null}
        <button
          className="focus-ring mt-3 inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-black hover:bg-mist disabled:opacity-60"
          onClick={loadMetrics}
          disabled={loading}
          type="button"
        >
          <RefreshCw size={15} aria-hidden /> {loading ? "불러오는 중" : "다시 불러오기"}
        </button>
      </section>
    );
  }

  const publicReadyCount = metrics.publicReady ?? metrics.published;
  const hiddenPublishedCount = metrics.hiddenPublishedWithoutAffiliate ?? metrics.missingAffiliateUrl;
  const hiddenQualityCount = metrics.hiddenPublishedWithQualityBlockers ?? 0;
  const publishedStatusCount = metrics.publishedStatusCount ?? publicReadyCount + hiddenPublishedCount + hiddenQualityCount;

  const cards = [
    { label: "검토 대기", value: metrics.needsReview, icon: PackageSearch, tone: "text-pine" },
    { label: "공개 가능", value: publicReadyCount, icon: CheckCircle2, tone: "text-pine" },
    { label: "공개 보강 대기", value: hiddenPublishedCount + hiddenQualityCount, icon: Link2Off, tone: "text-coral" },
    { label: "평균 점수", value: `${metrics.averageScore}점`, icon: BarChart3, tone: "text-lemon" },
    { label: "수동 확인", value: metrics.unknownCondition + metrics.missingReturnPrice, icon: AlertTriangle, tone: "text-coral" },
    { label: "구매 클릭", value: revenueMetrics?.funnel.affiliate_clicks ?? 0, icon: MousePointerClick, tone: "text-pine" },
    { label: "변동 감지", value: metrics.changedRecently, icon: Clock3, tone: "text-steel" }
  ];
  const topCtaChannels = [...(revenueMetrics?.channelMetrics ?? [])]
    .filter((item) => item.affiliate_clicks > 0)
    .sort((a, b) => b.affiliate_clicks - a.affiliate_clicks || b.detail_views - a.detail_views)
    .slice(0, 4);
  const topTrafficSources = [...(revenueMetrics?.sourceMetrics ?? [])]
    .filter((item) => item.detail_views > 0 || item.affiliate_clicks > 0)
    .sort((a, b) => b.affiliate_clicks - a.affiliate_clicks || b.detail_views - a.detail_views)
    .slice(0, 5);
  const recoveryActions = [
    {
      key: "affiliate",
      count: hiddenPublishedCount,
      title: "상품별 파트너스 링크 보강",
      summary: "게시 상태지만 구매 버튼이 살아나지 못한 상품입니다. 링크를 채우면 공개 목록과 텔레그램 후보로 복귀할 수 있습니다.",
      buttonLabel: "링크 보강 큐 열기",
      icon: Link2Off,
      tone: "text-coral",
      onClick: () => scrollToAdminAnchor("admin-affiliate-links")
    },
    {
      key: "quality",
      count: hiddenQualityCount,
      title: "공개 품질 보강",
      summary: "링크는 있지만 판매 가격, 이미지, 목적지 확인 또는 가격 비교 같은 공개 품질 정보가 부족한 상품입니다. 반품가·등급 누락은 경고로 표시되며 고객공개 보강 필터로 바로 좁힙니다.",
      buttonLabel: "공개 보강 후보 열기",
      icon: AlertTriangle,
      tone: "text-lemon",
      onClick: () => openAdminCandidateQueue("public_repair")
    },
    {
      key: "review",
      count: metrics.needsReview,
      title: "검토 대기 후보 처리",
      summary: "점수와 품질 신호가 쌓인 후보를 검토해 공개 가능한 딜로 전환합니다. 필터를 초기화하고 검토 대기 큐부터 엽니다.",
      buttonLabel: "검토 대기 큐 열기",
      icon: PackageSearch,
      tone: "text-pine",
      onClick: () => openAdminCandidateQueue("review")
    },
    {
      key: "conversion",
      count: revenueMetrics?.conversionOpportunities.length ?? 0,
      title: "구매 클릭 전환 보강",
      summary: "상세 페이지까지 방문했지만 쿠팡 구매 클릭으로 이어지지 않은 상품입니다. 가격 근거와 CTA 문구를 먼저 점검합니다.",
      buttonLabel: "전환 후보 보기",
      icon: MousePointerClick,
      tone: "text-lemon",
      onClick: () => scrollToAdminAnchor("admin-revenue-opportunities")
    },
    {
      key: "telegram",
      count: publicReadyCount > 0 && (revenueMetrics?.totals.telegram_detail_click ?? 0) === 0 ? publicReadyCount : 0,
      title: "텔레그램 유입 시작",
      summary: "고객공개 가능한 상품은 있는데 텔레그램 상세 유입이 아직 없습니다. 발송 후보를 보내 초기 클릭 신호를 만듭니다.",
      buttonLabel: "텔레그램 발송 열기",
      icon: Send,
      tone: "text-pine",
      onClick: () => scrollToAdminAnchor("admin-telegram-distribution")
    }
  ].filter((action) => action.count > 0);
  const primaryRecoveryAction = recoveryActions[0] ?? null;

  return (
    <section id="admin-ops-dashboard" className="scroll-mt-4 space-y-4">
      {notice ? (
        <p className={`rounded-lg border px-3 py-2 text-sm font-bold ${noticeClassName(notice.type)}`} role="status" aria-live="polite">
          {notice.message}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-line bg-white p-4 shadow-soft">
            <card.icon className={card.tone} size={20} aria-hidden />
            <p className="mt-3 text-xs font-black text-steel">{card.label}</p>
            <p className="mt-1 text-2xl font-black">{card.value}</p>
          </div>
        ))}
      </div>
      <p className="rounded-lg border border-line bg-white px-4 py-3 text-sm font-bold text-steel shadow-soft" role="status" aria-live="polite">
        게시 상태 {publishedStatusCount.toLocaleString("ko-KR")}개 중 실제 사용자 화면에 보이는 공개 가능 상품은{" "}
        <span className="text-pine">{publicReadyCount.toLocaleString("ko-KR")}개</span>입니다. 상품별 쿠팡 파트너스 링크가 없거나 고객공개 품질 블로커가 있는{" "}
        <span className="text-coral">{(hiddenPublishedCount + hiddenQualityCount).toLocaleString("ko-KR")}개</span>는 보강 전까지 공개 목록과 텔레그램 발송에서 숨겨집니다.
      </p>

      <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-pine">Revenue Recovery</p>
            <h2 className="mt-1 text-lg font-black">수익 회복 플랜</h2>
          </div>
          <span className="rounded-md bg-mist px-2 py-1 text-xs font-black text-steel">
            {primaryRecoveryAction
              ? `우선순위: ${primaryRecoveryAction.title} ${primaryRecoveryAction.count.toLocaleString("ko-KR")}건`
              : "공개/발송 흐름 정상"}
          </span>
        </div>
        {recoveryActions.length ? (
          <div className="mt-4 space-y-3">
            {recoveryActions.slice(0, 3).map((action) => {
              const Icon = action.icon;
              return (
                <div key={action.key} className="grid gap-3 border-t border-line pt-3 first:border-t-0 first:pt-0 md:grid-cols-[auto_1fr_auto] md:items-center">
                  <Icon className={action.tone} size={20} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-black">
                      {action.title} <span className="text-pine">{action.count.toLocaleString("ko-KR")}건</span>
                    </p>
                    <p className="mt-1 text-xs font-bold leading-5 text-steel">{action.summary}</p>
                  </div>
                  <button
                    className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-black text-ink hover:bg-mist"
                    onClick={action.onClick}
                    type="button"
                  >
                    {action.buttonLabel}
                    <ArrowRight size={14} aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm font-bold leading-6 text-steel">
            지금은 숨겨진 게시 상품이나 검토 병목이 없습니다. 새 수집을 돌리거나 텔레그램 후보 발송으로 유입 신호를 이어가면 됩니다.
          </p>
        )}
      </div>

      {hiddenPublishedCount + hiddenQualityCount > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-coral/20 bg-coral/10 p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-coral">상품별 링크 보강</p>
                <p className="mt-1 text-2xl font-black text-coral">{hiddenPublishedCount.toLocaleString("ko-KR")}개</p>
                <p className="mt-2 text-xs font-bold leading-5 text-ink">
                  게시 상태지만 상품별 쿠팡 파트너스 링크가 없어 구매 CTA와 텔레그램 후보에서 제외됩니다.
                </p>
              </div>
              <Link2Off className="shrink-0 text-coral" size={22} aria-hidden />
            </div>
            <button
              className="focus-ring mt-3 rounded-lg bg-white px-3 py-2 text-xs font-black text-ink hover:bg-mist"
              onClick={() => scrollToAdminAnchor("admin-affiliate-links")}
              type="button"
            >
              링크 보강 큐로 이동
            </button>
          </div>

          <div className="rounded-lg border border-lemon/60 bg-lemon/20 p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-ink">품질 보강 대기</p>
                <p className="mt-1 text-2xl font-black text-ink">{hiddenQualityCount.toLocaleString("ko-KR")}개</p>
                <p className="mt-2 text-xs font-bold leading-5 text-ink">
                  링크는 있어도 판매 가격, 이미지, 목적지 확인 또는 가격 비교 같은 고객공개 정보가 부족해 공개에서 숨겨집니다. 반품가·등급 누락은 공개 경고로 표시됩니다.
                </p>
              </div>
              <AlertTriangle className="shrink-0 text-ink" size={22} aria-hidden />
            </div>
            <button
              className="focus-ring mt-3 rounded-lg bg-white px-3 py-2 text-xs font-black text-ink hover:bg-mist"
              onClick={() => openAdminCandidateQueue("public_repair")}
              type="button"
            >
              품질 보강 후보로 이동
            </button>
          </div>
        </div>
      ) : null}

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
              텔레그램 유입 {revenueMetrics.totals.telegram_detail_click} · CTA 준비 {revenueMetrics.ctaReady} · 링크 보강 대기 {hiddenPublishedCount}
            </p>
            <div className="mt-5 border-t border-line pt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black text-steel">유입 채널별 전환</p>
                <span className="text-[11px] font-black text-steel">상세 → 쿠팡</span>
              </div>
              <div className="mt-3 space-y-2">
                {topTrafficSources.map((item) => (
                  <div key={item.source} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 text-xs font-bold">
                    <span className="min-w-0 truncate">{sourceLabel(item.source)}</span>
                    <span className="shrink-0 text-steel">상세 {item.detail_views} · 클릭 {item.affiliate_clicks}</span>
                    <span className="w-12 shrink-0 text-right font-black text-pine">{item.affiliate_ctr}%</span>
                  </div>
                ))}
                {!topTrafficSources.length ? <p className="text-xs font-bold text-steel">아직 채널별 유입 데이터가 없습니다.</p> : null}
              </div>
            </div>
            <div className="mt-5 border-t border-line pt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black text-steel">CTA 위치별 클릭</p>
                <span className="text-[11px] font-black text-steel">상세 페이지</span>
              </div>
              <div className="mt-3 space-y-2">
                {topCtaChannels.map((item) => (
                  <div key={item.channel} className="flex items-center justify-between gap-3 text-xs font-bold">
                    <span className="min-w-0 truncate">{channelLabel(item.channel)}</span>
                    <span className="shrink-0 font-black text-pine">{item.affiliate_clicks}회</span>
                  </div>
                ))}
                {!topCtaChannels.length ? <p className="text-xs font-bold text-steel">아직 구매 CTA 클릭 위치 데이터가 없습니다.</p> : null}
              </div>
            </div>
            <div className="mt-5 border-t border-line pt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black text-steel">콘텐츠별 전환</p>
                <span className="text-[11px] font-black text-steel">편집형 CTA 포함</span>
              </div>
              <div className="mt-3 space-y-2">
                {revenueMetrics.surfaceMetrics.slice(0, 5).map((item) => (
                  <div key={item.context} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 text-xs font-bold">
                    <span className="min-w-0 truncate">{surfaceLabel(item.context)}</span>
                    <span className="shrink-0 text-steel">상세 {item.detail_views} · 클릭 {item.affiliate_clicks}</span>
                    <span className="w-12 shrink-0 text-right font-black text-pine">{item.affiliate_ctr}%</span>
                  </div>
                ))}
                {!revenueMetrics.surfaceMetrics.length ? <p className="text-xs font-bold text-steel">아직 콘텐츠별 전환 데이터가 없습니다.</p> : null}
              </div>
            </div>
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

      {revenueMetrics?.conversionOpportunities.length ? (
        <section id="admin-revenue-opportunities" className="scroll-mt-4 rounded-lg border border-lemon/60 bg-lemon/20 p-5 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black text-ink">Conversion Recovery</p>
              <h2 className="mt-1 text-lg font-black">상세 방문 후 멈춘 상품</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-ink">
                관심은 확인됐지만 구매 클릭이 없는 상품입니다. 상품별 가격 근거, 반품 확인 상태와 CTA를 점검해 전환을 회복하세요.
              </p>
            </div>
            <span className="rounded-md bg-white/70 px-2 py-1 text-xs font-black text-ink">우선 점검 {revenueMetrics.conversionOpportunities.length}건</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {revenueMetrics.conversionOpportunities.map((item) => (
              <article key={item.product_id} className="rounded-lg border border-lemon/60 bg-white p-4">
                <p className="text-xs font-black text-pine">{getCategoryLabel(item.category)}</p>
                <p className="mt-1 line-clamp-2 text-sm font-black leading-5">{item.title}</p>
                <p className="mt-3 text-xs font-bold leading-5 text-steel">
                  상세 {item.detail_views}회 · 구매 클릭 {item.affiliate_clicks}회 · 전환 {item.affiliate_ctr}%
                </p>
                <Link
                  className="focus-ring mt-3 inline-flex items-center gap-1 text-xs font-black text-pine hover:text-ink"
                  href={`/deals/${item.product_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  공개 상세 점검 <ArrowRight size={13} aria-hidden />
                </Link>
              </article>
            ))}
          </div>
        </section>
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
