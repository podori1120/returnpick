"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, ClipboardPlus, ExternalLink, Gauge, Link2, PackageCheck, RefreshCw, Rocket, Send, ShieldCheck } from "lucide-react";
import { getAdminLaunchPath, isAdminStorageStatus, type AdminStorageStatus } from "@/lib/adminLaunchPath";
import { scrollToAdminAnchor } from "@/lib/adminNavigation";

type ApiReadinessItem = {
  id: string;
  label: string;
  state: "ready" | "missing" | "partial" | "disabled";
  missingEnv: string[];
};

type ApiReadinessSummary = {
  mode: "pre_approval" | "manual_launch_ready" | "api_ready" | "launch_ready";
  items: ApiReadinessItem[];
  apiKeysReady: boolean;
  runtimeReady: boolean;
  launchReady: boolean;
  catalogLaunchReady: boolean;
  blockingEnv: string[];
  optionalMissingItemIds: string[];
};

type ReadinessResponse = {
  readiness?: ApiReadinessSummary;
  storage?: {
    status: AdminStorageStatus;
    message: string;
    checkedAt: string;
  };
  error?: string;
  message?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isReadinessSummary(value: unknown): value is ApiReadinessSummary {
  if (!isRecord(value)) return false;
  const modes = new Set(["pre_approval", "manual_launch_ready", "api_ready", "launch_ready"]);
  const states = new Set(["ready", "missing", "partial", "disabled"]);
  const items = value.items;
  return (
    typeof value.mode === "string" &&
    modes.has(value.mode) &&
    Array.isArray(items) &&
    items.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.label === "string" &&
        typeof item.state === "string" &&
        states.has(item.state) &&
        isStringArray(item.missingEnv)
    ) &&
    typeof value.apiKeysReady === "boolean" &&
    typeof value.runtimeReady === "boolean" &&
    typeof value.launchReady === "boolean" &&
    typeof value.catalogLaunchReady === "boolean" &&
    isStringArray(value.blockingEnv) &&
    isStringArray(value.optionalMissingItemIds)
  );
}

function isStoragePayload(value: unknown): value is NonNullable<ReadinessResponse["storage"]> {
  return isRecord(value) && isAdminStorageStatus(value.status) && typeof value.message === "string" && typeof value.checkedAt === "string";
}

function isReadinessResponse(value: unknown): value is ReadinessResponse & { readiness: ApiReadinessSummary; storage: NonNullable<ReadinessResponse["storage"]> } {
  return isRecord(value) && isReadinessSummary(value.readiness) && isStoragePayload(value.storage);
}

function responseMessage(value: unknown, fallback: string) {
  if (!isRecord(value)) return fallback;
  if (typeof value.message === "string" && value.message.trim()) return value.message.slice(0, 300);
  if (typeof value.error === "string" && value.error.trim()) return value.error.slice(0, 300);
  return fallback;
}

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

