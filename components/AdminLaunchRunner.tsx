"use client";

import { useState } from "react";
import { Link2, ListChecks, PlayCircle, RadioTower, Rocket, SearchCheck, ShieldAlert } from "lucide-react";
import { scrollToAdminAnchor } from "@/lib/adminNavigation";

type LaunchStep = {
  id: string;
  label: string;
  status: "ok" | "skipped" | "error";
  message: string;
  detail?: unknown;
  blocking?: boolean;
};

type LaunchResult = {
  status: "not_ready" | "completed" | "completed_with_errors";
  steps: LaunchStep[];
  before_summary?: {
    total: number;
    needs_review: number;
    published: number;
    affiliate_ready: number;
    published_affiliate_ready: number;
    published_public_ready?: number;
    missing_affiliate: number;
    missing_naver_lowest_price: number;
  };
  summary?: {
    total: number;
    needs_review: number;
    published: number;
    affiliate_ready: number;
    published_affiliate_ready: number;
    published_public_ready?: number;
    missing_affiliate: number;
    missing_naver_lowest_price: number;
  };
  delta_summary?: {
    total_added: number;
    needs_review_delta: number;
    affiliate_ready_added: number;
    published_affiliate_ready_delta: number;
    missing_affiliate_reduced: number;
    naver_missing_reduced: number;
  };
  readiness?: {
    mode: string;
    blockingEnv: string[];
    blockingItemIds: string[];
    blockingItems?: Array<{
      id: string;
      label: string;
      message: string;
      next_action: string;
      missing_or_invalid_env?: string[];
    }>;
    failedConnectionChecks?: Array<{
      id: string;
      label: string;
      message: string;
      next_action: string;
    }>;
  };
};

type LaunchPresetId = "quick" | "standard" | "wide";

type LaunchNextAction = {
  title: string;
  description: string;
  tone: "ok" | "warning" | "error";
};

const launchPresets: Array<{
  id: LaunchPresetId;
  label: string;
  description: string;
  sourcingKeywordLimit: number;
  affiliateLimit: number;
  priceLimit: number;
  sourcingTimeBudgetMs: number;
}> = [
  {
    id: "standard",
    label: "표준 런칭",
    description: "키워드 6개, 제휴 링크 8개, 네이버 가격 5개를 먼저 채웁니다.",
    sourcingKeywordLimit: 6,
    affiliateLimit: 8,
    priceLimit: 5,
    sourcingTimeBudgetMs: 22000
  },
  {
    id: "wide",
    label: "넉넉한 런칭",
    description: "후보가 적을 때 키워드 10개와 링크 12개까지 넓게 돌립니다.",
    sourcingKeywordLimit: 10,
    affiliateLimit: 12,
    priceLimit: 8,
    sourcingTimeBudgetMs: 26000
  },
  {
    id: "quick",
    label: "빠른 점검",
    description: "API 연결이 막 넣어진 직후 작은 범위로 안전하게 확인합니다.",
    sourcingKeywordLimit: 2,
    affiliateLimit: 3,
    priceLimit: 2,
    sourcingTimeBudgetMs: 12000
  }
];

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

function statusClass(status: LaunchStep["status"]) {
  if (status === "ok") return "border-pine/30 bg-pine/5 text-pine";
  if (status === "error") return "border-coral/30 bg-coral/5 text-coral";
  return "border-line bg-mist text-steel";
}

function nextActionClass(tone: LaunchNextAction["tone"]) {
  if (tone === "ok") return "border-pine/30 bg-pine/5 text-pine";
  if (tone === "error") return "border-coral/30 bg-coral/5 text-coral";
  return "border-amber/40 bg-amber/10 text-ink";
}

function formatLaunchDetailValue(value: unknown) {
  if (value == null || value === "") return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    const text = JSON.stringify(value);
    return text.length > 260 ? `${text.slice(0, 260)}...` : text;
  } catch {
    return "표시할 수 없는 값";
  }
}

