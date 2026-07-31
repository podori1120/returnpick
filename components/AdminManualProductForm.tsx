"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardPlus, ExternalLink } from "lucide-react";
import { categoryOptions } from "@/lib/category";
import { isUsableAffiliateUrl, isUsableCoupangProductUrl } from "@/lib/coupangLink";
import type { Category } from "@/lib/types";

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

const emptyForm = {
  title: "",
  category: "laptop" as Category,
  coupang_url: "",
  affiliate_url: "",
  brand: "",
  model_name: "",
  image_url: "",
  public_note: "",
  admin_memo: ""
};

export default function AdminManualProductForm({ password, onCreated }: { password: string; onCreated: () => void }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [existingProductId, setExistingProductId] = useState<string | null>(null);
  const urlReady = isUsableCoupangProductUrl(form.coupang_url.trim());
  const affiliateUrlValue = form.affiliate_url.trim();
  const affiliateUrlReady = !affiliateUrlValue || isUsableAffiliateUrl(affiliateUrlValue);

  function update(field: Exclude<keyof typeof emptyForm, "category">, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit() {
    setSaving(true);
    setNotice(null);
    setCreatedProductId(null);
    setExistingProductId(null);
    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: headers(password),
        body: JSON.stringify(form)
      });
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        existing_product_id?: string | null;
        product?: { id?: string | null };
      };
      if (!response.ok) {
        setExistingProductId(data.existing_product_id ?? null);
        setNotice({ type: "error", message: data.message ?? data.error ?? "후보를 추가하지 못했습니다." });
        return;
      }
      setNotice({ type: "success", message: data.message ?? "검토 대기 후보를 추가했습니다." });
      setCreatedProductId(data.product?.id ?? null);
      setForm(emptyForm);
      onCreated();
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 후보를 추가하지 못했습니다." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="admin-manual-product" className="scroll-mt-4 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-sm font-black text-pine">Manual Candidate</p>
          <h2 className="mt-1 text-xl font-black">실제 상품을 검토 후보로 추가</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-steel">
            자동 수집 결과가 없을 때 쿠팡 상품 상세 URL로 초안을 시작합니다. 반품등급, 반품가, 네이버 가격과 파트너스 링크는 추정하지 않고 저장 후 별도 검수 큐에서 보완합니다.
          </p>
        </div>
        <ClipboardPlus className="text-pine" size={24} aria-hidden />
      </div>

      {notice ? (
        <p className={`mt-4 rounded-lg border px-3 py-2 text-sm font-bold ${notice.type === "success" ? "border-pine/30 bg-pine/10 text-pine" : "border-coral/30 bg-coral/10 text-coral"}`} role="status">
          {notice.message}
        </p>
      ) : null}

      {existingProductId ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-lemon/50 bg-lemon/15 px-3 py-3 text-sm font-bold text-ink">
          <p>기존 후보 ID <code className="break-all">{existingProductId}</code>를 유지했습니다. 새 입력으로 덮어쓰지 않았습니다.</p>
          <a className="focus-ring shrink-0 rounded-lg border border-ink px-3 py-2 text-xs font-black hover:bg-white" href="#admin-candidate-review">
            후보 검토 화면으로 이동
          </a>
        </div>
      ) : null}

      {createdProductId ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-pine/30 bg-pine/10 px-3 py-3 text-sm font-bold text-pine">
          <p>상품 ID <code className="break-all">{createdProductId}</code>가 생성됐습니다. 다음은 상품별 파트너스 링크 확인입니다.</p>
          <a
            className="focus-ring shrink-0 rounded-lg bg-pine px-3 py-2 text-xs font-black text-white hover:bg-ink"
            href={`?candidate=${encodeURIComponent(createdProductId)}#admin-affiliate-links`}
          >
            링크 보강 큐로 이동
          </a>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold text-steel sm:col-span-2">
          상품명 <span className="text-coral">*</span>
          <input className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="예: LG 그램 16 16GB 512GB" />
        </label>
        <label className="text-sm font-bold text-steel">
          카테고리 <span className="text-coral">*</span>
          <select className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as Category }))}>
            {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-steel">
          브랜드
          <input className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" value={form.brand} onChange={(event) => update("brand", event.target.value)} placeholder="예: LG" />
        </label>
        <label className="text-sm font-bold text-steel">
          모델명
          <input className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" value={form.model_name} onChange={(event) => update("model_name", event.target.value)} placeholder="예: Gram 16" />
        </label>
        <label className="text-sm font-bold text-steel sm:col-span-2">
          쿠팡 상품 상세 URL <span className="text-coral">*</span>
          <input aria-invalid={form.coupang_url.trim().length > 0 && !urlReady} className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" value={form.coupang_url} onChange={(event) => update("coupang_url", event.target.value)} placeholder="https://www.coupang.com/vp/products/..." type="url" />
          <span className={urlReady ? "mt-1 flex items-center gap-1 text-xs font-bold text-pine" : "mt-1 block text-xs font-semibold text-steel"}>
            {urlReady ? <><CheckCircle2 size={14} aria-hidden /> 상품번호를 읽을 수 있는 상세 URL입니다.</> : "검색 결과·골드박스·공통 랜딩 주소는 입력하지 마세요."}
          </span>
        </label>
        <label className="text-sm font-bold text-steel sm:col-span-2">
          쿠팡 파트너스 링크 (선택)
          <input
            aria-invalid={affiliateUrlValue.length > 0 && !affiliateUrlReady}
            className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink"
            value={form.affiliate_url}
            onChange={(event) => update("affiliate_url", event.target.value)}
            placeholder="https://link.coupang.com/a/..."
            type="url"
          />
          <span className={affiliateUrlValue.length === 0 ? "mt-1 block text-xs font-semibold text-steel" : affiliateUrlReady ? "mt-1 block text-xs font-bold text-pine" : "mt-1 block text-xs font-semibold text-coral"}>
            {affiliateUrlValue.length === 0
              ? "없으면 링크 보강 큐에서 나중에 입력할 수 있습니다."
              : affiliateUrlReady
                ? "저장 후 상품별 링크 목적지 확인을 통과해야 게시할 수 있습니다."
                : "https://link.coupang.com/a/... 형식의 실제 파트너스 링크를 입력하세요."}
          </span>
        </label>
        <label className="text-sm font-bold text-steel sm:col-span-2">
          공개 이미지 URL (선택)
          <input className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" value={form.image_url} onChange={(event) => update("image_url", event.target.value)} placeholder="https://.../product-image.jpg" type="url" />
        </label>
        <label className="text-sm font-bold text-steel">
          공개 메모 (선택)
          <textarea className="focus-ring mt-1 min-h-24 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" value={form.public_note} onChange={(event) => update("public_note", event.target.value)} placeholder="고객에게 보여줄 검수 메모" />
        </label>
        <label className="text-sm font-bold text-steel">
          관리자 메모 (선택)
          <textarea className="focus-ring mt-1 min-h-24 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" value={form.admin_memo} onChange={(event) => update("admin_memo", event.target.value)} placeholder="링크·가격 확인 메모" />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-xs font-semibold leading-5 text-steel">추가 후 상태는 검토 필요입니다. 게시하려면 상품별 파트너스 링크, 가격·등급·이미지 확인을 모두 통과해야 합니다.</p>
        <button className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-4 py-2.5 text-sm font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60" disabled={saving || form.title.trim().length < 5 || !urlReady || !affiliateUrlReady} onClick={() => void submit()} type="button">
          <ClipboardPlus size={16} aria-hidden /> {saving ? "추가 중" : "검토 후보 추가"}
        </button>
      </div>
      <a className="focus-ring mt-3 inline-flex items-center gap-1 text-xs font-black text-pine hover:text-ink" href="https://www.coupang.com" target="_blank" rel="noopener noreferrer">
        쿠팡 상품 페이지 열기 <ExternalLink size={13} aria-hidden />
      </a>
    </section>
  );
}
