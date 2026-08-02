"use client";

import { useState } from "react";
import { Copy, Database, PackageCheck, RefreshCw, ShieldCheck } from "lucide-react";

type ExportResult = {
  status: "ready" | "empty" | "too_large" | "error";
  env_name?: string;
  env_value?: string | null;
  byte_size?: number;
  max_bytes?: number;
  max_products?: number;
  eligible_count?: number;
  scanned_count?: number;
  skipped_count?: number;
  skipped_by_reason?: Record<string, number>;
  product_ids?: string[];
  error?: string;
  message?: string;
};

const BOOTSTRAP_CATALOG_ENV_LABEL = "RETURNPICK_BOOTSTRAP_CATALOG_JSON";

const reasonLabels: Record<string, string> = {
  synthetic_source: "목업·데모 소스",
  not_published: "게시 상태 아님",
  affiliate_link_missing: "상품별 파트너스 링크 없음",
  affiliate_identity_unverified: "파트너스 목적지 미확인",
  public_quality_blocked: "공개 품질 기준 미달",
  last_observed_at_required: "자동 수집 시각 없음",
  catalog_limit: "카탈로그 개수 제한",
  catalog_size_limit: "환경변수 용량 제한",
  catalog_provenance_required: "자동 관측 또는 수동 공개 검토 근거 없음",
  manual_catalog_review_stale: "수동 공개 검토 7일 경과"
};

function formatBytes(value = 0) {
  return `${(value / 1024).toFixed(1)}KB`;
}

export default function AdminBootstrapCatalogPanel() {
  const [result, setResult] = useState<ExportResult | null>(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function createCatalog() {
    setRunning(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/bootstrap-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = (await response.json().catch(() => ({}))) as ExportResult;
      setResult(data);
      if (!response.ok) setNotice(data.message ?? data.error ?? "출시 카탈로그를 만들지 못했습니다.");
    } catch {
      setResult(null);
      setNotice("네트워크 문제로 출시 카탈로그를 만들지 못했습니다.");
    } finally {
      setRunning(false);
    }
  }

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(successMessage);
    } catch {
      setNotice("브라우저에서 복사가 차단되었습니다. HTTPS 관리자 페이지에서 다시 시도하세요.");
    }
  }

  const skipped = Object.entries(result?.skipped_by_reason ?? {}).filter(([, count]) => count > 0);

  return (
    <section id="admin-bootstrap-catalog" className="scroll-mt-4 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-sm font-black text-pine">Preapproval Catalog</p>
          <h2 className="mt-1 text-xl font-black text-ink">승인 대기용 출시 카탈로그</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-steel">
            Supabase 연결 전에도 검수 완료 상품을 Vercel 재배포 뒤 그대로 공개하기 위한 임시 보존 수단입니다. 자동 관측 상품이나 게시 시점에 관리자가
            직접 확인한 수동 상품만 포함하며, 목업 상품, 승인용 샘플 링크, 상품번호 불일치, 공개 품질 미달 상품은 자동으로 제외합니다.
          </p>
          <p className="mt-2 text-xs font-bold text-steel">
            Vercel Production Key: <code className="break-all text-ink">{BOOTSTRAP_CATALOG_ENV_LABEL}</code>
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-steel">자동 관측 상품은 수집 시각을, 수동 상품은 관리자 공개 검토 시각을 보존합니다. 수동 검토는 7일이 지나면 다시 확인해야 합니다.</p>
        </div>
        <button
          className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-4 py-2.5 text-sm font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
          disabled={running}
          onClick={createCatalog}
          type="button"
        >
          <RefreshCw className={running ? "animate-spin" : ""} size={16} aria-hidden />
          {running ? "검증 중" : "출시 카탈로그 만들기"}
        </button>
      </div>

      {notice ? (
        <p className="mt-4 rounded-lg border border-line bg-mist px-3 py-2 text-sm font-bold text-steel" role="status" aria-live="polite">
          {notice}
        </p>
      ) : null}

      {result?.status === "ready" && result.env_name && result.env_value ? (
        <div className="mt-5 border-y border-line py-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-black text-steel">보존 상품</p>
              <p className="mt-1 text-2xl font-black text-ink">{result.eligible_count?.toLocaleString("ko-KR")}개</p>
            </div>
            <div>
              <p className="text-xs font-black text-steel">환경변수 크기</p>
              <p className="mt-1 text-2xl font-black text-ink">{formatBytes(result.byte_size)}</p>
            </div>
            <div>
              <p className="text-xs font-black text-steel">검증 결과</p>
              <p className="mt-1 inline-flex items-center gap-2 text-sm font-black text-pine">
                <ShieldCheck size={18} aria-hidden /> 공개 기준 통과
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-black text-ink hover:bg-mist"
              onClick={() => copyText(result.env_name!, "Vercel 환경변수 Key를 복사했습니다.")}
              type="button"
            >
              <Copy size={15} aria-hidden /> Key 복사
            </button>
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-sm font-black text-white hover:bg-pine"
              onClick={() => copyText(result.env_value!, "Vercel 환경변수 Value를 복사했습니다.")}
              type="button"
            >
              <Database size={15} aria-hidden /> Value 복사
            </button>
          </div>
          <p className="mt-3 break-all text-xs font-bold leading-5 text-steel">
            Key: <code>{result.env_name}</code> · Production 환경변수에 Value를 넣고 새 배포를 만든 뒤 공개 딜 수를 확인하세요.
          </p>
        </div>
      ) : null}

      {result?.status === "empty" ? (
        <div className="mt-5 flex flex-col gap-4 border-y border-line py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 font-black text-ink">
              <PackageCheck size={19} className="text-coral" aria-hidden /> 내보낼 실제 상품이 아직 없습니다
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-steel">
              목업이 아닌 후보에 정확한 쿠팡 상품 URL과 상품별 파트너스 링크를 넣고, 목적지 확인과 공개 품질 검수를 마친 뒤 다시 생성하세요.
            </p>
          </div>
          <a className="focus-ring shrink-0 rounded-lg border border-line px-3 py-2 text-sm font-black text-ink hover:bg-mist" href="#admin-affiliate-links">
            링크 보강 큐로 이동
          </a>
        </div>
      ) : null}

      {result?.status === "too_large" ? (
        <p className="mt-5 rounded-lg border border-coral/30 bg-coral/10 p-4 text-sm font-bold leading-6 text-coral">
          카탈로그가 {formatBytes(result.byte_size)}로 안전 제한 {formatBytes(result.max_bytes)}를 넘었습니다. 상위 상품 수를 줄이거나 공개 메모와 근거
          데이터를 간결하게 정리하세요.
        </p>
      ) : null}

      {skipped.length ? (
        <div className="mt-4">
          <p className="text-xs font-black text-steel">제외 사유</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {skipped.slice(0, 8).map(([reason, count]) => (
              <span className="rounded-md bg-mist px-2.5 py-1.5 text-xs font-black text-steel" key={reason}>
                {reasonLabels[reason] ?? reason} {count.toLocaleString("ko-KR")}개
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-xs font-semibold leading-5 text-steel">
        검증을 통과한 상품을 용량 한도 안에서 최대 40개까지 보존합니다. 이 카탈로그는 공개 상품 보존만 담당하며 클릭 집계, 관리자 수정, 자동 소싱 실행 기록을 영구 보존하려면 Supabase 운영 DB 연결이 여전히 필요합니다.
      </p>
    </section>
  );
}
