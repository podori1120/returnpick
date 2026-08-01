"use client";

import { useState } from "react";
import { CheckCircle2, Link2, LoaderCircle } from "lucide-react";
import { categoryOptions } from "@/lib/category";
import { isUsableAffiliateUrl, isUsableCoupangProductUrl } from "@/lib/coupangLink";
import type { Category } from "@/lib/types";

const emptyForm = { title: "", category: "laptop" as Category, affiliate_url: "", coupang_url: "", image_url: "", public_note: "", admin_memo: "" };

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

export default function AdminAffiliateLinkIntake({ password, onCreated }: { password: string; onCreated: () => void }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [nextAction, setNextAction] = useState<string | null>(null);
  const affiliateReady = isUsableAffiliateUrl(form.affiliate_url.trim());
  const suppliedUrlReady = !form.coupang_url.trim() || isUsableCoupangProductUrl(form.coupang_url.trim());

  function update(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit() {
    setSaving(true);
    setNotice(null);
    setNextAction(null);
    try {
      const response = await fetch("/api/admin/products/link-intake", { method: "POST", headers: headers(password), body: JSON.stringify(form) });
      const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string; product?: { id?: string }; operator_next_action?: string };
      setNextAction(data.operator_next_action ?? null);
      if (!response.ok) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "후보를 저장하지 않았습니다." });
        return;
      }
      setNotice({ type: "success", message: `검수 대기 후보를 저장했습니다${data.product?.id ? `: ${data.product.id}` : ""}.` });
      setForm(emptyForm);
      onCreated();
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 후보를 저장하지 못했습니다." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="admin-affiliate-link-intake" className="scroll-mt-4 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl"><p className="text-sm font-black text-pine">Affiliate Link Intake</p><h2 className="mt-1 text-xl font-black">파트너스 링크로 빠른 후보 등록</h2><p className="mt-2 text-sm font-semibold leading-6 text-steel">링크로 상품번호를 확인해 검수 대기 후보만 저장합니다. 가격·반품등급·재고는 추정하지 않으며 자동 게시하지 않습니다.</p></div>
        <Link2 className="text-pine" size={24} aria-hidden />
      </div>
      {notice ? <p className={`mt-4 rounded-lg border px-3 py-2 text-sm font-bold ${notice.type === "success" ? "border-pine/30 bg-pine/10 text-pine" : "border-coral/30 bg-coral/10 text-coral"}`} role="status">{notice.message}</p> : null}
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
    </section>
  );
}
