"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, ExternalLink, Gauge, RefreshCw, Rocket, ShieldCheck } from "lucide-react";
import { scrollToAdminAnchor } from "@/lib/adminNavigation";

type ApiReadinessItem = {
  id: string;
  label: string;
  state: "ready" | "missing" | "partial" | "disabled";
  missingEnv: string[];
};

type ApiReadinessSummary = {
  mode: "pre_approval" | "api_ready" | "launch_ready";
  items: ApiReadinessItem[];
  apiKeysReady: boolean;
  runtimeReady: boolean;
  launchReady: boolean;
  blockingEnv: string[];
  optionalMissingItemIds: string[];
};

type ReadinessResponse = {
  readiness?: ApiReadinessSummary;
  error?: string;
  message?: string;
};

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

function statusCopy(readiness: ApiReadinessSummary | null) {
  if (!readiness) {
    return {
      label: "상태 확인 중",
      title: "운영 전환 상태를 불러오는 중입니다.",
      body: "잠시 뒤 승인 대기, 키 입력, 첫 가동 단계 중 어디에 있는지 보여드립니다.",
      tone: "border-line bg-white text-ink",
      icon: Gauge
    };
  }

  if (readiness.launchReady) {
    return {
      label: "첫 가동 가능",
      title: "API 키와 운영 필수 설정이 준비됐습니다.",
      body: "핵심 연결 테스트를 통과시킨 뒤 첫 후보 수집과 파트너스 링크 보강을 시작하세요. 네이버 가격 비교와 텔레그램은 연결된 기능만 동작합니다.",
      tone: "border-pine/30 bg-pine/5 text-pine",
      icon: CheckCircle2
    };
  }

  if (readiness.apiKeysReady) {
    return {
      label: "설정 보강",
      title: "API 키는 들어갔고 운영 필수 설정이 남았습니다.",
      body: "누락된 Vercel 환경변수를 채우고 재배포하면 실제 연결 테스트와 첫 가동으로 넘어갑니다.",
      tone: "border-lemon/40 bg-lemon/10 text-ink",
      icon: AlertTriangle
    };
  }

  return {
    label: "승인 대기",
    title: "승인 전에는 수동 파트너스 링크와 공개 심사용 페이지를 유지하세요.",
    body: "쿠팡 최종승인 후 API 키를 넣으면 자동 후보 수집과 딥링크 보강이 바로 이어집니다. 네이버 최저가와 텔레그램은 선택 연동입니다.",
    tone: "border-line bg-white text-ink",
    icon: ShieldCheck
  };
}

export default function AdminLaunchStatusBar({ password }: { password: string }) {
  const [readiness, setReadiness] = useState<ApiReadinessSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  async function loadReadiness() {
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/api-readiness", { headers: headers(password) });
      const data = (await response.json().catch(() => ({}))) as ReadinessResponse;
      if (!response.ok || !data.readiness) {
        setReadiness(null);
        setNotice(data.message ?? data.error ?? "운영 전환 상태를 불러오지 못했습니다.");
        return;
      }
      setReadiness(data.readiness);
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

  const copy = statusCopy(readiness);
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
            <p className="text-xs font-black uppercase tracking-wide text-pine">Launch Command Center · {copy.label}</p>
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
            onClick={() => scrollToAdminAnchor(readiness?.launchReady ? "admin-first-launch" : "admin-api-readiness")}
            type="button"
          >
            <Rocket size={14} aria-hidden /> {readiness?.launchReady ? "첫 가동" : "설정 보강"}
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
          <p className="font-black text-steel">쿠팡 API 키</p>
          <p className={readiness?.apiKeysReady ? "mt-1 text-base font-black text-pine" : "mt-1 text-base font-black text-coral"}>
            {readiness?.apiKeysReady ? "입력됨" : "승인 후 입력"}
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
    </section>
  );
}
