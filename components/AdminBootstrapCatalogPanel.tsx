"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Database, PackageCheck, RefreshCw, ShieldCheck } from "lucide-react";
import { MANUAL_BOOTSTRAP_FIELD_ORDER, MANUAL_BOOTSTRAP_MAX_ROWS } from "@/lib/manualBootstrapCatalog";

type ExportResult = {
  status: "ready" | "empty" | "too_large" | "invalid" | "error";
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
  storage_mode?: "supabase" | "memory_fallback" | "manual_input";
  storage_message?: string;
  issues?: Array<{ index?: number; product_id?: string | null; code: string; message: string }>;
  error?: string;
  message?: string;
};

const BOOTSTRAP_CATALOG_ENV_LABEL = "RETURNPICK_BOOTSTRAP_CATALOG_JSON";
const MANUAL_FIELD_ORDER = MANUAL_BOOTSTRAP_FIELD_ORDER.join("\t");

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

function parseManualRows(value: string) {
  return value
    .split(/\r?\n/g)
    .map((line) => line.split("\t"))
    .filter((fields) => fields.some((field) => field.trim()))
    .filter((fields, index) => !(index === 0 && fields[0]?.trim() === "상품명" && fields[1]?.trim() === "카테고리"))
    .map((fields) => ({
      title: fields[0]?.trim() ?? "",
      category: fields[1]?.trim() ?? "",
      coupang_url: fields[2]?.trim() ?? "",
      affiliate_url: fields[3]?.trim() ?? "",
      brand: fields[4]?.trim() ?? "",
      model_name: fields[5]?.trim() ?? "",
      image_url: fields[6]?.trim() ?? "",
      source_price: fields[7]?.trim() ?? "",
      return_price: fields[8]?.trim() ?? "",
      new_price: fields[9]?.trim() ?? "",
      naver_lowest_price: fields[10]?.trim() ?? "",
      condition_grade: fields[11]?.trim() ?? "",
      stock_count: fields[12]?.trim() ?? "",
      public_note: fields[13]?.trim() ?? "",
      __field_count: fields.length
    }));
}