function recordFromUnknown(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function operatorNextActionFromLaunchDetail(detail: unknown) {
  const value = recordFromUnknown(detail)?.operator_next_action;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function launchDetailEntries(detail: unknown) {
  if (!detail || typeof detail !== "object") return [];
  if (Array.isArray(detail)) {
    return detail.slice(0, 6).map((value, index) => [`step_${index + 1}`, value] as const);
  }
  return Object.entries(detail as Record<string, unknown>)
    .filter(([key, value]) => value != null && value !== "" && key !== "operator_next_action")
    .slice(0, 10);
}

function getLaunchNextAction(result: LaunchResult): LaunchNextAction {
  const errorStepIds = new Set(result.steps.filter((step) => step.status === "error").map((step) => step.id));
  const skippedStepIds = new Set(result.steps.filter((step) => step.status === "skipped").map((step) => step.id));

  if (result.status === "completed") {
    return {
      title: "다음 조치: 자동 운영 센터를 확인하세요.",
      description: "첫 가동 확인 기록이 남았으니 예약 소싱과 텔레그램 다이제스트가 준비 상태인지 확인하고, 검토 대기 상품부터 승인하세요.",
      tone: "ok"
    };
  }

  if (errorStepIds.has("connection_checks")) {
    return {
      title: "다음 조치: 실제 연결 테스트 실패 카드를 먼저 고치세요.",
      description: "Supabase, 공개 사이트, Cron 중 실패한 핵심 카드의 메시지를 보고 Vercel 환경변수나 SQL 적용 상태를 수정한 뒤 다시 실행하세요. 쿠팡 API는 자동화 권한이 있는 경우에만 핵심 연결로 확인합니다.",
      tone: "error"
    };
  }

  if (errorStepIds.has("sourcing")) {
    return {
      title: "다음 조치: 키워드 조건과 API 검색 결과를 확인하세요.",
      description: "자동 후보 수집 섹션에서 같은 조건으로 목업 없이 실행해 공급원별 진단을 보고, 필요하면 키워드 가격 범위나 최소 할인율을 넓히세요.",
      tone: "error"
    };
  }

  if (errorStepIds.has("affiliate_backfill")) {
    return {
      title: "다음 조치: 상품별 쿠팡 파트너스 링크 보강 큐를 확인하세요.",
      description: "쿠팡 API 권한과 딥링크 변환 응답을 확인하고, 매칭이 어려운 상품은 관리자에서 상품별 파트너스 링크를 직접 입력하세요.",
      tone: "error"
    };
  }

  if (errorStepIds.has("naver_backfill")) {
    return {
      title: "다음 조치: 네이버 최저가 보강 결과를 확인하세요.",
      description: "네이버 API 키와 검색어 매칭 결과를 확인하고, 모델명이 긴 상품은 관리자에서 새상품가나 네이버 최저가를 수동 보완하세요.",
      tone: "error"
    };
  }

  if (errorStepIds.has("launch_data_signal")) {
    return {
      title: "다음 조치: 키워드 범위를 넓혀 첫 실데이터 신호를 만드세요.",
      description: "연결은 통과했지만 새 후보나 가격·링크 보강이 없었습니다. 넉넉한 런칭으로 다시 실행하거나 키워드/가격 조건을 완화하세요.",
      tone: "warning"
    };
  }

  if (errorStepIds.has("launch_confirmed")) {
    return {
      title: "다음 조치: 첫 가동 확인 기록을 다시 남기세요.",
      description: "후보 수집과 보강은 끝났지만 스케줄러를 열어 주는 확인 기록 저장이 실패했습니다. Supabase 실행 로그 쓰기 권한과 최신 SQL 적용 상태를 확인한 뒤 첫 가동 실행을 다시 누르세요.",
      tone: "error"
    };
  }

  if (skippedStepIds.has("preflight") || result.status === "not_ready") {
    const missing = result.readiness?.blockingEnv?.join(", ");
    return {
      title: "다음 조치: 준비도 패널에서 누락 환경변수를 채우세요.",
      description: missing ? `먼저 Vercel에 ${missing} 값을 넣고 재배포한 뒤 실제 연결 테스트를 다시 실행하세요.` : "승인 후 운영 즉시 가동 준비 패널에서 누락 항목과 실패한 연결 테스트를 확인하세요.",
      tone: "warning"
    };
  }

  return {
    title: "다음 조치: 오류 단계의 세부정보를 확인하세요.",
    description: "일부 단계가 끝나지 않았습니다. 아래 단계 카드의 실행 세부정보를 보고 해당 관리자 패널에서 다시 보강하세요.",
    tone: "warning"
  };
}

function scrollToCandidateReviewQueue() {
  scrollToAdminAnchor("admin-candidate-review");
}

function scrollToApiReadinessPanel() {
  scrollToAdminAnchor("admin-api-readiness");
}

function scrollToSchedulerControl() {
  scrollToAdminAnchor("admin-telegram-distribution");
}

function scrollToAffiliateLinkQueue() {
  scrollToAdminAnchor("admin-affiliate-links");
}

function scrollToPriceBackfill() {
  scrollToAdminAnchor("admin-price-backfill");
}

function scrollToSourcingRunner() {
  scrollToAdminAnchor("admin-sourcing-runner");
}

export default function AdminLaunchRunner({ password, onCompleted }: { password: string; onCompleted: () => void }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<LaunchResult | null>(null);
  const [notice, setNotice] = useState("");
  const [presetId, setPresetId] = useState<LaunchPresetId>("standard");
  const selectedPreset = launchPresets.find((preset) => preset.id === presetId) ?? launchPresets[0];

  async function runLaunch() {
    setRunning(true);
    setResult(null);
    setNotice("첫 가동 실행을 시작했습니다. 실제 API와 DB 상태를 확인하는 중입니다.");
    try {
      const response = await fetch("/api/admin/launch", {
        method: "POST",
        headers: headers(password),
        body: JSON.stringify({
          sourcingKeywordLimit: selectedPreset.sourcingKeywordLimit,
          affiliateLimit: selectedPreset.affiliateLimit,
          priceLimit: selectedPreset.priceLimit,
          sourcingTimeBudgetMs: selectedPreset.sourcingTimeBudgetMs
        })
      });
      const data = (await response.json().catch(() => ({}))) as LaunchResult & { message?: string; error?: string };
      if (!response.ok) {
        setNotice(data.message ?? data.error ?? "첫 가동 실행에 실패했습니다.");
        return;
      }
      setResult(data);
      setNotice(data.status === "completed" ? "첫 가동 실행이 완료되었습니다." : "첫 가동 실행 결과를 확인하세요.");
      onCompleted();
    } catch {
      setNotice("네트워크 문제로 첫 가동 실행을 시작하지 못했습니다. Vercel 배포 상태와 관리자 비밀번호를 확인하세요.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section id="admin-first-launch" className="scroll-mt-4 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-pine">Post Approval Launch</p>
          <h2 className="text-xl font-black">승인 후 첫 가동 실행</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-steel">
            Supabase·사이트·관리자·Cron 등 출시 필수 환경이 준비된 뒤 누릅니다. API 권한 전에는 수동으로 검수한 상품별 파트너스 링크 운영을 확인하고, API 권한이 열리면 목업 없이 작은 단위로 자동 후보 수집과 링크 보강을 실행합니다. 네이버 최저가는 API가 연결된 경우에만 보강합니다.
          </p>
          {notice ? <p className="mt-2 text-sm font-black text-pine" role="status">{notice}</p> : null}
        </div>
        <button
          className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-black text-white hover:bg-pine disabled:cursor-not-allowed disabled:opacity-60"
          onClick={runLaunch}
          disabled={running}
          type="button"
        >
          <Rocket size={16} aria-hidden /> {running ? "실행 중" : "첫 가동 실행"}
        </button>
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-3">
        {launchPresets.map((preset) => {
          const active = preset.id === presetId;
          return (
            <button
              key={preset.id}
              className={
                active
                  ? "focus-ring rounded-lg border border-pine bg-pine/10 p-4 text-left"
                  : "focus-ring rounded-lg border border-line bg-mist p-4 text-left hover:border-pine hover:bg-white"
              }
              onClick={() => setPresetId(preset.id)}
              disabled={running}
              type="button"
            >
              <span className={active ? "block text-sm font-black text-pine" : "block text-sm font-black text-ink"}>{preset.label}</span>
              <span className="mt-1 block text-xs font-bold leading-5 text-steel">{preset.description}</span>
              <span className="mt-3 block text-xs font-black text-steel">
                키워드 {preset.sourcingKeywordLimit}개 · 링크 {preset.affiliateLimit}개 · 가격 {preset.priceLimit}개
              </span>
            </button>
          );
        })}
      </div>

      {result ? (
        <div className="mt-4 space-y-3">
          {(() => {
            const nextAction = getLaunchNextAction(result);
            const reviewCount = result.summary?.needs_review ?? 0;
            const missingAffiliateCount = result.summary?.missing_affiliate ?? 0;
            const missingNaverPriceCount = result.summary?.missing_naver_lowest_price ?? 0;
            const affiliateStepStatus = result.steps.find((step) => step.id === "affiliate_backfill")?.status;
            const naverStepStatus = result.steps.find((step) => step.id === "naver_backfill")?.status;
            const shouldShowReviewCta = result.status === "completed" || reviewCount > 0;
            const shouldShowSchedulerCta = result.status === "completed";
            const shouldShowReadinessCta =
              result.status === "not_ready" || result.steps.some((step) => step.id === "connection_checks" && step.status === "error");
            const shouldShowAffiliateCta = affiliateStepStatus === "error" || affiliateStepStatus === "skipped" || missingAffiliateCount > 0;
            const shouldShowPriceCta = naverStepStatus === "error" || naverStepStatus === "skipped" || missingNaverPriceCount > 0;
            const shouldShowSourcingCta = result.steps.some((step) => ["sourcing", "launch_data_signal"].includes(step.id) && step.status === "error");
            return (
              <div className={`rounded-lg border p-4 text-sm font-bold ${nextActionClass(nextAction.tone)}`}>
                <p className="text-xs font-black uppercase tracking-wide opacity-80">Next Action</p>
                <p className="mt-1 font-black">{nextAction.title}</p>
                <p className="mt-1 leading-6">{nextAction.description}</p>
                {shouldShowReviewCta || shouldShowSchedulerCta || shouldShowReadinessCta || shouldShowAffiliateCta || shouldShowPriceCta || shouldShowSourcingCta ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {shouldShowSourcingCta ? (
                      <button
                        className="focus-ring inline-flex items-center gap-2 rounded-lg border border-current px-3 py-2 text-xs font-black hover:bg-white/60"
                        onClick={scrollToSourcingRunner}
                        type="button"
                      >
                        <PlayCircle size={15} aria-hidden /> 수집 진단 보기
                      </button>
                    ) : null}
                    {shouldShowAffiliateCta ? (
                      <button
                        className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-xs font-black text-white hover:bg-pine"
                        onClick={scrollToAffiliateLinkQueue}
                        type="button"
                      >
                        <Link2 size={15} aria-hidden /> 파트너스 링크 보강
                      </button>
                    ) : null}
                    {shouldShowPriceCta ? (
                      <button
                        className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-xs font-black text-white hover:bg-pine"
                        onClick={scrollToPriceBackfill}
                        type="button"
                      >
                        <SearchCheck size={15} aria-hidden /> 네이버 가격 보강
                      </button>
                    ) : null}
                    {shouldShowSchedulerCta ? (
                      <button
                        className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-3 py-2 text-xs font-black text-white hover:bg-ink"
                        onClick={scrollToSchedulerControl}
                        type="button"
                      >
                        <RadioTower size={15} aria-hidden /> 자동 운영 센터 보기
                      </button>
                    ) : null}
                    {shouldShowReviewCta ? (
                      <>
                        <button
                          className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-xs font-black text-white hover:bg-pine"
                          onClick={scrollToCandidateReviewQueue}
                          type="button"
                        >
                          <ListChecks size={15} aria-hidden /> 검토 대기 상품 보기
                        </button>
                        <span className="text-xs font-black opacity-80">
                          {reviewCount > 0 ? `${reviewCount.toLocaleString("ko-KR")}건 검토 대기` : "후보 검토 테이블로 이동"}
                        </span>
                      </>
                    ) : null}
                    {shouldShowAffiliateCta && missingAffiliateCount > 0 ? (
                      <span className="text-xs font-black opacity-80">링크 누락 {missingAffiliateCount.toLocaleString("ko-KR")}건</span>
                    ) : null}
                    {shouldShowPriceCta && missingNaverPriceCount > 0 ? (
                      <span className="text-xs font-black opacity-80">가격 누락 {missingNaverPriceCount.toLocaleString("ko-KR")}건</span>
                    ) : null}
                    {shouldShowReadinessCta ? (
                      <button
                        className="focus-ring inline-flex items-center gap-2 rounded-lg border border-current px-3 py-2 text-xs font-black hover:bg-white/60"
                        onClick={scrollToApiReadinessPanel}
                        type="button"
                      >
                        <ShieldAlert size={15} aria-hidden /> 준비도 패널로 이동
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })()}

          {result.status === "not_ready" ? (
            <div className="rounded-lg border border-coral/30 bg-coral/10 p-4 text-sm font-bold text-coral">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 shrink-0" size={16} aria-hidden />
                <div>
                  <p className="font-black">아직 첫 가동을 실행하지 않았습니다.</p>
                  <p className="mt-1">누락 환경변수: {result.readiness?.blockingEnv?.join(", ") || "준비도 패널을 확인하세요."}</p>
                </div>
              </div>
            </div>
          ) : null}

          {result.readiness?.blockingItems?.length ? (
            <div className="rounded-lg border border-amber/40 bg-amber/10 p-4">
              <p className="text-sm font-black text-ink">막힌 준비 항목과 바로 할 일</p>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {result.readiness.blockingItems.map((item) => (
                  <div key={item.id} className="rounded-lg bg-white p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-black text-ink">{item.label}</p>
                      {item.missing_or_invalid_env?.length ? (
                        <span className="rounded-md bg-mist px-2 py-1 text-[11px] font-black text-steel">
                          {item.missing_or_invalid_env.join(", ")}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs font-bold leading-5 text-steel">{item.message}</p>
                    <p className="mt-2 rounded-md bg-mist px-2 py-1.5 text-xs font-black leading-5 text-ink">{item.next_action}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {result.readiness?.failedConnectionChecks?.length ? (
            <div className="rounded-lg border border-coral/30 bg-coral/10 p-4">
              <p className="text-sm font-black text-coral">실패한 연결 테스트 조치</p>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {result.readiness.failedConnectionChecks.map((check) => (
                  <div key={check.id} className="rounded-lg bg-white p-3 text-sm">
                    <p className="font-black text-ink">{check.label}</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-steel">{check.message}</p>
                    <p className="mt-2 rounded-md bg-coral/10 px-2 py-1.5 text-xs font-black leading-5 text-coral">{check.next_action}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-2 lg:grid-cols-3">
            {result.steps.map((step) => {
              const detailEntries = launchDetailEntries(step.detail);
              const operatorNextAction = operatorNextActionFromLaunchDetail(step.detail);
              return (
                <div key={step.id} className={`rounded-lg border p-3 ${statusClass(step.status)}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black">{step.label}</p>
                      {step.blocking === false ? <span className="rounded-md bg-white/75 px-2 py-0.5 text-[11px] font-black">선택 기능</span> : null}
                    </div>
                    <span className="text-xs font-black uppercase">{step.status}</span>
                  </div>
                  <p className="mt-1 text-xs font-bold leading-5">{step.message}</p>
                  {operatorNextAction ? (
                    <div className="mt-3 rounded-lg bg-white/75 px-3 py-2 text-ink">
                      <p className="text-[11px] font-black uppercase tracking-wide text-pine">단계 다음 조치</p>
                      <p className="mt-1 text-xs font-bold leading-5">{operatorNextAction}</p>
                    </div>
                  ) : null}
                  {detailEntries.length ? (
                    <div className="mt-3 border-t border-current/15 pt-2">
                      <p className="text-[11px] font-black uppercase tracking-wide opacity-80">실행 세부정보</p>
                      <dl className="mt-2 space-y-1">
                        {detailEntries.map(([key, value]) => (
                          <div key={key} className="grid gap-1 rounded-md bg-white/65 px-2 py-1.5 text-[11px] sm:grid-cols-[120px_1fr]">
                            <dt className="break-all font-black opacity-80">{key}</dt>
                            <dd className="break-words font-mono font-bold">{formatLaunchDetailValue(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {result.delta_summary ? (
            <div className="rounded-lg border border-line bg-mist p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-pine">이번 실행 변화</p>
                  <p className="mt-1 text-xs font-bold text-steel">첫 가동 버튼을 누르기 전과 후의 차이입니다.</p>
                </div>
                <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-steel">Before → After</span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ["새 후보", result.delta_summary.total_added],
                  ["검토 대기 변화", result.delta_summary.needs_review_delta],
                  ["링크 준비 증가", result.delta_summary.affiliate_ready_added],
                  ["고객공개 증가", result.delta_summary.published_affiliate_ready_delta],
                  ["링크 누락 감소", result.delta_summary.missing_affiliate_reduced],
                  ["가격 누락 감소", result.delta_summary.naver_missing_reduced]
                ].map(([label, value]) => {
                  const numericValue = Number(value);
                  const positive = numericValue > 0;
                  const neutral = numericValue === 0;
                  return (
                    <div key={label} className="rounded-lg border border-line bg-white p-3">
                      <p className="text-xs font-black text-steel">{label}</p>
                      <p className={positive ? "mt-1 text-xl font-black text-pine" : neutral ? "mt-1 text-xl font-black text-steel" : "mt-1 text-xl font-black text-coral"}>
                        {numericValue > 0 ? "+" : ""}
                        {numericValue.toLocaleString("ko-KR")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {result.summary ? (
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ["전체", result.summary.total],
                ["검토 대기", result.summary.needs_review],
                ["게시", result.summary.published],
                ["링크 준비", result.summary.affiliate_ready],
                ["고객공개", result.summary.published_public_ready ?? result.summary.published_affiliate_ready],
                ["가격 보강", result.summary.missing_naver_lowest_price]
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-line bg-mist p-3">
                  <p className="text-xs font-black text-steel">{label}</p>
                  <p className="mt-1 text-xl font-black">{Number(value).toLocaleString("ko-KR")}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