function statusCopy(readiness: ApiReadinessSummary | null, storageStatus: AdminStorageStatus | null, storageMessage: string) {
  if (!readiness || !storageStatus) {
    return {
      label: "상태 확인 중",
      title: "운영 전환 상태를 불러오는 중입니다.",
      body: "잠시 뒤 승인 대기, 키 입력, 첫 가동 단계 중 어디에 있는지 보여드립니다.",
      tone: "border-line bg-white text-ink",
      icon: Gauge
    };
  }

  if (storageStatus === "unverified") {
    return {
      label: "저장소 확인 필요",
      title: "Supabase 설정은 있으나 라이브 저장소 확인이 끝나지 않았습니다.",
      body: `${storageMessage} 정식 후보 저장·검수 동선은 라이브 확인 완료 후 사용하세요.`,
      tone: "border-coral/30 bg-coral/5 text-ink",
      icon: AlertTriangle
    };
  }

  if (readiness.mode === "manual_launch_ready") {
    return {
      label: "수동 출시 가능",
      title: "상품별 파트너스 링크를 검수해 바로 운영할 수 있습니다.",
      body: "쿠팡 API 권한은 자동 후보 수집 기능에만 필요합니다. 관리자에서 실제 상품별 링크를 확인한 후보를 승인·게시하고, API 권한이 열리면 자동 소싱을 추가하세요.",
      tone: "border-pine/30 bg-pine/5 text-pine",
      icon: CheckCircle2
    };
  }

  if (readiness.catalogLaunchReady && !readiness.launchReady && storageStatus === "unconfigured") {
    return {
      label: "제한 공개 가능",
      title: "검수된 임시 카탈로그를 제한적으로 공개할 수 있습니다.",
      body: "상품별 파트너스 링크와 공개 검수가 끝난 카탈로그만 공개합니다. 자동 수집·영구 클릭 집계·스케줄러는 Supabase 연결만으로 켜지지 않으며, Cron 보호값·핵심 연결 테스트·Production 첫 가동 확인까지 통과한 뒤 정식 운영으로 전환됩니다.",
      tone: "border-lemon/50 bg-lemon/15 text-ink",
      icon: CheckCircle2
    };
  }

  if (readiness.launchReady) {
    return {
      label: "첫 가동 가능",
      title: "API 자동 소싱과 운영 필수 설정이 준비됐습니다.",
      body: "핵심 연결 테스트를 통과시킨 뒤 첫 후보 수집과 파트너스 링크 보강을 시작하세요. 네이버 가격 비교와 텔레그램은 연결된 기능만 동작합니다.",
      tone: "border-pine/30 bg-pine/5 text-pine",
      icon: CheckCircle2
    };
  }

  if (readiness.apiKeysReady) {
    return {
      label: "설정 보강",
      title: "API 자동화 키는 들어갔고 운영 필수 설정이 남았습니다.",
      body: "누락된 Vercel 환경변수를 채우고 재배포하면 실제 연결 테스트와 첫 가동으로 넘어갑니다.",
      tone: "border-lemon/40 bg-lemon/10 text-ink",
      icon: AlertTriangle
    };
  }

  return {
    label: "승인 대기",
    title: "승인 전에는 수동 파트너스 링크와 공개 심사용 페이지를 유지하세요.",
    body: storageStatus === "verified"
      ? "수동 파트너스 링크로 승인용 페이지와 기본 운영을 유지할 수 있습니다. 쿠팡 API 권한이 열리면 자동 후보 수집과 딥링크 보강이 이어집니다. 네이버 최저가와 텔레그램은 선택 연동입니다."
      : "승인 전에는 승인용 페이지를 유지하세요. Supabase가 연결되기 전에는 아래 임시 카탈로그로 검수한 상품만 제한 공개할 수 있고, 연결 후 상품별 링크 저장·검수와 클릭 집계를 사용할 수 있습니다.",
    tone: "border-line bg-white text-ink",
    icon: ShieldCheck
  };
}

