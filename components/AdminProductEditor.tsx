"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
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
    await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: headers(password),
      body: JSON.stringify(form)
    });
    setSaving(false);
    onSaved();
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
        />
      </label>
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
        <Save size={16} aria-hidden /> 저장 후 재점수화
      </button>
    </section>
  );
}
