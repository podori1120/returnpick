"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Link2, ListPlus, LoaderCircle } from "lucide-react";
import { categoryOptions } from "@/lib/category";
import { isUsableAffiliateUrl, isUsableCoupangProductUrl } from "@/lib/coupangLink";
import type { Category } from "@/lib/types";

const emptyForm = { title: "", category: "laptop" as Category, affiliate_url: "", coupang_url: "", image_url: "", public_note: "", admin_memo: "" };
const BULK_BATCH_SIZE = 8;
const MAX_BULK_ROWS = 40;
const BULK_FIELD_ORDER = "상품명\t카테고리\t상품별 파트너스 링크\t쿠팡 상품 URL\t이미지 URL\t공개 메모\t관리자 메모";

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

type BulkIntakeRow = {
  title: string;
  category: string;
  affiliate_url: string;
  coupang_url: string;
  image_url: string;
  public_note: string;
  admin_memo: string;
};

type BulkIntakeResult = {
  status: string;
  scanned_count: number;
  inserted_count: number;
  error_count: number;
  score_error_count?: number;
  items?: Array<{
    index: number;
    status: string;
    product_id: string | null;
    error: string | null;
    message: string | null;
    operator_next_action?: string | null;
    score_error?: string | null;
  }>;
};

function parseBulkRows(value: string): BulkIntakeRow[] {
  return value
    .split(/\r?\n/g)
    .map((line) => line.split("\t"))
    .filter((fields) => fields.some((field) => field.trim()))
    .map((fields) => ({
      title: fields[0]?.trim() ?? "",
      category: fields[1]?.trim() ?? "",
      affiliate_url: fields[2]?.trim() ?? "",
      coupang_url: fields[3]?.trim() ?? "",
      image_url: fields[4]?.trim() ?? "",
      public_note: fields[5]?.trim() ?? "",
      admin_memo: fields[6]?.trim() ?? ""
    }));
}

