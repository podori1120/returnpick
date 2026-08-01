"use client";

import { useEffect, useState } from "react";
import { Play, RefreshCw, ToggleLeft } from "lucide-react";
import { scrollToAdminAnchor } from "@/lib/adminNavigation";
import { formatDate } from "@/lib/format";
import { diagnoseSourcingRun, type SourcingDiagnosis } from "@/lib/sourcingDiagnostics";
import type { SourcingRun } from "@/lib/types";

const firstRunTimeBudgetMs = 52000;

type ApiReadinessSummary = {
  mode: "pre_approval" | "manual_launch_ready" | "api_ready" | "launch_ready";
  apiKeysReady: boolean;
  runtimeReady: boolean;
  launchReady: boolean;
  items: Array<{ id: string; state: string }>;
};

type SourcingRunResponse = {
  run?: SourcingRun;
  diagnosis?: SourcingDiagnosis | null;
  defaults?: {
    useMockFallback?: boolean;
    requestedMockFallback?: boolean | null;
    mockFallbackBlockedReason?: string | null;
    apiKeysReady?: boolean;
  };
  source_mode?: "auto" | "public_web_only";
  error?: string;
  message?: string;
};

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

function numberFromRunLog(run: SourcingRun, key: string) {
  const value = run.log_json?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function diagnosisClassName(severity: string) {
  if (severity === "error") return "border-coral/30 bg-coral/10 text-coral";
  if (severity === "warning") return "border-lemon/70 bg-lemon/20 text-ink";
  if (severity === "info") return "border-line bg-mist text-steel";
  return "border-pine/30 bg-pine/10 text-pine";
}

type NoticeType = "info" | "success" | "warning" | "error";

function noticeTypeFromRun(run: SourcingRun, diagnosis: SourcingDiagnosis | null | undefined): NoticeType {
  if (run.status === "error" || diagnosis?.severity === "error") return "error";
  if (diagnosis?.severity === "warning" || run.error_count > 0 || run.status.includes("error")) return "warning";
  return "success";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    completed: "완료",
    completed_partial: "부분 완료",
    completed_with_errors: "오류 포함 완료",
    completed_partial_with_errors: "부분 완료, 오류 있음",
    error: "실패",
    running: "실행 중",
    ok: "정상",
    API_NOT_CONFIGURED: "API 미설정",
    DISABLED: "비활성",
    ROBOTS_DISALLOWED: "robots 차단",
    ROBOTS_UNAVAILABLE: "robots 확인불가",
    INVALID_TEMPLATE: "템플릿 오류",
    UNSUPPORTED_CONTENT_TYPE: "HTML 아님",
    CONTENT_TOO_LARGE: "페이지 과대",
    REDIRECT_BLOCKED: "리다이렉트 차단",
    CRAWL_DELAY_TOO_HIGH: "Crawl-delay 제외"
  };
  return labels[status] ?? status;
}

function runProviderSummary(run: SourcingRun) {
  const diagnosis = diagnoseSourcingRun(run);
  if (!diagnosis?.providerStats.length) return "-";

  return diagnosis.providerStats
    .slice(0, 3)
    .map((stat) => {
      const statuses = stat.statuses.slice(0, 2).map(statusLabel).join(", ");
      return `${stat.provider} ${stat.accepted}/${stat.fetched}${statuses ? ` (${statuses})` : ""}`;
    })
    .join(" · ");
}