export default function AdminLaunchStatusBar({ password }: { password: string }) {
  const [readiness, setReadiness] = useState<ApiReadinessSummary | null>(null);
  const [storageStatus, setStorageStatus] = useState<AdminStorageStatus | null>(null);
  const [storageMessage, setStorageMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  async function loadReadiness() {
    setLoading(true);
    setNotice("");
    setReadiness(null);
    setStorageStatus(null);
    setStorageMessage("");
    try {
      const response = await fetch("/api/admin/api-readiness", { headers: headers(password) });
      const data = (await response.json().catch(() => ({}))) as unknown;
      if (!response.ok) {
        setReadiness(null);
        setNotice(responseMessage(data, "운영 전환 상태를 불러오지 못했습니다."));
        return;
      }
      if (!isReadinessResponse(data)) {
        setReadiness(null);
        setStorageStatus(null);
        setNotice("운영 전환 응답 형식을 확인하지 못했습니다. 준비도 점검에서 다시 확인하세요.");
        return;
      }
      setReadiness(data.readiness);
      setStorageStatus(data.storage.status);
      setStorageMessage(data.storage.message);
    } catch {
      setReadiness(null);
      setNotice("네트워크 문제로 운영 전환 상태를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReadiness();
  }, [password]);

  const readinessKnown = Boolean(readiness && storageStatus);
  const launchPath = getAdminLaunchPath({
    readinessKnown,
    launchReady: readiness?.launchReady ?? false,
    catalogLaunchReady: readiness?.catalogLaunchReady ?? false,
    storageStatus
  });
  const copy = statusCopy(readiness, storageStatus, storageMessage);
  const StatusIcon = copy.icon;
  const readyCount = useMemo(() => readiness?.items.filter((item) => item.state === "ready").length ?? 0, [readiness]);
  const totalCount = readiness?.items.length ?? 0;
  const missingEnv = readiness?.blockingEnv ?? [];

  return (
    <section className={`rounded-lg border p-4 shadow-soft ${copy.tone}`} aria-label="운영 전환 요약">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-pine">
            <StatusIcon size={20} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black text-pine">운영 전환 센터 · {copy.label}</p>
            <h2 className="mt-1 text-lg font-black text-ink">{copy.title}</h2>
            <p className="mt-1 max-w-4xl text-sm font-semibold leading-6 text-steel">{copy.body}</p>
            {notice ? (
              <p className="mt-2 rounded-lg border border-coral/30 bg-coral/10 px-3 py-2 text-xs font-black text-coral" role="status">
                {notice}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-black text-ink hover:bg-mist disabled:opacity-60"
            onClick={loadReadiness}
            disabled={loading}
            type="button"
            title="운영 전환 상태 새로고침"
          >
            <RefreshCw size={14} aria-hidden /> {loading ? "확인 중" : "새로고침"}
          </button>
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-xs font-black text-white hover:bg-pine"
            onClick={() => scrollToAdminAnchor("admin-api-readiness")}
            type="button"
          >
            <Gauge size={14} aria-hidden /> 준비도 점검
          </button>
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-3 py-2 text-xs font-black text-white hover:bg-ink"
            onClick={() => scrollToAdminAnchor(launchPath.anchor)}
            type="button"
          >
            <Rocket size={14} aria-hidden /> {launchPath.label}
          </button>
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-black text-ink hover:bg-mist"
            onClick={() => scrollToAdminAnchor("admin-ops-dashboard")}
            type="button"
          >
            <BarChart3 size={14} aria-hidden /> 운영 지표
          </button>
          <a
            className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-black text-ink hover:bg-mist"
            href="/products/approval-sample"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={14} aria-hidden /> 승인용 페이지
          </a>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-ink">
          <p className="font-black text-steel">준비 카드</p>
          <p className="mt-1 text-base font-black">{totalCount ? `${readyCount}/${totalCount}개 준비` : "확인 중"}</p>
        </div>
        <div className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-ink">
          <p className="font-black text-steel">쿠팡 API 자동화</p>
          <p className={readiness?.apiKeysReady || readiness?.mode === "manual_launch_ready" ? "mt-1 text-base font-black text-pine" : "mt-1 text-base font-black text-coral"}>
            {readiness?.apiKeysReady ? "준비됨" : readiness?.mode === "manual_launch_ready" ? "수동 링크 운영" : "API 권한 대기"}
          </p>
        </div>
        <div className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-ink">
          <p className="font-black text-steel">누락 환경변수</p>
          <p className={missingEnv.length ? "mt-1 break-words text-xs font-black text-coral" : "mt-1 text-base font-black text-pine"}>
            {missingEnv.length ? missingEnv.slice(0, 5).join(", ") + (missingEnv.length > 5 ? ` 외 ${missingEnv.length - 5}개` : "") : "없음"}
          </p>
        </div>
        <div className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-ink">
          <p className="font-black text-steel">선택 연동 대기</p>
          <p className="mt-1 text-base font-black text-ink">{readiness?.optionalMissingItemIds?.length ?? 0}개</p>
        </div>
      </div>

      <div className="mt-3 border-t border-line/70 pt-3" aria-label="빠른 출시 동선">
        <p className="text-xs font-black text-steel">
          {launchPath.mode === "persistent" ? "상품별 운영 동선" : launchPath.mode === "temporary" ? "Supabase 연결 전 임시 출시 동선" : launchPath.mode === "recovery" ? "Supabase 연결 확인 필요" : "라이브 저장소 상태 확인 중"}
        </p>
        {launchPath.mode === "persistent" ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-left text-xs font-black text-ink hover:border-pine hover:bg-mist"
              onClick={() => scrollToAdminAnchor("admin-affiliate-link-intake")}
              type="button"
            >
              <ClipboardPlus className="shrink-0 text-pine" size={16} aria-hidden />
              <span><span className="block text-[10px] font-bold text-steel">1단계</span>파트너스 링크로 후보 추가</span>
            </button>
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-left text-xs font-black text-ink hover:border-pine hover:bg-mist"
              onClick={() => scrollToAdminAnchor("admin-affiliate-links")}
              type="button"
            >
              <Link2 className="shrink-0 text-pine" size={16} aria-hidden />
              <span><span className="block text-[10px] font-bold text-steel">2단계</span>파트너스 링크 검수</span>
            </button>
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-left text-xs font-black text-ink hover:border-pine hover:bg-mist"
              onClick={() => scrollToAdminAnchor("admin-candidate-review")}
              type="button"
            >
              <PackageCheck className="shrink-0 text-pine" size={16} aria-hidden />
              <span><span className="block text-[10px] font-bold text-steel">3단계</span>승인·게시</span>
            </button>
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-left text-xs font-black text-ink hover:border-pine hover:bg-mist"
              onClick={() => scrollToAdminAnchor("admin-telegram-distribution")}
              type="button"
            >
              <Send className="shrink-0 text-pine" size={16} aria-hidden />
              <span><span className="block text-[10px] font-bold text-steel">4단계</span>텔레그램 발송</span>
            </button>
          </div>
        ) : launchPath.mode === "temporary" ? (
          <>
            <p className="mt-2 max-w-4xl text-xs font-semibold leading-5 text-steel">
              지금은 상품별 후보 저장·클릭 집계가 가능한 정식 운영 DB가 없습니다. 실제 파트너스 링크와 검수 정보를 아래 임시 카탈로그에 입력하면 승인 전 제한 공개를 확인할 수 있습니다.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <button
                className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-left text-xs font-black text-ink hover:border-pine hover:bg-mist"
                onClick={() => scrollToAdminAnchor("admin-bootstrap-catalog")}
                type="button"
              >
                <ClipboardPlus className="shrink-0 text-pine" size={16} aria-hidden />
                <span><span className="block text-[10px] font-bold text-steel">1단계</span>실제 상품 TSV 입력</span>
              </button>
              <button
                className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-left text-xs font-black text-ink hover:border-pine hover:bg-mist"
                onClick={() => scrollToAdminAnchor("admin-bootstrap-catalog")}
                type="button"
              >
                <Link2 className="shrink-0 text-pine" size={16} aria-hidden />
                <span><span className="block text-[10px] font-bold text-steel">2단계</span>카탈로그 값 복사</span>
              </button>
              <button
                className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-left text-xs font-black text-ink hover:border-pine hover:bg-mist"
                onClick={() => scrollToAdminAnchor("admin-api-readiness")}
                type="button"
              >
                <Gauge className="shrink-0 text-pine" size={16} aria-hidden />
                <span><span className="block text-[10px] font-bold text-steel">3단계</span>공개 준비도 점검</span>
              </button>
              <a
                className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-left text-xs font-black text-ink hover:border-pine hover:bg-mist"
                href="/deals"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="shrink-0 text-pine" size={16} aria-hidden />
                <span><span className="block text-[10px] font-bold text-steel">4단계</span>공개 딜 화면 확인</span>
              </a>
            </div>
          </>
        ) : launchPath.mode === "recovery" ? (
          <>
            <p className="mt-2 max-w-4xl text-xs font-semibold leading-5 text-steel">
              {storageMessage} 정식 후보 저장·검수 큐를 열기 전에 라이브 연결과 최신 schema.sql을 확인하세요. 이 상태에서는 공개·후보 저장 경로를 안내하지 않습니다.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <button
                className="focus-ring inline-flex items-center gap-2 rounded-lg border border-coral/30 bg-white px-3 py-2.5 text-left text-xs font-black text-ink hover:border-coral hover:bg-coral/5"
                onClick={() => scrollToAdminAnchor("admin-api-readiness")}
                type="button"
              >
                <Gauge className="shrink-0 text-coral" size={16} aria-hidden />
                <span><span className="block text-[10px] font-bold text-steel">1단계</span>저장소 연결 확인</span>
              </button>
              <button
                className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-left text-xs font-black text-ink hover:border-pine hover:bg-mist"
                onClick={loadReadiness}
                type="button"
              >
                <RefreshCw className="shrink-0 text-pine" size={16} aria-hidden />
                <span><span className="block text-[10px] font-bold text-steel">2단계</span>라이브 상태 새로고침</span>
              </button>
              <button
                className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-left text-xs font-black text-ink hover:border-pine hover:bg-mist"
                onClick={() => scrollToAdminAnchor("admin-api-readiness")}
                type="button"
              >
                <PackageCheck className="shrink-0 text-pine" size={16} aria-hidden />
                <span><span className="block text-[10px] font-bold text-steel">3단계</span>schema.sql 적용 안내</span>
              </button>
            </div>
          </>
        ) : (
          <p className="mt-2 max-w-4xl text-xs font-semibold leading-5 text-steel">라이브 저장소 확인 중입니다. 정식 운영 동선과 임시 카탈로그 경로는 확인 결과를 받은 뒤 표시합니다.</p>
        )}
      </div>
    </section>
  );
}
