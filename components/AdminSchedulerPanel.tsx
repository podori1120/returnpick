"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, Clock3, Copy, Play, RadioTower, RefreshCw, Send, ShieldAlert } from "lucide-react";
import { scrollToAdminAnchor } from "@/lib/adminNavigation";
import { getCategoryLabel } from "@/lib/category";
import { formatDate, formatPercent } from "@/lib/format";

type SchedulerBlockingItem = {
  id: string;
  label: string;
  state: string;
  missing_env: string[];
  message: string;
  next_action: string;
};

type SchedulerOperatorAction = {
  code: string;
  label: string;
  target_anchor: string;
  message: string;
  next_action: string;
};

type SchedulerInsights = {
  sourcing: {
    health: "healthy" | "stale" | "error" | "never_run";
    mock_fallback_enabled: boolean;
    persistent_storage: boolean;
    launch_ready: boolean;
    scheduler_ready: boolean;
    first_launch_confirmed: boolean;
    automation_block_reason: string | null;
    launch_confirmation: {
      id: string;
      confirmed_at: string | null;
    } | null;
    readiness_mode: "pre_approval" | "api_ready" | "launch_ready";
    blocking_item_ids: string[];
    blocking_items: SchedulerBlockingItem[];
    operator_action: SchedulerOperatorAction | null;
    age_minutes: number | null;
    expected_interval_minutes: number;
    stale_after_minutes: number;
    latest_run: {
      id: string;
      status: string;
      started_at: string;
      finished_at: string | null;
      found_count: number;
      inserted_count: number;
      updated_count: number;
      error_count: number;
      keyword_start_offset: number | null;
      next_keyword_offset: number | null;
      active_keyword_count: number | null;
    } | null;
    recent_runs: Array<{
      id: string;
      status: string;
      started_at: string;
      found_count: number;
      inserted_count: number;
      updated_count: number;
      error_count: number;
      next_keyword_offset: number | null;
    }>;
  };
  telegram: {
    configured: boolean;
    sent_last_24h: number;
    unsent_candidate_count: number;
    candidates: Array<{
      id: string;
      title: string;
      category: string;
      score: number;
      discount_rate: number | null;
      stock_count: number | null;
    }>;
  };
  queues: {
    needs_review_count: number;
    missing_affiliate_count: number;
    quality_blocked_published_count: number;
    stale_published_count: number;
    action_queue: Array<{
      id: string;
      title: string;
      category: string;
      status: string;
      score: number;
      issues: string[];
      affiliate_ready: boolean;
      snapshot_age_minutes: number | null;
    }>;
  };
};

type SchedulerApiResponse = {
  insights?: SchedulerInsights;
  result?: Record<string, any>;
  error?: string;
  message?: string;
};

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

function healthLabel(health: SchedulerInsights["sourcing"]["health"]) {
  if (health === "healthy") return { label: "정상", className: "bg-pine/10 text-pine", icon: CheckCircle2 };
  if (health === "stale") return { label: "지연", className: "bg-coral/10 text-coral", icon: AlertTriangle };
  if (health === "error") return { label: "오류", className: "bg-coral/10 text-coral", icon: ShieldAlert };
  return { label: "기록 없음", className: "bg-mist text-steel", icon: Clock3 };
}