function runIssueSummary(run: SourcingRun) {
  const diagnosis = diagnoseSourcingRun(run);
  const issues: string[] = [];

  if (run.error_message) issues.push(run.error_message.slice(0, 140));
  if (diagnosis?.signals.rejectedByPriceFilterCount) issues.push(`가격 필터 ${diagnosis.signals.rejectedByPriceFilterCount}개 제외`);
  if (diagnosis?.signals.robotsUnavailableCount) issues.push(`robots 확인불가 ${diagnosis.signals.robotsUnavailableCount}건`);
  if (diagnosis?.signals.robotsDisallowedCount) issues.push(`robots 차단 ${diagnosis.signals.robotsDisallowedCount}건`);
  if (diagnosis?.signals.invalidTemplateCount) issues.push(`공개 웹 템플릿 오류 ${diagnosis.signals.invalidTemplateCount}건`);
  if (diagnosis?.signals.redirectBlockedCount) issues.push(`리다이렉트 차단 ${diagnosis.signals.redirectBlockedCount}건`);
  if (diagnosis?.signals.crawlDelayTooHighCount) issues.push(`Crawl-delay 제외 ${diagnosis.signals.crawlDelayTooHighCount}건`);
  if (diagnosis?.signals.publicWebDiagnosticCount) {
    const statuses = diagnosis.signals.publicWebDiagnosticStatuses.slice(0, 2).join(", ");
    issues.push(`공개웹 진단 ${diagnosis.signals.publicWebDiagnosticCount}건${statuses ? ` (${statuses})` : ""}`);
  }
  if (diagnosis?.signals.providerErrorCount) {
    const providers = diagnosis.signals.providerIssueProviders.length ? `: ${diagnosis.signals.providerIssueProviders.join(", ")}` : "";
    issues.push(`공급원 오류 ${diagnosis.signals.providerErrorCount}건${providers}`);
  }
  if (diagnosis?.signals.stoppedByTimeBudget) issues.push("시간 예산 내 부분 완료");

  return issues.length ? issues.slice(0, 3).join(" · ") : (diagnosis?.title ?? "-");
}

function immediateDiagnosisMessage(run: SourcingRun, diagnosis: SourcingDiagnosis | null | undefined) {
  const nextOffset = numberFromRunLog(run, "next_keyword_offset");
  const base = `${statusLabel(run.status)} · ${run.keyword_count}개 키워드 처리 · ${run.found_count}개 발견, ${run.inserted_count}개 추가, ${run.updated_count}개 갱신${
    nextOffset != null ? ` · 다음 시작 ${nextOffset}` : ""
  }`;
  if (!diagnosis) return base;

  const providerIssue = diagnosis.signals.providerErrorCount
    ? ` · 공급원 오류 ${diagnosis.signals.providerErrorCount}건${
        diagnosis.signals.providerIssueProviders.length ? `(${diagnosis.signals.providerIssueProviders.join(", ")})` : ""
      }`
    : "";
  const action = diagnosis.actionItems[0] ? ` · 다음 조치: ${diagnosis.actionItems[0]}` : "";
  return `${base} · ${diagnosis.title}${providerIssue}${action}`;
}

function diagnosisQuickActions(diagnosis: SourcingDiagnosis) {
  const actions: Array<{ label: string; anchor: string; helper: string }> = [];

  if (diagnosis.signals.providerErrorCount > 0 || diagnosis.title.includes("공급원") || diagnosis.title.includes("실제 소스")) {
    actions.push({
      label: "API 준비도 확인",
      anchor: "admin-api-readiness",
      helper: "Supabase 핵심 연결과 선택 기능 테스트로 이동합니다. 쿠팡 API는 자동화 권한이 있을 때만 필수 연결로 확인합니다."
    });
  }

  if (diagnosis.signals.rejectedByPriceFilterCount > 0 || !diagnosis.providerStats.length || diagnosis.title.includes("가격 필터")) {
    actions.push({
      label: "키워드 조건 조정",
      anchor: "admin-keyword-manager",
      helper: "가격 범위와 최소 할인율을 완화할 키워드 관리로 이동합니다."
    });
  }

  if (
    diagnosis.signals.publicWebDiagnosticCount > 0 ||
    diagnosis.signals.robotsDisallowedCount > 0 ||
    diagnosis.signals.robotsUnavailableCount > 0 ||
    diagnosis.signals.invalidTemplateCount > 0 ||
    diagnosis.signals.redirectBlockedCount > 0 ||
    diagnosis.signals.crawlDelayTooHighCount > 0
  ) {
    actions.push({
      label: "공개웹 설정 확인",
      anchor: "admin-api-readiness",
      helper: "공개 웹 참고 수집 allowlist, 템플릿, robots.txt 점검 위치로 이동합니다."
    });
  }

  if (diagnosis.signals.stoppedByTimeBudget) {
    actions.push({
      label: "수집 이어서 실행",
      anchor: "admin-sourcing-runner",
      helper: "시간 예산 안에서 부분 완료된 수집을 이어서 실행합니다."
    });
  }

  return actions.filter((action, index, list) => list.findIndex((item) => item.anchor === action.anchor && item.label === action.label) === index).slice(0, 3);
}

