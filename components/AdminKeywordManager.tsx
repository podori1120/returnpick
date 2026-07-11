"use client";

import { useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { categoryOptions, getCategoryLabel } from "@/lib/category";
import { formatPrice } from "@/lib/format";
import type { Category, SourcingKeyword } from "@/lib/types";

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

export default function AdminKeywordManager({ password }: { password: string }) {
  const [keywords, setKeywords] = useState<SourcingKeyword[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    keyword: "",
    category: "laptop" as Category,
    min_price: "",
    max_price: "",
    min_discount_rate: "0.12"
  });
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function loadKeywords() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/keywords", { headers: headers(password) });
      const data = (await response.json().catch(() => ({}))) as { keywords?: SourcingKeyword[]; message?: string; error?: string };
      if (!response.ok) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "키워드 목록을 불러오지 못했습니다." });
        return;
      }
      setKeywords(data.keywords ?? []);
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 키워드 목록을 불러오지 못했습니다." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadKeywords();
  }, [password]);

  async function addKeyword() {
    if (!form.keyword.trim()) return;
    setNotice(null);
    try {
      const response = await fetch("/api/admin/keywords", {
        method: "POST",
        headers: headers(password),
        body: JSON.stringify(form)
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!response.ok) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "키워드를 추가하지 못했습니다." });
        return;
      }
      setForm((current) => ({ ...current, keyword: "" }));
      setNotice({ type: "success", message: "키워드를 저장했습니다." });
      await loadKeywords();
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 키워드를 추가하지 못했습니다." });
    }
  }

  async function toggleKeyword(keyword: SourcingKeyword) {
    setNotice(null);
    try {
      const response = await fetch("/api/admin/keywords", {
        method: "PATCH",
        headers: headers(password),
        body: JSON.stringify({ id: keyword.id, is_active: !keyword.is_active })
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!response.ok) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "키워드 상태를 바꾸지 못했습니다." });
        return;
      }
      setNotice({ type: "success", message: keyword.is_active ? "키워드를 비활성화했습니다." : "키워드를 활성화했습니다." });
      await loadKeywords();
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 키워드 상태를 바꾸지 못했습니다." });
    }
  }

  return (
    <section id="admin-keyword-manager" className="scroll-mt-4 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black">소싱 키워드</h2>
        <button
          className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-black hover:bg-mist"
          onClick={loadKeywords}
          type="button"
        >
          <RefreshCw size={16} aria-hidden /> 새로고침
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
        <input
          className="focus-ring rounded-lg border border-line px-3 py-2 text-sm"
          value={form.keyword}
          onChange={(event) => setForm((current) => ({ ...current, keyword: event.target.value }))}
          placeholder="키워드"
        />
        <select
          className="focus-ring rounded-lg border border-line px-3 py-2 text-sm"
          value={form.category}
          onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as Category }))}
        >
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          className="focus-ring rounded-lg border border-line px-3 py-2 text-sm"
          value={form.min_price}
          onChange={(event) => setForm((current) => ({ ...current, min_price: event.target.value }))}
          placeholder="최소가"
          inputMode="numeric"
        />
        <input
          className="focus-ring rounded-lg border border-line px-3 py-2 text-sm"
          value={form.max_price}
          onChange={(event) => setForm((current) => ({ ...current, max_price: event.target.value }))}
          placeholder="최대가"
          inputMode="numeric"
        />
        <input
          className="focus-ring rounded-lg border border-line px-3 py-2 text-sm"
          value={form.min_discount_rate}
          onChange={(event) => setForm((current) => ({ ...current, min_discount_rate: event.target.value }))}
          placeholder="최소 할인율"
        />
        <button
          className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-black text-white hover:bg-pine"
          onClick={addKeyword}
          type="button"
        >
          <Plus size={16} aria-hidden /> 추가
        </button>
      </div>
      {notice ? (
        <div
          className={
            notice.type === "success"
              ? "mt-3 rounded-lg bg-pine/10 p-3 text-sm font-bold text-pine"
              : "mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700"
          }
          role="status"
          aria-live="polite"
        >
          {notice.message}
        </div>
      ) : null}

      <div className="mt-4 max-h-80 overflow-auto rounded-lg border border-line">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-mist text-xs font-black text-steel">
            <tr>
              <th className="px-3 py-2">키워드</th>
              <th className="px-3 py-2">카테고리</th>
              <th className="px-3 py-2">가격대</th>
              <th className="px-3 py-2">최소 할인</th>
              <th className="px-3 py-2">상태</th>
            </tr>
          </thead>
          <tbody>
            {keywords.map((keyword) => (
              <tr key={keyword.id} className="border-t border-line">
                <td className="px-3 py-2 font-bold">{keyword.keyword}</td>
                <td className="px-3 py-2">{getCategoryLabel(keyword.category)}</td>
                <td className="px-3 py-2">
                  {formatPrice(keyword.min_price)} ~ {formatPrice(keyword.max_price)}
                </td>
                <td className="px-3 py-2">{keyword.min_discount_rate ?? "-"}</td>
                <td className="px-3 py-2">
                  <button
                    className="focus-ring rounded-md border border-line px-2.5 py-1 text-xs font-black hover:bg-mist"
                    onClick={() => toggleKeyword(keyword)}
                    type="button"
                  >
                    {keyword.is_active ? "활성" : "비활성"}
                  </button>
                </td>
              </tr>
            ))}
            {!keywords.length && !loading ? (
              <tr>
                <td className="px-3 py-5 text-center font-bold text-steel" colSpan={5}>
                  키워드가 없습니다
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
