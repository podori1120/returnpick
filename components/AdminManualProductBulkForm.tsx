"use client";

import { useState } from "react";
import { FileCheck2, Upload } from "lucide-react";

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
    TAB_FIELD_COUNT_INVALID: "탭 열 수가 3~7개가 아닙니다.",
    TITLE_MIN_LENGTH_REQUIRED: "상품명이 짧습니다.",
    INVALID_CATEGORY: "카테고리 값을 확인하세요.",
    COUPANG_PRODUCT_URL_AND_ID_REQUIRED: "상품번호를 읽을 수 있는 상세 URL이 필요합니다.",
    DUPLICATE_PRODUCT_ID: "같은 목록에서 상품번호가 중복되었습니다.",
    DUPLICATE_ROW: "입력 목록에서 상품번호가 중복되었습니다.",
    PRODUCT_SAVE_FAILED: "상품 저장에 실패했습니다."
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
      const message = `확인 ${data.scanned_count}줄 · 추가 ${data.inserted_count}개 · 갱신 ${data.updated_count}개 · 건너뜀 ${data.skipped_count}개 · 오류 ${data.error_count}개`;
      setNotice({ type: data.status === "ok" ? "success" : data.status === "partial" ? "info" : "error", message });
      if (data.inserted_count || data.updated_count) onCreated();
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 후보 일괄 등록을 실행하지 못했습니다." });
    } finally {
      setRunning(false);
    }
  }

  return (
    <section id="admin-manual-product-bulk" data-import-policy="append-only" className="scroll-mt-4 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-pine">후보 일괄 입력</p>
          <h2 className="mt-1 text-xl font-black">실제 상품 후보 여러 개 한 번에 추가</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-steel">
            한 줄에 상품명, 카테고리, 쿠팡 상품 상세 URL, 파트너스 링크를 탭으로 구분합니다. 새 후보는 검토 대기·비공개로 추가되고 기존 상품은 기존 상태를 유지하며, 가격·반품 정보는 자동으로 채우지 않습니다.
          </p>
        </div>
        <p className="mt-3 max-w-3xl rounded-md border border-lemon/40 bg-lemon/15 px-3 py-2 text-xs font-bold leading-5 text-ink">
          기존 쿠팡 상품번호 또는 같은 카테고리·상품명이 있으면 자동 갱신하지 않고 건너뜁니다. 기존 상품 수정은 후보 검토 화면에서 명시적으로 진행하세요.
        </p>
        <FileCheck2 className="text-pine" size={24} aria-hidden />
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
        placeholder={"LG 그램 16 16GB 512GB\tlaptop\thttps://www.coupang.com/vp/products/123456789\thttps://link.coupang.com/a/...\tLG\tGram 16\n27인치 QHD 모니터\tmonitor\thttps://www.coupang.com/vp/products/987654321\t\t브랜드\t모델명"}
        aria-label="수동 후보 일괄 입력"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold leading-5 text-steel">필수 순서: 상품명 · 카테고리 · 상품 상세 URL · 파트너스 링크(선택). 최대 40줄입니다.</p>
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