function formatAge(minutes: number | null) {
  if (minutes == null) return "기록 없음";
  if (minutes < 60) return `${minutes}분 전`;
  return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분 전`;
}

function noticeClassName(type: "info" | "success" | "error") {
  if (type === "error") return "border-coral/30 bg-coral/10 text-coral";
  if (type === "success") return "border-pine/30 bg-pine/10 text-pine";
  return "border-line bg-mist text-steel";
}

function blockingItemsFromRecord(result: Record<string, any> | null | undefined): SchedulerBlockingItem[] {
  const rawItems = result?.blocking_items;
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .map((item) => {
      const record = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, any>) : null;
      if (!record || typeof record.id !== "string") return null;
      return {
        id: record.id,
        label: typeof record.label === "string" ? record.label : record.id,
        state: typeof record.state === "string" ? record.state : "missing",
        missing_env: Array.isArray(record.missing_env) ? record.missing_env.filter((value): value is string => typeof value === "string") : [],
        message: typeof record.message === "string" ? record.message : "",
        next_action: typeof record.next_action === "string" ? record.next_action : ""
      } satisfies SchedulerBlockingItem;
    })
    .filter((item): item is SchedulerBlockingItem => Boolean(item));
}

function operatorActionFromRecord(result: Record<string, any> | null | undefined): SchedulerOperatorAction | null {
  const record = result?.operator_action;
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  return {
    code: typeof record.code === "string" ? record.code : "",
    label: typeof record.label === "string" ? record.label : "다음 조치",
    target_anchor: typeof record.target_anchor === "string" ? record.target_anchor : "",
    message: typeof record.message === "string" ? record.message : "",
    next_action: typeof record.next_action === "string" ? record.next_action : ""
  };
}

function scrollToAnchor(anchor: string) {
  scrollToAdminAnchor(anchor);
}

function operatorActionButtonLabel(action: SchedulerOperatorAction) {
  if (action.target_anchor === "admin-api-readiness") return "준비도 패널로 이동";
  if (action.target_anchor === "admin-first-launch") return "승인 후 첫 가동 실행으로 이동";
  return `${action.label}으로 이동`;
}

function notReadyMessage(result: Record<string, any>) {
  const operatorAction = operatorActionFromRecord(result);
  if (result.skipped_reason === "FIRST_LAUNCH_NOT_CONFIRMED") {
    return `승인 후 첫 가동 실행이 아직 완료되지 않아 자동 운영이 대기 중입니다. ${operatorAction?.next_action ?? ""}`.trim();
  }

  const blockingItems = blockingItemsFromRecord(result);
  const firstBlockingItem = blockingItems[0];
  if (firstBlockingItem) {
    return `운영 준비가 아직 완료되지 않아 자동 운영이 대기 중입니다. 먼저 ${firstBlockingItem.label}: ${firstBlockingItem.next_action || firstBlockingItem.message}`;
  }

  const blockers = Array.isArray(result.blocking_item_ids) && result.blocking_item_ids.length ? ` 차단 항목: ${result.blocking_item_ids.join(", ")}` : "";
  return `운영 준비가 아직 완료되지 않아 자동 운영이 대기 중입니다.${blockers}`;
}

function scheduledResultMessage(job: "sourcing" | "telegram_digest", result: Record<string, any>) {
  if (result.status === "not_ready") return notReadyMessage(result);

  if (job === "sourcing") {
    const status = result.status ? `${result.status} · ` : "";
    return `소싱 완료: ${status}${result.found_count ?? 0}개 발견, ${result.inserted_count ?? 0}개 추가, ${result.updated_count ?? 0}개 갱신, ${result.error_count ?? 0}개 오류`;
  }

  const skipped = result.skipped_reason ? ` · ${result.skipped_reason}` : "";
  const status = result.status ? `${result.status} · ` : "";
  return `텔레그램 처리 완료: ${status}후보 ${result.candidate_count ?? 0}개, 발송 ${result.sent_count ?? 0}건, 오류 ${result.error_count ?? 0}건${skipped}`;
}

function getSchedulerSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured?.startsWith("https://")) return configured.replace(/\/$/, "");

  if (typeof window !== "undefined" && window.location.origin.startsWith("https://")) {
    return window.location.origin.replace(/\/$/, "");
  }

  return "https://returnpick.vercel.app";
}

function githubSchedulerSetupText() {
  const siteUrl = getSchedulerSiteUrl();
  return [
    "ReturnPick GitHub Actions 1시간 스케줄러 설정",
    "",
    "1. GitHub 저장소 > Settings > Secrets and variables > Actions로 이동",
    "2. Repository secret 추가",
    "   Name: RETURNPICK_CRON_SECRET",
    "   Value: Vercel 환경변수 CRON_SECRET과 같은 값",
    "3. Repository variable 추가",
    "   Name: RETURNPICK_SITE_URL",
    `   Value: ${siteUrl}`,
    "4. Actions 탭에서 ReturnPick Hourly Scheduler를 수동 실행",
    "5. 실행 로그에서 아래 두 호출이 200 응답인지 확인",
    `   ${siteUrl}/api/cron/sourcing`,
    `   ${siteUrl}/api/cron/telegram-digest?limit=1`,
    "",
    "참고: 운영 준비 전에는 LAUNCH_NOT_READY 또는 FIRST_LAUNCH_NOT_CONFIRMED로 안전하게 대기합니다."
  ].join("\n");
}

export default function AdminSchedulerPanel({ password, refreshToken = 0, onCompleted }: { password: string; refreshToken?: number; onCompleted: () => void }) {
  const [insights, setInsights] = useState<SchedulerInsights | null>(null);
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [notice, setNotice] = useState<{ type: "info" | "success" | "error"; message: string } | null>(null);
  const [lastResult, setLastResult] = useState<Record<string, any> | null>(null);

  async function loadInsights() {
    setLoadingInsights(true);
    try {
      const response = await fetch("/api/admin/scheduler-health", { headers: headers(password) });
      const data = (await response.json().catch(() => ({}))) as SchedulerApiResponse;
      if (!response.ok || !data.insights) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "자동 운영 상태를 불러오지 못했습니다." });
        return;
      }
      setInsights(data.insights);
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 자동 운영 상태를 불러오지 못했습니다." });
    } finally {
      setLoadingInsights(false);
    }
  }

  useEffect(() => {
    void loadInsights();
  }, [password, refreshToken]);

  async function runJob(job: "sourcing" | "telegram_digest") {
    setRunningJob(job);
    setLastResult(null);
    setNotice({ type: "info", message: job === "sourcing" ? "스케줄 소싱을 실행 중입니다." : "텔레그램 다이제스트를 실행 중입니다." });
    try {
      const response = await fetch("/api/admin/scheduler/run", {
        method: "POST",
        headers: headers(password),
        body: JSON.stringify({ job, limit: 1 })
      });
      const data = (await response.json().catch(() => ({}))) as SchedulerApiResponse;
      if (!response.ok || !data.result) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "자동 운영 작업 실행에 실패했습니다." });
        return;
      }

      setLastResult(data.result);
      const hasErrors = Number(data.result.error_count ?? 0) > 0 || data.result.status === "error";
      const isWaiting = data.result.status === "not_ready";
      setNotice({
        type: hasErrors ? "error" : isWaiting ? "info" : "success",
        message: scheduledResultMessage(job, data.result)
      });
      await loadInsights();
      onCompleted();
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 자동 운영 작업을 실행하지 못했습니다." });
    } finally {
      setRunningJob(null);
    }
  }

  async function copyGithubSchedulerSetup() {
    try {
      await navigator.clipboard.writeText(githubSchedulerSetupText());
      setNotice({ type: "success", message: "GitHub Actions 1시간 스케줄러 설정값을 복사했습니다." });
    } catch {
      setNotice({ type: "error", message: "브라우저 권한 문제로 스케줄러 설정값을 복사하지 못했습니다." });
    }
  }

  if (!insights) {
    return (
      <section id="admin-telegram-distribution" className="scroll-mt-4 rounded-lg border border-line bg-white p-5 shadow-soft">
        <p className="text-sm font-bold text-steel">자동 운영 상태를 불러오는 중입니다.</p>
        {notice ? (
          <p className={`mt-3 rounded-lg border px-3 py-2 text-sm font-bold ${noticeClassName(notice.type)}`} role="status" aria-live="polite">
            {notice.message}
          </p>
        ) : null}
        <button
          className="focus-ring mt-3 inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-black hover:bg-mist disabled:opacity-60"
          onClick={loadInsights}
          disabled={loadingInsights}
          type="button"
        >
          <RefreshCw size={15} aria-hidden /> {loadingInsights ? "불러오는 중" : "다시 불러오기"}
        </button>
      </section>
    );
  }

  const health = healthLabel(insights.sourcing.health);
  const sourcingOperatorAction = insights.sourcing.operator_action;
  const lastResultBlockingItems = blockingItemsFromRecord(lastResult);
  const lastResultOperatorAction = operatorActionFromRecord(lastResult);

  return (
    <section id="admin-telegram-distribution" className="scroll-mt-4 space-y-4 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="text-pine" size={20} aria-hidden />
            <p className="text-xs font-black text-pine">Scheduler Control</p>
          </div>
          <h2 className="mt-1 text-xl font-black">자동 운영 센터</h2>
          <p className="mt-1 text-sm font-semibold text-steel">예약 소싱·텔레그램 후보 발송 상태를 한 번에 점검합니다.</p>
          <p className={`mt-2 text-xs font-black ${insights.sourcing.mock_fallback_enabled ? "text-coral" : "text-pine"}`}>
            Cron 소싱: {insights.sourcing.mock_fallback_enabled ? "목업 대체 허용 중" : "실제 소스만 사용"}
          </p>
          {!insights.sourcing.persistent_storage ? (
            <p className="mt-2 rounded-lg border border-coral/30 bg-coral/10 px-3 py-2 text-xs font-black text-coral">
              운영 DB가 아직 연결되지 않아 배포 환경의 실행 기록은 장기 저장되지 않습니다. Supabase 환경변수를 넣으면 Cron 기록과 다음 키워드 위치가 안정적으로 유지됩니다.
            </p>
          ) : null}
          {!insights.sourcing.launch_ready ? (
            <div className="mt-2 rounded-lg border border-lemon/40 bg-lemon/20 px-3 py-2 text-xs font-bold text-ink">
              <p className="font-black">첫 가동 준비 전이라 운영 스케줄러는 대기합니다.</p>
              {insights.sourcing.blocking_items.length ? (
                <div className="mt-2 space-y-2">
                  {insights.sourcing.blocking_items.slice(0, 4).map((item) => (
                    <div key={item.id} className="rounded-md bg-white/70 px-3 py-2">
                      <p className="font-black">{item.label}</p>
                      {item.missing_env.length ? <p className="mt-1 text-steel">누락 환경변수: {item.missing_env.join(", ")}</p> : null}
                      <p className="mt-1">{item.next_action || item.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1">차단 항목: {insights.sourcing.blocking_item_ids.join(", ") || "연결 테스트 필요"}</p>
              )}
              {sourcingOperatorAction ? (
                <button
                  className="focus-ring mt-2 rounded-md bg-ink px-3 py-2 text-xs font-black text-white hover:bg-pine"
                  onClick={() => scrollToAnchor(sourcingOperatorAction.target_anchor)}
                  type="button"
                >
                  {operatorActionButtonLabel(sourcingOperatorAction)}
                </button>
              ) : null}
            </div>
          ) : null}
          {insights.sourcing.launch_ready && !insights.sourcing.first_launch_confirmed ? (
            <div className="mt-2 rounded-lg border border-lemon/40 bg-lemon/20 px-3 py-2 text-xs font-bold text-ink">
              <p className="font-black">승인 후 첫 가동 실행이 아직 완료되지 않아 예약 소싱과 텔레그램 자동 발송을 대기합니다.</p>
              <p className="mt-1">{sourcingOperatorAction?.next_action ?? "승인 후 첫 가동 실행에서 실제 연결 테스트와 첫 데이터 보강을 먼저 완료하세요."}</p>
              {sourcingOperatorAction ? (
                <button
                  className="focus-ring mt-2 rounded-md bg-ink px-3 py-2 text-xs font-black text-white hover:bg-pine"
                  onClick={() => scrollToAnchor(sourcingOperatorAction.target_anchor)}
                  type="button"
                >
                  {operatorActionButtonLabel(sourcingOperatorAction)}
                </button>
              ) : null}
            </div>
          ) : null}
          {notice ? (
            <p className={`mt-2 rounded-lg border px-3 py-2 text-sm font-bold ${noticeClassName(notice.type)}`} role="status" aria-live="polite">
              {notice.message}
            </p>
          ) : null}
          <div className="mt-2 rounded-lg border border-line bg-mist px-3 py-2 text-xs font-bold text-steel">
            <p className="font-black text-ink">1시간 반복 운영 설정</p>
            <p className="mt-1">
              Vercel Hobby는 시간 단위 Cron 배포가 막힐 수 있습니다. GitHub Actions의 `ReturnPick Hourly Scheduler`가 같은 보호된 Cron API를 매시 정각 호출하도록 설정하세요.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-md bg-white px-2 py-1 font-black">Secret: RETURNPICK_CRON_SECRET</span>
              <span className="rounded-md bg-white px-2 py-1 font-black">Variable: RETURNPICK_SITE_URL</span>
            </div>
            <button
              className="focus-ring mt-2 inline-flex items-center gap-2 rounded-md bg-ink px-3 py-2 text-xs font-black text-white hover:bg-pine"
              onClick={copyGithubSchedulerSetup}
              type="button"
            >
              <Copy size={14} aria-hidden /> GitHub Actions 설정 복사
            </button>
          </div>
          {lastResult ? (
            <div className="mt-2 rounded-lg border border-line bg-mist px-3 py-2 text-xs font-bold text-steel">
              <p className="font-black text-ink">최근 수동 실행 응답</p>
              <p className="mt-1">
                상태 {String(lastResult.status ?? "processed")}
                {lastResult.skipped_reason ? ` · 대기 사유 ${lastResult.skipped_reason}` : ""}
                {Array.isArray(lastResult.blocking_item_ids) && lastResult.blocking_item_ids.length ? ` · 차단 ${lastResult.blocking_item_ids.join(", ")}` : ""}
              </p>
              {lastResultBlockingItems.length ? (
                <div className="mt-2 space-y-2">
                  {lastResultBlockingItems.slice(0, 3).map((item) => (
                    <div key={item.id} className="rounded-md bg-white px-3 py-2">
                      <p className="font-black text-ink">{item.label}</p>
                      {item.missing_env.length ? <p className="mt-1">누락 환경변수: {item.missing_env.join(", ")}</p> : null}
                      <p className="mt-1">{item.next_action || item.message}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {lastResultOperatorAction ? (
                <div className="mt-2 rounded-md bg-white px-3 py-2">
                  <p className="font-black text-ink">{lastResultOperatorAction.label}</p>
                  <p className="mt-1">{lastResultOperatorAction.next_action || lastResultOperatorAction.message}</p>
                  {lastResultOperatorAction.target_anchor ? (
                    <button className="focus-ring mt-2 rounded-md border border-line px-3 py-2 text-xs font-black hover:bg-mist" onClick={() => scrollToAnchor(lastResultOperatorAction.target_anchor)} type="button">
                      {operatorActionButtonLabel(lastResultOperatorAction)}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-black hover:bg-mist disabled:opacity-60"
            onClick={loadInsights}
            disabled={loadingInsights || Boolean(runningJob)}
            type="button"
            title="자동 운영 상태 새로고침"
          >
            <RefreshCw size={16} aria-hidden /> {loadingInsights ? "새로고침 중" : "새로고침"}
          </button>
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-black text-white hover:bg-pine disabled:cursor-not-allowed disabled:opacity-60"
            disabled={Boolean(runningJob) || !insights.sourcing.scheduler_ready}
            onClick={() => runJob("sourcing")}
            type="button"
            title={insights.sourcing.scheduler_ready ? "지금 소싱" : "첫 가동 완료 후 실행할 수 있습니다"}
          >
            <Play size={16} aria-hidden /> 지금 소싱
          </button>
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-black hover:bg-mist disabled:cursor-not-allowed disabled:opacity-60"
            disabled={Boolean(runningJob) || !insights.sourcing.scheduler_ready}
            onClick={() => runJob("telegram_digest")}
            type="button"
            title={insights.sourcing.scheduler_ready ? "텔레그램 후보 발송" : "첫 가동 완료 후 실행할 수 있습니다"}
          >
            <Send size={16} aria-hidden /> 텔레그램 후보 발송
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg bg-mist p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black text-steel">소싱 상태</p>
            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-black ${health.className}`}>
              <health.icon size={14} aria-hidden /> {health.label}
            </span>
          </div>
          <p className="mt-2 text-2xl font-black">{formatAge(insights.sourcing.age_minutes)}</p>
          <p className="mt-1 text-xs font-bold text-steel">목표 주기 {insights.sourcing.expected_interval_minutes}분</p>
        </div>
        <div className="rounded-lg bg-mist p-4">
          <p className="text-xs font-black text-steel">마지막 수집</p>
          <p className="mt-2 text-2xl font-black">{insights.sourcing.latest_run?.found_count ?? 0}개</p>
          <p className="mt-1 text-xs font-bold text-steel">
            추가 {insights.sourcing.latest_run?.inserted_count ?? 0} · 갱신 {insights.sourcing.latest_run?.updated_count ?? 0} · 오류 {insights.sourcing.latest_run?.error_count ?? 0}
          </p>
          <p className="mt-1 text-xs font-bold text-steel">
            다음 키워드 {insights.sourcing.latest_run?.next_keyword_offset ?? 0}
            {insights.sourcing.latest_run?.active_keyword_count ? ` / ${insights.sourcing.latest_run.active_keyword_count}` : ""}
          </p>
          <p className="mt-1 text-xs font-bold text-steel">{insights.sourcing.mock_fallback_enabled ? "승인 전/테스트 모드" : "운영 실데이터 모드"}</p>
        </div>
        <div className="rounded-lg bg-mist p-4">
          <p className="text-xs font-black text-steel">고객공개 발송 후보</p>
          <p className="mt-2 text-2xl font-black">{insights.telegram.unsent_candidate_count}개</p>
          <p className="mt-1 text-xs font-bold text-steel">24시간 발송 {insights.telegram.sent_last_24h}건 · {insights.telegram.configured ? "연동됨" : "토큰 필요"}</p>
        </div>
        <div className="rounded-lg bg-mist p-4">
          <p className="text-xs font-black text-steel">운영 큐</p>
          <p className="mt-2 text-2xl font-black">{insights.sourcing.scheduler_ready ? "준비됨" : "대기"}</p>
          <p className="mt-1 text-xs font-bold text-steel">
            첫 가동 {insights.sourcing.first_launch_confirmed ? "완료" : "미완료"} · 품질 보강 {insights.queues.quality_blocked_published_count ?? 0}건 · 처리 큐 {insights.queues.action_queue.length}건
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-lg border border-line p-4">
          <div className="flex items-center gap-2">
            <RadioTower className="text-pine" size={18} aria-hidden />
            <h3 className="font-black">지금 처리할 운영 큐</h3>
          </div>
          <div className="mt-3 space-y-2">
            {insights.queues.action_queue.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-lg bg-mist p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-pine">{getCategoryLabel(item.category)}</p>
                    <p className="line-clamp-1 text-sm font-black">{item.title}</p>
                  </div>
                  <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-steel">{item.score}점</span>
                </div>
                <p className="mt-2 text-xs font-bold text-steel">{item.issues.length ? item.issues.join(" · ") : "정기 재검수 대상"}</p>
              </div>
            ))}
            {!insights.queues.action_queue.length ? <p className="text-sm font-bold text-steel">현재 긴급 처리할 큐가 없습니다.</p> : null}
          </div>
        </div>

        <div className="rounded-lg border border-line p-4">
          <h3 className="font-black">텔레그램 발송 후보</h3>
          <div className="mt-3 space-y-2">
            {insights.telegram.candidates.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-lg bg-mist p-3">
                <p className="text-xs font-black text-pine">{getCategoryLabel(item.category)}</p>
                <p className="mt-1 line-clamp-1 text-sm font-black">{item.title}</p>
                <p className="mt-1 text-xs font-bold text-steel">
                  {item.score}점 · 할인 {formatPercent(item.discount_rate)} · 재고 {item.stock_count ?? "확인필요"}
                </p>
              </div>
            ))}
            {!insights.telegram.candidates.length ? <p className="text-sm font-bold text-steel">발송 대기 후보가 없습니다.</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