export default function AdminAffiliateLinkIntake({ password, onCreated }: { password: string; onCreated: () => void }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "info" | "error"; message: string } | null>(null);
  const [nextAction, setNextAction] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ completed: number; total: number } | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkIntakeResult | null>(null);
  const affiliateReady = isUsableAffiliateUrl(form.affiliate_url.trim());
  const suppliedUrlReady = !form.coupang_url.trim() || isUsableCoupangProductUrl(form.coupang_url.trim());
  const bulkRows = parseBulkRows(bulkText);

  function update(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit() {
    setSaving(true);
    setNotice(null);
    setNextAction(null);
    try {
      const response = await fetch("/api/admin/products/link-intake", { method: "POST", headers: headers(password), body: JSON.stringify(form) });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        product?: { id?: string };
        operator_next_action?: string;
        score_error?: string | null;
      };
      setNextAction(data.operator_next_action ?? null);
      if (!response.ok) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "후보를 저장하지 않았습니다." });
        return;
      }
      setNotice({ type: data.score_error ? "info" : "success", message: data.message ?? `검수 대기 후보를 저장했습니다${data.product?.id ? `: ${data.product.id}` : ""}.` });
      setForm(emptyForm);
      onCreated();
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 후보를 저장하지 못했습니다." });
    } finally {
      setSaving(false);
    }
  }

  async function submitBulk() {
    if (!bulkRows.length || bulkRows.length > MAX_BULK_ROWS) return;
    setBulkSaving(true);
    setBulkProgress({ completed: 0, total: bulkRows.length });
    setBulkResult(null);
    setNotice(null);
    setNextAction(null);
    const aggregatedItems: NonNullable<BulkIntakeResult["items"]> = [];
    let scannedCount = 0;
    let insertedCount = 0;
    let errorCount = 0;
    let scoreErrorCount = 0;
    let completedRows = 0;
    let interruptedMessage: string | null = null;
    try {
      for (let start = 0; start < bulkRows.length; start += BULK_BATCH_SIZE) {
        const batch = bulkRows.slice(start, start + BULK_BATCH_SIZE);
        const response = await fetch("/api/admin/products/link-intake/bulk", {
          method: "POST",
          headers: headers(password),
          body: JSON.stringify({ items: batch })
        });
        const data = (await response.json().catch(() => ({}))) as BulkIntakeResult & { error?: string; message?: string };
        if (!response.ok) {
          interruptedMessage = data.message ?? data.error ?? "일괄 후보 등록에 실패했습니다.";
          break;
        }

        completedRows += batch.length;
        scannedCount += data.scanned_count ?? batch.length;
        insertedCount += data.inserted_count ?? 0;
        errorCount += data.error_count ?? 0;
        scoreErrorCount += data.score_error_count ?? 0;
        aggregatedItems.push(...(data.items ?? []).map((item) => ({ ...item, index: item.index + start })));
        setBulkProgress({ completed: completedRows, total: bulkRows.length });
      }

      const result: BulkIntakeResult = {
        status: interruptedMessage
          ? insertedCount > 0
            ? "partial"
            : "error"
          : errorCount > 0
            ? insertedCount > 0
              ? "partial"
              : "error"
            : scoreErrorCount > 0
              ? "partial"
              : "ok",
        scanned_count: scannedCount,
        inserted_count: insertedCount,
        error_count: errorCount,
        score_error_count: scoreErrorCount,
        items: aggregatedItems
      };
      setBulkResult(result);
      const scoreWarning = scoreErrorCount ? ` 점수 재계산 필요 ${scoreErrorCount}개.` : "";
      const interruptedNotice = interruptedMessage
        ? ` ${completedRows}개 처리 후 중단되었습니다: ${interruptedMessage}`
        : "";
      setNotice({
        type: result.status === "ok" ? "success" : result.status === "partial" ? "info" : "error",
        message: `총 ${result.scanned_count}개 중 ${result.inserted_count}개를 검수 대기 후보로 저장했습니다. 오류 ${result.error_count}개.${scoreWarning}${interruptedNotice}`
      });
      if (result.inserted_count) onCreated();
    } catch {
      setNotice({ type: "error", message: `네트워크 문제로 일괄 후보 등록을 완료하지 못했습니다. ${completedRows}개 처리 후 멈췄습니다.` });
    } finally {
      setBulkSaving(false);
      setBulkProgress(null);
    }
  }

  async function copyBulkFieldOrder() {
    try {
      await navigator.clipboard.writeText(BULK_FIELD_ORDER);
      setNotice({ type: "success", message: "대량 입력 열 순서를 복사했습니다. 스프레드시트 첫 행에 붙여넣고 상품별 링크를 입력하세요." });
    } catch {
      setNotice({ type: "error", message: "브라우저에서 복사가 차단되었습니다. HTTPS 관리자 페이지에서 다시 시도하세요." });
    }
  }

  return (
    <section id="admin-affiliate-link-intake" className="scroll-mt-4 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl"><p className="text-sm font-black text-pine">파트너스 링크 등록</p><h2 className="mt-1 text-xl font-black">파트너스 링크로 빠른 후보 등록</h2><p className="mt-2 text-sm font-semibold leading-6 text-steel">링크로 상품번호를 확인해 검수 대기 후보만 저장합니다. 가격·반품등급·재고는 추정하지 않으며 자동 게시하지 않습니다.</p></div>
        <Link2 className="text-pine" size={24} aria-hidden />
      </div>
      {notice ? <p className={`mt-4 rounded-lg border px-3 py-2 text-sm font-bold ${notice.type === "success" ? "border-pine/30 bg-pine/10 text-pine" : notice.type === "info" ? "border-lemon/50 bg-lemon/15 text-ink" : "border-coral/30 bg-coral/10 text-coral"}`} role="status">{notice.message}</p> : null}
      {nextAction ? <p className="mt-3 rounded-lg border border-lemon/40 bg-lemon/15 px-3 py-2 text-sm font-bold text-ink">다음 행동: {nextAction}</p> : null}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold text-steel sm:col-span-2">상품명<span className="text-coral">*</span><input className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" value={form.title} onChange={(event) => update("title", event.target.value)} /></label>
        <label className="text-sm font-bold text-steel">카테고리<span className="text-coral">*</span><select className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" value={form.category} onChange={(event) => update("category", event.target.value)}>{categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="text-sm font-bold text-steel">파트너스 링크<span className="text-coral">*</span><input aria-invalid={!affiliateReady && form.affiliate_url.length > 0} className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" value={form.affiliate_url} onChange={(event) => update("affiliate_url", event.target.value)} placeholder="https://link.coupang.com/a/..." type="url" /></label>
        <label className="text-sm font-bold text-steel sm:col-span-2">쿠팡 상품 URL (선택)<input aria-invalid={!suppliedUrlReady} className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" value={form.coupang_url} onChange={(event) => update("coupang_url", event.target.value)} placeholder="https://www.coupang.com/vp/products/..." type="url" /></label>
        <label className="text-sm font-bold text-steel sm:col-span-2">공개 이미지 URL (선택)<input className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" value={form.image_url} onChange={(event) => update("image_url", event.target.value)} type="url" /></label>
        <label className="text-sm font-bold text-steel">공개 메모 (선택)<textarea className="focus-ring mt-1 min-h-20 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" value={form.public_note} onChange={(event) => update("public_note", event.target.value)} /></label>
        <label className="text-sm font-bold text-steel">관리자 메모 (선택)<textarea className="focus-ring mt-1 min-h-20 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" value={form.admin_memo} onChange={(event) => update("admin_memo", event.target.value)} /></label>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><p className="text-xs font-semibold text-steel">목적지 상품번호가 확인되지 않으면 저장하지 않습니다. 제한 응답에서 관리자가 상품 URL을 입력한 경우에도 게시 불가 검수 후보로만 저장됩니다.</p><button className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-4 py-2.5 text-sm font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60" disabled={saving || form.title.trim().length < 5 || !affiliateReady || !suppliedUrlReady} onClick={() => void submit()} type="button">{saving ? <LoaderCircle className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}링크로 상품번호 확인 → 검수 대기 후보 저장</button></div>
      <div className="mt-6 border-t border-line pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-black text-pine"><ListPlus size={16} aria-hidden /> 여러 링크 한 번에 등록</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-steel">한 줄에 상품명, 카테고리, 파트너스 링크, 쿠팡 상품 URL을 탭으로 구분하세요. 최대 40개까지 붙여넣을 수 있고, 서버에는 8개씩 순차 전송해 같은 검증을 거쳐 저장합니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-xs font-black text-ink hover:bg-mist" onClick={() => void copyBulkFieldOrder()} type="button">
              <Copy size={14} aria-hidden /> 열 순서 복사
            </button>
            <span className="text-xs font-black text-steel">{bulkRows.length}/{MAX_BULK_ROWS}개</span>
          </div>
        </div>
        <textarea
          aria-label="파트너스 링크 여러 개 입력"
          className="focus-ring mt-3 min-h-28 w-full rounded-lg border border-line bg-mist px-3 py-3 font-mono text-xs leading-6 text-ink"
          onChange={(event) => setBulkText(event.target.value)}
          placeholder={'상품명\tlaptop\thttps://link.coupang.com/a/...\thttps://www.coupang.com/vp/products/...\n상품명\tmonitor\thttps://link.coupang.com/a/...\thttps://www.coupang.com/vp/products/...'}
          value={bulkText}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold leading-5 text-steel">이미지 URL, 공개 메모, 관리자 메모는 선택 입력입니다. 가격·반품등급·재고는 이 흐름에서 만들지 않습니다.</p>
          <button className="focus-ring inline-flex items-center gap-2 rounded-lg border border-pine bg-white px-4 py-2.5 text-sm font-black text-pine hover:bg-pine hover:text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={bulkSaving || saving || bulkRows.length < 1 || bulkRows.length > MAX_BULK_ROWS} onClick={() => void submitBulk()} type="button">
            {bulkSaving ? <LoaderCircle className="animate-spin" size={16} /> : <ListPlus size={16} aria-hidden />} {bulkSaving ? "검수 중" : "여러 후보 검수 대기 저장"}
          </button>
        </div>
        {bulkSaving && bulkProgress ? <p className="mt-3 rounded-lg border border-line bg-mist px-3 py-2 text-xs font-bold text-steel" role="status">검수 중 {bulkProgress.completed}/{bulkProgress.total}개 처리됨 · 서버 요청은 {BULK_BATCH_SIZE}개 단위로 순차 실행됩니다.</p> : null}
        {bulkResult?.items?.length ? (
          <ul className="mt-3 space-y-1 rounded-lg border border-line bg-mist p-3 text-xs font-bold text-steel">
            {bulkResult.items.map((item) => <li key={`${item.index}-${item.product_id ?? item.error ?? "result"}`}><span className={item.status === "inserted" ? "font-black text-pine" : "font-black text-coral"}>{item.status === "inserted" ? "저장" : "확인 필요"}</span> · {item.index}번 {item.product_id ?? item.error ?? item.message ?? "처리 결과 없음"}{item.operator_next_action ? <span className="text-ink"> · 다음 조치: {item.operator_next_action}</span> : null}</li>)}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