export default function AdminBootstrapCatalogPanel() {
  const [result, setResult] = useState<ExportResult | null>(null);
  const [running, setRunning] = useState(false);
  const [manualText, setManualText] = useState("");
  const [manualIdentityConfirmed, setManualIdentityConfirmed] = useState(false);
  const [manualRunning, setManualRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const manualRequestVersion = useRef(0);

  function invalidateManualResult() {
    manualRequestVersion.current += 1;
    setManualIdentityConfirmed(false);
    setResult(null);
    setNotice(null);
  }

  async function createCatalog() {
    if (running || manualRunning) return;
    setRunning(true);
    setNotice(null);
    setResult(null);
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

  async function createManualCatalog() {
    if (running || manualRunning) return;
    const parsedRows = parseManualRows(manualText);
    const invalidFieldCount = parsedRows.find((row) => row.__field_count !== MANUAL_BOOTSTRAP_FIELD_ORDER.length);
    const rows = parsedRows.map((parsedRow) => {
      const { __field_count, ...row } = parsedRow;
      void __field_count;
      return row;
    });
    if (!rows.length) {
      setNotice("실제 상품 TSV 행을 입력하세요.");
      return;
    }
    if (invalidFieldCount) {
      setNotice(`TSV 상품 행은 정확히 ${MANUAL_BOOTSTRAP_FIELD_ORDER.length}개 열이어야 합니다. 열 순서를 다시 확인하세요.`);
      return;
    }
    if (rows.length > MANUAL_BOOTSTRAP_MAX_ROWS) {
      setNotice(`한 번에 최대 ${MANUAL_BOOTSTRAP_MAX_ROWS}개까지 입력할 수 있습니다.`);
      return;
    }
    if (!manualIdentityConfirmed) {
      setNotice("각 파트너스 링크가 같은 쿠팡 상품으로 연결되는지 직접 확인했다는 체크가 필요합니다.");
      return;
    }

    const requestVersion = ++manualRequestVersion.current;
    setManualRunning(true);
    setNotice(null);
    setResult(null);
    try {
      const response = await fetch("/api/admin/bootstrap-catalog/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, manual_identity_confirmed: true })
      });
      const data = (await response.json().catch(() => ({}))) as ExportResult;
      if (requestVersion !== manualRequestVersion.current) return;
      if (!response.ok) {
        setResult(data);
        setNotice(data.message ?? data.error ?? "수동 임시 카탈로그를 만들지 못했습니다.");
      } else {
        setResult({ ...data, storage_mode: "manual_input", storage_message: data.storage_message ?? "임시 공개 스냅샷입니다." });
        setNotice("관리자 확인을 통과한 임시 공개 카탈로그를 만들었습니다. Key와 Value를 Vercel Production에 넣고 재배포하세요.");
      }
    } catch {
      setResult(null);
      setNotice("네트워크 문제로 수동 임시 카탈로그를 만들지 못했습니다.");
    } finally {
      setManualRunning(false);
    }
  }

  const skipped = Object.entries(result?.skipped_by_reason ?? {}).filter(([, count]) => count > 0);
  const manualRowCount = parseManualRows(manualText).length;

  return (
    <section id="admin-bootstrap-catalog" className="scroll-mt-4 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-sm font-black text-pine">승인 전 출시 카탈로그</p>
          <h2 className="mt-1 text-xl font-black text-ink">승인 대기용 출시 카탈로그</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-steel">
            Supabase 연결 전에도 검수 완료 상품을 Vercel 재배포 뒤 그대로 공개하기 위한 임시 보존 수단입니다. 자동 관측 상품이나 게시 시점에 관리자가
            직접 확인한 수동 상품만 포함하며, 목업 상품, 승인용 샘플 링크, 상품번호 불일치, 공개 품질 미달 상품은 자동으로 제외합니다.
          </p>
          <p className="mt-2 text-xs font-bold text-steel">
            Vercel Production Key: <code className="break-all text-ink">{BOOTSTRAP_CATALOG_ENV_LABEL}</code>
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-steel">자동 관측 상품은 수집 시각을, 수동 상품은 관리자 공개 검토 시각을 보존합니다. 수동 검토는 7일이 지나면 다시 확인해야 합니다.</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-steel">
            이 도구가 만든 JSON은 Vercel Production 환경변수에 넣고 재배포해야 유지됩니다. 후보 등록·수정·클릭 집계까지 계속 운영하려면 <a className="font-black text-pine underline" href="#admin-api-readiness">Supabase 운영 DB</a>가 필요합니다.
          </p>
        </div>
        <button
          className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-4 py-2.5 text-sm font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
          disabled={running || manualRunning}
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

      {result?.storage_mode ? (
        <div className={`mt-4 flex items-start gap-3 rounded-lg border p-3 text-sm ${result.storage_mode === "supabase" ? "border-pine/30 bg-pine/5 text-pine" : result.storage_mode === "manual_input" ? "border-lemon/50 bg-lemon/15 text-ink" : "border-lemon/50 bg-lemon/15 text-ink"}`} role="status">
          {result.storage_mode === "supabase" ? <Database className="mt-0.5 shrink-0" size={18} aria-hidden /> : <AlertTriangle className="mt-0.5 shrink-0" size={18} aria-hidden />}
          <div>
            <p className="font-black">{result.storage_mode === "supabase" ? "영속 저장소: Supabase" : result.storage_mode === "manual_input" ? "임시 공개 스냅샷: 수동 입력" : "임시 저장소: 메모리 fallback"}</p>
            <p className="mt-1 font-semibold leading-5">{result.storage_message}</p>
            {result.storage_mode === "memory_fallback" ? <a className="mt-1 inline-block font-black text-pine underline" href="#admin-api-readiness">Supabase 준비도 점검으로 이동</a> : null}
            {result.storage_mode === "manual_input" ? <a className="mt-1 inline-block font-black text-pine underline" href="#admin-api-readiness">영구 운영을 위한 Supabase 준비도 점검으로 이동</a> : null}
          </div>
        </div>
      ) : null}

      {result?.issues?.length ? (
        <div className="mt-4 rounded-lg border border-coral/30 bg-coral/10 p-4 text-sm text-coral" role="alert">
          <p className="font-black">입력한 상품 중 공개 기준을 통과하지 못한 항목이 {result.issues.length}건 있습니다.</p>
          <ul className="mt-2 space-y-1 text-xs font-bold leading-5">
            {result.issues.map((item, index) => (
              <li key={`${item.index ?? "all"}-${item.code}-${index}`}>
                {item.index && item.index > 0 ? `${item.index}번 · ` : ""}{item.message}
              </li>
            ))}
          </ul>
        </div>
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
              disabled={running || manualRunning}
              type="button"
            >
              <Copy size={15} aria-hidden /> Key 복사
            </button>
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-sm font-black text-white hover:bg-pine"
              onClick={() => copyText(result.env_value!, "Vercel 환경변수 Value를 복사했습니다.")}
              disabled={running || manualRunning}
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

      <div className="mt-6 border-t border-line pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <p className="text-sm font-black text-pine">Supabase 전 임시 입력</p>
            <h3 className="mt-1 text-lg font-black text-ink">실제 상품 TSV로 임시 공개 카탈로그 만들기</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-steel">
              쿠팡 파트너스 승인 직후 실제 상품을 직접 검수했다면, DB 없이도 공개 스냅샷을 만들 수 있습니다. 상품번호·파트너스 목적지·이미지·가격을 확인한 행만 통과하며 승인용 샘플 링크와 추정값은 거부합니다.
            </p>
          </div>
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-black text-ink hover:bg-mist"
            onClick={() => void copyText(MANUAL_FIELD_ORDER, "수동 임시 카탈로그 열 순서를 복사했습니다.")}
            type="button"
          >
            <Copy size={14} aria-hidden /> 열 순서 복사
          </button>
        </div>

        <textarea
          aria-label="수동 임시 카탈로그 상품 입력"
          className="focus-ring mt-4 min-h-40 w-full rounded-lg border border-line bg-mist px-3 py-3 font-mono text-xs leading-6 text-ink"
          onChange={(event) => {
            setManualText(event.target.value);
            invalidateManualResult();
          }}
          disabled={running || manualRunning}
          placeholder={`상품명\t카테고리\t쿠팡 상품 URL\t상품별 파트너스 링크\t브랜드\t모델명\t이미지 URL\t수집 당시 가격\t반품가\t새상품가\t네이버 최저가\t반품등급\t재고 수량\t공개 메모\nLG 그램 16 16GB 512GB\tlaptop\thttps://www.coupang.com/vp/products/123456789\thttps://link.coupang.com/a/실제코드\tLG\t그램 16\thttps://image10.coupangcdn.com/product.webp\t1290000\t899000\t1690000\t1420000\t최상\t2\t배터리 상태와 구성품을 확인하세요.`}
          value={manualText}
        />

        <div className="mt-3 grid gap-3 rounded-lg border border-line bg-mist p-3 text-xs font-bold leading-5 text-steel sm:grid-cols-2">
          <p>열 순서의 첫 행은 헤더로 붙여넣어도 자동으로 제외합니다. 각 상품 행은 정확히 {MANUAL_BOOTSTRAP_FIELD_ORDER.length}개 열이어야 하며, 최대 {MANUAL_BOOTSTRAP_MAX_ROWS}개까지 입력합니다.</p>
          <p>파트너스 링크 목적지가 같은 상품인지 브라우저에서 직접 확인한 뒤 체크해야 합니다. 이 단계는 외부 이동이나 자동 검증을 대신하지 않습니다.</p>
        </div>

        <label className="mt-4 flex items-start gap-3 rounded-lg border border-lemon/50 bg-lemon/15 p-3 text-sm font-bold leading-6 text-ink">
          <input
            checked={manualIdentityConfirmed}
            className="focus-ring mt-1 size-4 shrink-0 accent-pine"
            onChange={(event) => {
              setManualIdentityConfirmed(event.target.checked);
              setResult(null);
              setNotice(null);
            }}
            disabled={running || manualRunning}
            type="checkbox"
          />
          <span>입력한 각 상품의 쿠팡 상품 URL을 열어 상품번호를 확인했고, 상품별 파트너스 링크가 같은 상품으로 연결되는 것을 직접 확인했습니다.</span>
        </label>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold text-steel">입력 행 {manualRowCount}/{MANUAL_BOOTSTRAP_MAX_ROWS}개 · 생성 결과는 Vercel Production 환경변수에 넣고 재배포해야 유지됩니다.</p>
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-black text-white hover:bg-pine disabled:cursor-not-allowed disabled:opacity-60"
            disabled={manualRunning || running || !manualRowCount || manualRowCount > MANUAL_BOOTSTRAP_MAX_ROWS || !manualIdentityConfirmed}
            onClick={() => void createManualCatalog()}
            type="button"
          >
            {manualRunning ? <RefreshCw className="animate-spin" size={16} aria-hidden /> : <CheckCircle2 size={16} aria-hidden />}
            {manualRunning ? "검증 중" : "수동 공개 스냅샷 만들기"}
          </button>
        </div>
      </div>

      <p className="mt-4 text-xs font-semibold leading-5 text-steel">
        검증을 통과한 상품을 용량 한도 안에서 최대 40개까지 보존합니다. 이 카탈로그는 공개 상품 보존만 담당하며 클릭 집계, 관리자 수정, 자동 소싱 실행 기록을 영구 보존하려면 Supabase 운영 DB 연결이 여전히 필요합니다.
      </p>
    </section>
  );
}