export default function AdminSourcingRunner({ password, onCompleted }: { password: string; onCompleted: () => void }) {
  const [runs, setRuns] = useState<SourcingRun[]>([]);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<{ type: NoticeType; message: string } | null>(null);
  const [useMockFallback, setUseMockFallback] = useState(true);
  const [readiness, setReadiness] = useState<ApiReadinessSummary | null>(null);

  async function loadRuns() {
    try {
      const response = await fetch("/api/admin/sourcing/run", { headers: headers(password) });
      const data = (await response.json().catch(() => ({}))) as { runs?: SourcingRun[]; message?: string; error?: string };
      if (!response.ok) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "최근 수집 실행 기록을 불러오지 못했습니다." });
        return;
      }
      setRuns(data.runs ?? []);
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 최근 수집 실행 기록을 불러오지 못했습니다." });
    }
  }

  async function loadReadiness() {
    try {
      const response = await fetch("/api/admin/api-readiness", { headers: headers(password) });
      const data = await response.json().catch(() => ({}));
      const nextReadiness = data.readiness as ApiReadinessSummary | undefined;
      if (!response.ok || !nextReadiness) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "API 준비도 상태를 확인하지 못했습니다." });
        return;
      }
      setReadiness(nextReadiness);
      setUseMockFallback(!nextReadiness.apiKeysReady);
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 API 준비도 상태를 확인하지 못했습니다." });
    }
  }

  useEffect(() => {
    void loadRuns();
    void loadReadiness();
  }, [password]);

  async function runSourcing() {
    const publicWebOnly = Boolean(
      readiness &&
        !readiness.apiKeysReady &&
        readiness.runtimeReady &&
        readiness.items.some((item) => item.id === "public_web" && item.state === "ready")
    );
    if (readiness?.mode === "manual_launch_ready" && process.env.NODE_ENV === "production" && !publicWebOnly) {
      setNotice({
        type: "warning",
        message: "쿠팡 API 권한이 없어 자동 후보 수집은 대기 중입니다. 상품별 파트너스 링크는 수동 등록·검수 큐에서 처리하세요."
      });
      return;
    }
    setRunning(true);
    setNotice({
      type: "info",
      message: publicWebOnly
        ? "허용된 공개 웹 검색 템플릿에서 후보를 확인하고 있습니다. 반품 근거와 링크는 관리자 검수 후에만 공개됩니다."
        : useMockFallback
        ? "후보를 수집하고 있습니다. API가 없으면 목업 후보로 화면과 검토 흐름을 채웁니다."
        : "실제 연동 소스만 사용해 후보를 수집하고 있습니다."
    });
    try {
      const response = await fetch("/api/admin/sourcing/run", {
        method: "POST",
        headers: headers(password),
        body: JSON.stringify({
          useMockFallback: publicWebOnly ? false : useMockFallback,
          sourceMode: publicWebOnly ? "public_web_only" : "auto",
          timeBudgetMs: firstRunTimeBudgetMs
        })
      });
      const data = (await response.json().catch(() => ({}))) as SourcingRunResponse;
      if (!response.ok) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "후보 수집 실행에 실패했습니다." });
        return;
      }
      const run = data.run;
      const fallbackNotice = data.source_mode === "public_web_only"
        ? " · 공개 웹 전용 모드로 저장됨"
        : data.defaults?.mockFallbackBlockedReason
          ? " · API 키 감지로 목업 대체 요청은 자동 차단됨"
          : "";
      if (data.defaults?.mockFallbackBlockedReason || data.defaults?.apiKeysReady) {
        setUseMockFallback(false);
      }
      const diagnosis = run ? (data.diagnosis ?? diagnoseSourcingRun(run)) : null;
      setNotice({
        type: run ? noticeTypeFromRun(run, diagnosis) : "error",
        message: run
          ? `${immediateDiagnosisMessage(run, diagnosis)}${fallbackNotice}`
          : "실행 결과를 확인하지 못했습니다."
      });
      await loadRuns();
      onCompleted();
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 후보 수집을 실행하지 못했습니다." });
    } finally {
      setRunning(false);
    }
  }

  const latestDiagnosis = diagnoseSourcingRun(runs[0]);
  const mockFallbackLocked = Boolean(readiness?.apiKeysReady);
  const manualLaunchMode = readiness?.mode === "manual_launch_ready";
  const publicWebOnly = Boolean(
    readiness &&
      !readiness.apiKeysReady &&
      readiness.runtimeReady &&
      readiness.items.some((item) => item.id === "public_web" && item.state === "ready")
  );
  const automatedSourcingUnavailable = manualLaunchMode && process.env.NODE_ENV === "production" && !publicWebOnly;
  const latestDiagnosisQuickActions = latestDiagnosis ? diagnosisQuickActions(latestDiagnosis) : [];

  return (
    <section id="admin-sourcing-runner" className="scroll-mt-4 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">자동 후보 수집</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-steel">
            승인 전에는 목업 포함으로 화면과 검토 흐름을 확인하고, 운영에서는 상품별 제휴 링크를 검수합니다. API 권한이 열리면 목업 없이 실제 소스를 자동 수집합니다.
          </p>
          <p className="mt-1 text-xs font-bold text-steel">
            운영 함수 시간 제한을 피하기 위해 52초 안에 가능한 만큼 처리하고, 필요하면 다음 실행에서 이어갑니다.
          </p>
          <p className={`mt-1 text-xs font-black ${readiness?.apiKeysReady || manualLaunchMode ? "text-pine" : "text-steel"}`}>
            {readiness?.apiKeysReady
              ? "API 키 감지됨 · 목업 대체 기본 꺼짐"
              : publicWebOnly
                ? "공개 웹 후보 수집 가능 · 링크는 관리자 검수 후 보강"
              : manualLaunchMode
                ? "수동 링크 운영 가능 · API 자동 수집 대기"
                : "승인 대기 · 목업 대체 기본 켜짐"}
          </p>
          {manualLaunchMode && !publicWebOnly ? (
            <p className="mt-2 rounded-lg border border-lemon/70 bg-lemon/20 px-3 py-2 text-xs font-black text-ink">
              쿠팡 API 권한 전에는 이 버튼으로 자동 수집하지 않습니다. 관리자 수동 후보 등록에서 실제 상품별 링크를 넣어 검수·게시하세요.
            </p>
          ) : null}
          {publicWebOnly ? (
            <p className="mt-2 rounded-lg border border-pine/30 bg-pine/10 px-3 py-2 text-xs font-black text-pine">
              쿠팡 API 없이도 allowlist와 robots.txt를 통과한 공개 웹 후보를 수집합니다. 가격·반품등급·파트너스 링크는 확인 전 공개하지 않습니다.
            </p>
          ) : null}
          {readiness?.apiKeysReady && useMockFallback ? (
            <p className="mt-2 rounded-lg border border-coral/30 bg-coral/10 px-3 py-2 text-xs font-black text-coral">
              실데이터 검증 중입니다. 목업 대체를 켜면 테스트 상품이 섞일 수 있으니, 운영 첫 수집은 목업을 끈 상태로 실행하세요.
            </p>
          ) : null}
          {notice ? (
            <p
              className={
                notice.type === "error"
                  ? "mt-2 rounded-lg border border-coral/30 bg-coral/10 px-3 py-2 text-sm font-bold text-coral"
                  : notice.type === "success"
                    ? "mt-2 rounded-lg border border-pine/30 bg-pine/10 px-3 py-2 text-sm font-bold text-pine"
                    : notice.type === "warning"
                      ? "mt-2 rounded-lg border border-lemon/70 bg-lemon/20 px-3 py-2 text-sm font-bold text-ink"
                      : "mt-2 rounded-lg border border-line bg-mist px-3 py-2 text-sm font-bold text-steel"
              }
              role="status"
              aria-live="polite"
            >
              {notice.message}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <label
            className={`inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-black ${
              mockFallbackLocked ? "cursor-not-allowed bg-mist text-steel opacity-70" : "hover:bg-mist"
            }`}
            title={mockFallbackLocked ? "API 키가 감지되어 목업 대체 없이 실제 소스로만 실행합니다." : undefined}
          >
            <input
              className="h-4 w-4 accent-pine"
              checked={mockFallbackLocked ? false : useMockFallback}
              disabled={mockFallbackLocked}
              onChange={(event) => setUseMockFallback(mockFallbackLocked ? false : event.target.checked)}
              type="checkbox"
            />
            <ToggleLeft size={16} aria-hidden /> 목업 대체 허용
          </label>
          <button className="focus-ring rounded-lg border border-line p-2 hover:bg-mist" onClick={loadRuns} type="button" title="새로고침">
            <RefreshCw size={18} aria-hidden />
          </button>
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-4 py-2 text-sm font-black text-white hover:bg-ink disabled:opacity-60"
            onClick={runSourcing}
            disabled={running || automatedSourcingUnavailable}
            type="button"
          >
            <Play size={16} aria-hidden /> {automatedSourcingUnavailable ? "API 권한 대기" : publicWebOnly ? "공개 웹 후보 수집" : "후보 수집 실행"}
          </button>
        </div>
      </div>

      {latestDiagnosis ? (
        <div className={`mt-4 rounded-lg border p-4 ${diagnosisClassName(latestDiagnosis.severity)}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black">{latestDiagnosis.title}</p>
              <p className="mt-1 text-xs font-bold leading-5">{latestDiagnosis.summary}</p>
            </div>
            <span className="rounded-md bg-white/70 px-2 py-1 text-xs font-black">
              수집 {latestDiagnosis.signals.acceptedCount} / 원천 {latestDiagnosis.signals.fetchedCount}
            </span>
          </div>
          {latestDiagnosis.providerStats.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {latestDiagnosis.signals.providerErrorCount ? (
                <span className="rounded-md bg-white/70 px-2 py-1 text-xs font-black">
                  공급원 오류 {latestDiagnosis.signals.providerErrorCount}건
                  {latestDiagnosis.signals.providerIssueProviders.length ? ` · ${latestDiagnosis.signals.providerIssueProviders.join(", ")}` : ""}
                </span>
              ) : null}
              {latestDiagnosis.providerStats.map((stat) => (
                <span key={stat.provider} className="rounded-md bg-white/70 px-2 py-1 text-xs font-black">
                  {stat.provider}: {stat.accepted}/{stat.fetched}
                  {stat.statuses.length ? ` · ${stat.statuses.map(statusLabel).join(", ")}` : ""}
                </span>
              ))}
            </div>
          ) : null}
          {latestDiagnosis.actionItems.length ? (
            <div className="mt-3 space-y-1">
              {latestDiagnosis.actionItems.map((item) => (
                <p key={item} className="text-xs font-bold leading-5">
                  {item}
                </p>
              ))}
            </div>
          ) : null}
          {latestDiagnosisQuickActions.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {latestDiagnosisQuickActions.map((action) => (
                <button
                  key={`${action.anchor}-${action.label}`}
                  className="focus-ring rounded-lg bg-white/80 px-3 py-2 text-xs font-black text-ink hover:bg-white"
                  onClick={() => scrollToAdminAnchor(action.anchor)}
                  title={action.helper}
                  type="button"
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 overflow-auto rounded-lg border border-line">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="bg-mist text-xs font-black text-steel">
            <tr>
              <th className="px-3 py-2">시작</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">키워드</th>
              <th className="px-3 py-2">발견</th>
              <th className="px-3 py-2">추가</th>
              <th className="px-3 py-2">갱신</th>
              <th className="px-3 py-2">오류</th>
              <th className="px-3 py-2">공급원</th>
              <th className="px-3 py-2">진단</th>
              <th className="px-3 py-2">다음</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const nextOffset = numberFromRunLog(run, "next_keyword_offset");
              const activeCount = numberFromRunLog(run, "active_keyword_count");
              return (
                <tr key={run.id} className="border-t border-line">
                  <td className="px-3 py-2">{formatDate(run.started_at)}</td>
                  <td className="px-3 py-2 font-bold">{statusLabel(run.status)}</td>
                  <td className="px-3 py-2">{run.keyword_count}</td>
                  <td className="px-3 py-2">{run.found_count}</td>
                  <td className="px-3 py-2">{run.inserted_count}</td>
                  <td className="px-3 py-2">{run.updated_count}</td>
                  <td className="px-3 py-2">{run.error_count}</td>
                  <td className="max-w-[260px] px-3 py-2 text-xs font-bold leading-5 text-steel">{runProviderSummary(run)}</td>
                  <td className="max-w-[300px] px-3 py-2 text-xs font-bold leading-5 text-steel">{runIssueSummary(run)}</td>
                  <td className="px-3 py-2">{nextOffset != null ? `${nextOffset}${activeCount ? ` / ${activeCount}` : ""}` : "-"}</td>
                </tr>
              );
            })}
            {!runs.length ? (
              <tr>
                <td className="px-3 py-5 text-center font-bold text-steel" colSpan={10}>
                  실행 기록이 없습니다
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
