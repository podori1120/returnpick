"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Save } from "lucide-react";
import { isApprovalSampleAffiliateUrl, isGenericCoupangLandingUrl, isUsableAffiliateUrl, isUsableCoupangProductUrl } from "@/lib/coupangLink";
import type { ProductWithScore } from "@/lib/types";

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

export default function AdminProductEditor({
  product,
  password,
  onSaved
}: {
  product: ProductWithScore | null;
  password: string;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    condition_grade: "확인필요",
    return_price: "",
    new_price: "",
    naver_lowest_price: "",
    stock_count: "",
    affiliate_url: "",
    public_note: "",
    admin_memo: ""
  });
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const affiliateReady = isUsableAffiliateUrl(form.affiliate_url);
  const genericAffiliate = isGenericCoupangLandingUrl(form.affiliate_url);
  const approvalSampleAffiliate = isApprovalSampleAffiliateUrl(form.affiliate_url);
  const regularProductUrl = !affiliateReady && isUsableCoupangProductUrl(form.affiliate_url);

  useEffect(() => {
    if (!product) return;
    setForm({
      condition_grade: product.condition_grade,
      return_price: product.return_price?.toString() ?? "",
      new_price: product.new_price?.toString() ?? "",
      naver_lowest_price: product.naver_lowest_price?.toString() ?? "",
      stock_count: product.stock_count?.toString() ?? "",
      affiliate_url: product.affiliate_url ?? "",
      public_note: product.public_note ?? "",
      admin_memo: product.admin_memo ?? ""
    });
    setSaveNotice(null);
  }, [product]);

  if (!product) {
    return (
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h2 className="text-lg font-black">후보 빠른 수정</h2>
        <p className="mt-3 text-sm font-semibold text-steel">후보를 선택하면 수정 패널이 열립니다.</p>
      </section>
    );
  }

  async function save() {
    if (!product) return;
    setSaving(true);
    setSaveNotice(null);
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: headers(password),
        body: JSON.stringify(form)
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!response.ok) {
        setSaveNotice({ type: "error", message: data.message ?? data.error ?? "저장에 실패했습니다. 입력값을 확인해 주세요." });
        return;
      }
      setSaveNotice({ type: "success", message: "저장했고 점수를 다시 계산했습니다." });
      onSaved();
    } catch {
      setSaveNotice({ type: "error", message: "네트워크 문제로 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <h2 className="text-lg font-black">후보 빠른 수정</h2>
      <p className="mt-1 line-clamp-2 text-sm font-bold text-steel">{product.title}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold text-steel">
          반품등급
          <select
            className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink"
            value={form.condition_grade}
            onChange={(event) => setForm((current) => ({ ...current, condition_grade: event.target.value }))}
          >
            {["미개봉", "최상", "상", "중", "알수없음", "확인필요"].map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
        </label>
        {[
          ["return_price", "반품가"],
          ["new_price", "새상품가"],
          ["naver_lowest_price", "네이버 최저가"],
          ["stock_count", "재고"]
        ].map(([field, label]) => (
          <label key={field} className="text-sm font-bold text-steel">
            {label}
            <input
              className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink"
              value={form[field as keyof typeof form]}
              onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
              inputMode="numeric"
            />
          </label>
        ))}
      </div>

      <label className="mt-3 block text-sm font-bold text-steel">
        파트너스 URL
        <input
          className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink"
          value={form.affiliate_url}
          onChange={(event) => setForm((current) => ({ ...current, affiliate_url: event.target.value }))}
          placeholder="https://link.coupang.com/a/..."
        />
      </label>
      <div
        className={
          affiliateReady && !approvalSampleAffiliate
            ? "mt-2 rounded-lg bg-pine/10 p-3 text-sm font-bold text-pine"
            : "mt-2 rounded-lg bg-lemon/30 p-3 text-sm font-bold text-ink"
        }
      >
        <div className="flex items-start gap-2">
          {affiliateReady && !approvalSampleAffiliate ? <CheckCircle2 className="mt-0.5 shrink-0" size={16} aria-hidden /> : <AlertTriangle className="mt-0.5 shrink-0" size={16} aria-hidden />}
          <div>
            <p>
              {approvalSampleAffiliate
                ? "승인용 샘플 링크입니다. 실상품 게시에는 사용할 수 없습니다."
                : affiliateReady
                  ? "구매 버튼 CTA 준비됨"
                  : genericAffiliate
                    ? "공통/샘플 링크로 보입니다. 상품별 파트너스 링크 보강 권장"
                    : "상품별 쿠팡 파트너스 링크가 필요합니다."}
            </p>
            {approvalSampleAffiliate ? (
              <p className="mt-1 text-xs font-semibold text-red-700">
                `/products/approval-sample` 캡처용 링크는 심사 전용입니다. 이 상품에 맞는 링크를 쿠팡 파트너스에서 새로 만들어 넣어주세요.
              </p>
            ) : null}
            {regularProductUrl ? (
              <p className="mt-1 text-xs font-semibold text-red-700">
                일반 쿠팡 상품 URL은 수익 추적용 CTA로 사용할 수 없습니다. 쿠팡 파트너스에서 생성한
                `https://link.coupang.com/a/...` 링크를 넣어주세요.
              </p>
            ) : null}
            <p className="mt-1 text-xs font-semibold">
              게시 전에는 쿠팡 파트너스에서 생성한 상품별 링크를 넣는 것이 전환 추적과 심사 대응에 가장 안전합니다.
            </p>
          </div>
        </div>
      </div>
      <label className="mt-3 block text-sm font-bold text-steel">
        공개 메모
        <textarea
          className="focus-ring mt-1 min-h-20 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink"
          value={form.public_note}
          onChange={(event) => setForm((current) => ({ ...current, public_note: event.target.value }))}
        />
      </label>
      <label className="mt-3 block text-sm font-bold text-steel">
        관리자 메모
        <textarea
          className="focus-ring mt-1 min-h-20 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink"
          value={form.admin_memo}
          onChange={(event) => setForm((current) => ({ ...current, admin_memo: event.target.value }))}
        />
      </label>
      <button
        className="focus-ring mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-black text-white hover:bg-pine disabled:opacity-60"
        onClick={save}
        disabled={saving}
        type="button"
      >
        <Save size={16} aria-hidden /> {saving ? "저장 중" : "저장 후 재점수화"}
      </button>
      {saveNotice ? (
        <div
          className={
            saveNotice.type === "success"
              ? "mt-3 rounded-lg bg-pine/10 p-3 text-sm font-bold text-pine"
              : "mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700"
          }
          role="status"
          aria-live="polite"
        >
          {saveNotice.message}
        </div>
      ) : null}
    </section>
  );
}
