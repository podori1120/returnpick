"use client";

import { useState } from "react";
import { Copy, FileCheck2, Upload } from "lucide-react";

const BULK_FIELD_ORDER = "상품명\t카테고리\t쿠팡 상품 URL\t상품별 파트너스 링크\t브랜드\t모델명\t이미지 URL\t수집 당시 가격\t반품가\t새상품가\t네이버 최저가\t반품등급\t재고 수량\t공개 메모";

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

type BulkCandidateItem = {
  product_id: string | null;
  title?: string | null;
  status: string;
  reason?: string | null;
  existing_product_id?: string | null;
};

type BulkCandidateResult = {
  status: string;
  scanned_count: number;
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  score_error_count?: number;
  existing_count?: number;
  existing_skipped_count?: number;
  items?: BulkCandidateItem[];
  message?: string;
  error?: string;
};

function statusLabel(status: string) {
  if (status === "inserted") return "후보 추가";
  if (status === "updated") return "후보 갱신";
  if (status === "skipped") return "건너뜀";
  if (status === "error") return "오류";
  return status;
}

function reasonLabel(reason?: string | null) {
  if (!reason) return null;
  const labels: Record<string, string> = {
    EXISTING_COUPANG_PRODUCT_ID: "이미 등록된 쿠팡 상품번호입니다. 기존 후보는 자동으로 수정하지 않았습니다.",
    EXISTING_TITLE_CATEGORY: "같은 카테고리·상품명 후보가 이미 있습니다. 기존 후보는 자동으로 수정하지 않았습니다.",
    DUPLICATE_TITLE_CATEGORY: "입력 목록에서 같은 카테고리·상품명이 중복되었습니다.",
    TITLE_REQUIRED: "상품명이 짧습니다.",
    CATEGORY_REQUIRED: "카테고리를 확인하세요.",
    COUPANG_PRODUCT_URL_REQUIRED: "상품 상세 URL이 필요합니다.",
    COUPANG_PRODUCT_ID_REQUIRED: "상품번호를 읽을 수 없습니다.",
    INVALID_AFFILIATE_URL: "파트너스 링크 형식이 아닙니다.",
    APPROVAL_SAMPLE_LINK_NOT_ALLOWED: "승인용 샘플 링크는 사용할 수 없습니다.",
    INVALID_IMAGE_URL: "이미지 URL을 확인하세요.",
    TAB_FIELD_COUNT_INVALID: "탭 열 수가 3~14개가 아닙니다.",
    TITLE_MIN_LENGTH_REQUIRED: "상품명이 짧습니다.",
    INVALID_CATEGORY: "카테고리 값을 확인하세요.",
    COUPANG_PRODUCT_URL_AND_ID_REQUIRED: "상품번호를 읽을 수 있는 상세 URL이 필요합니다.",
    DUPLICATE_PRODUCT_ID: "같은 목록에서 상품번호가 중복되었습니다.",
    DUPLICATE_ROW: "입력 목록에서 상품번호가 중복되었습니다.",
    PRODUCT_SAVE_FAILED: "상품 저장에 실패했습니다.",
    INVALID_SOURCE_PRICE: "수집 당시 가격은 숫자로 입력하세요.",
    INVALID_RETURN_PRICE: "반품가는 숫자로 입력하세요.",
    INVALID_NEW_PRICE: "새상품가는 숫자로 입력하세요.",
    INVALID_NAVER_PRICE: "네이버 최저가는 숫자로 입력하세요.",
    INVALID_STOCK_COUNT: "재고는 0 이상의 숫자로 입력하세요.",
    INVALID_CONDITION_GRADE: "반품등급은 미개봉·최상·상·중·알수없음·확인필요 중 하나여야 합니다.",
    SOURCING_SCORE_SAVE_FAILED: "후보는 저장됐지만 점수 저장에 실패했습니다. 후보 검토 화면에서 점수 재계산을 실행하세요."
  };
  return labels[reason] ?? reason;
}

function resultClassName(status: string) {
  if (status === "inserted" || status === "updated") return "text-pine";
  if (status === "error") return "text-coral";
  return "text-steel";
}

export default function AdminManualProductBulkForm({ password, onCreated }: { password: string; onCreated: () => void }) {
  const [entries, setEntries] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BulkCandidateResult | null>(null);
  const [notice, setNotice] = useState<{ type: "info" | "success" | "error"; message: string } | null>(null);

  async function importCandidates() {
    if (!entries.trim()) {
      setNotice({ type: "error", message: "후보 입력 행을 붙여넣으세요." });
      return;
    }

    setRunning(true);
    setResult(null);
    setNotice({ type: "info", message: "실제 상품 URL과 파트너스 링크를 행별로 검증하고 있습니다." });
    try {
      const response = await fetch("/api/admin/products/import", {
        method: "POST",
        headers: headers(password),
        body: JSON.stringify({ entries })
      });
      const data = (await response.json().catch(() => ({}))) as BulkCandidateResult;
      if (!response.ok) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "후보 일괄 등록에 실패했습니다." });
        return;
      }
      setResult(data);
      const scoreWarning = data.score_error_count ? ` · 점수 재계산 필요 ${data.score_error_count}개` : "";
      const message = `확인 ${data.scanned_count}줄 · 추가 ${data.inserted_count}개 · 갱신 ${data.updated_count}개 · 건너뜀 ${data.skipped_count}개 · 오류 ${data.error_count}개${scoreWarning}`;
      setNotice({ type: data.status === "ok" ? "success" : data.status === "partial" ? "info" : "error", message });
      if (data.inserted_count || data.updated_count) onCreated();
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 후보 일괄 등록을 실행하지 못했습니다." });
    } finally {
      setRunning(false);
    }
  }

  async function copyFieldOrder() {
    try {
      await navigator.clipboard.writeText(BULK_FIELD_ORDER);
      setNotice({ type: "success", message: "열 순서를 복사했습니다. 스프레드시트 첫 행에 붙여넣은 뒤 실제 상품 행을 작성하세요." });
    } catch {
      setNotice({ type: "error", message: "브라우저에서 복사가 차단되었습니다. HTTPS 관리자 페이지에서 다시 시도하세요." });
    }
  }

  return (
    <section id="admin-manual-product-bulk" data-import-policy="append-only" className="scroll-mt-4 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-pine">후보 일괄 입력</p>
          <h2 className="mt-1 text-xl font-black">실제 상품 후보 여러 개 한 번에 추가</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-steel">
            한 줄에 상품명, 카테고리, 쿠팡 상품 상세 URL과 선택 정보를 탭으로 구분합니다. 새 후보는 검토 대기·비공개로 추가되고 기존 상품은 기존 상태를 유지합니다. 뒤쪽의 가격·등급·재고는 관리자가 확인한 값만 입력할 수 있습니다.
          </p>
        </div>
        <p className="mt-3 max-w-3xl rounded-md border border-lemon/40 bg-lemon/15 px-3 py-2 text-xs font-bold leading-5 text-ink">
          기존 쿠팡 상품번호 또는 같은 카테고리·상품명이 있으면 자동 갱신하지 않고 건너뜁니다. 기존 상품 수정은 후보 검토 화면에서 명시적으로 진행하세요.
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-black text-ink hover:bg-mist"
            onClick={() => void copyFieldOrder()}
            type="button"
          >
            <Copy size={14} aria-hidden /> 열 순서 복사
          </button>
          <FileCheck2 className="m-1 text-pine" size={24} aria-hidden />
        </div>
      </div>

      {notice ? (
        <p className={`mt-4 rounded-lg border px-3 py-2 text-sm font-bold ${notice.type === "success" ? "border-pine/30 bg-pine/10 text-pine" : notice.type === "error" ? "border-coral/30 bg-coral/10 text-coral" : "border-line bg-mist text-steel"}`} role="status" aria-live="polite">
          {notice.message}
        </p>
      ) : null}

      <textarea
        className="focus-ring mt-4 min-h-40 w-full rounded-lg border border-line bg-mist px-3 py-3 font-mono text-xs leading-6 text-ink"
        value={entries}
        onChange={(event) => setEntries(event.target.value)}
        placeholder={"LG 그램 16 16GB 512GB\tlaptop\thttps://www.coupang.com/vp/products/123456789\thttps://link.coupang.com/a/...\tLG\tGram 16\t이미지URL\t1290000\t899000\t1690000\t1420000\t최상\t2\t배터리 상태 확인\n27인치 QHD 모니터\tmonitor\thttps://www.coupang.com/vp/products/987654321\t\t브랜드\t모델명"}
        aria-label="수동 후보 일괄 입력"
      />
      <div className="mt-3 grid gap-2 rounded-lg border border-line bg-mist p-3 text-xs font-bold leading-5 text-steel sm:grid-cols-2">
        <p>스프레드시트에서 행을 복사해 붙여넣으면 탭 기준으로 읽습니다. 실제 쿠팡 상품 URL과 상품별 파트너스 링크를 한 행에 맞춰 주세요.</p>
        <p>승인용 샘플 링크·일반 쿠팡 URL·상품번호가 다른 링크는 저장 또는 게시 단계에서 차단됩니다. 확인되지 않은 반품 정보는 비워 두어도 됩니다.</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold leading-5 text-steel">열 순서: 상품명 · 카테고리 · 상품 URL · 파트너스 링크 · 브랜드 · 모델명 · 이미지 · 수집 당시 가격 · 반품가 · 새상품가 · 네이버 최저가 · 등급 · 재고 · 공개 메모. 뒤쪽 7개는 선택입니다. 최대 40줄입니다.</p>
        <button className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-4 py-2.5 text-sm font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60" disabled={running || !entries.trim()} onClick={() => void importCandidates()} type="button">
          <Upload size={16} aria-hidden /> {running ? "검증·추가 중" : "후보 일괄 추가"}
        </button>
      </div>

      {result ? (
        <div className="mt-4 rounded-lg border border-line bg-mist p-4 text-sm font-bold text-steel">
          {result.existing_skipped_count ? (
            <p className="mb-3 rounded-md border border-lemon/40 bg-lemon/15 px-3 py-2 text-xs font-black text-ink">
              기존 후보 {result.existing_skipped_count}건은 보호를 위해 자동 갱신하지 않았습니다. 후보 검토 화면에서 상품별로 확인하세요.
            </p>
          ) : null}
          <p className="font-black text-ink">일괄 등록 결과 · 새 후보는 검토 대기와 비공개 상태로 추가됩니다.</p>
          {result.items?.slice(0, 8).length ? (
            <ul className="mt-3 space-y-1 text-xs">
              {result.items.slice(0, 8).map((item, index) => (
                <li key={`${item.product_id}-${index}`}>
                  <span className={`font-black ${resultClassName(item.status)}`}>{statusLabel(item.status)}</span>: {item.title ?? item.product_id}
                  {reasonLabel(item.reason) ? <span className="text-coral"> · {reasonLabel(item.reason)}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
