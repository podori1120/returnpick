"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, EyeOff, Search, X, PackageCheck } from "lucide-react";
import AdminProductEditor from "@/components/AdminProductEditor";
import TelegramPreview from "@/components/TelegramPreview";
import ScoreBadge from "@/components/ScoreBadge";
import VerdictBadge from "@/components/VerdictBadge";
import { categoryOptions, getCategoryLabel } from "@/lib/category";
import { calculateDiscountRate, formatDate, formatPercent, formatPrice } from "@/lib/format";
import { getDealQuality } from "@/lib/quality";
import type { Category, ProductWithScore, SourcingStatus } from "@/lib/types";

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

type SortKey = "score" | "discount" | "latest" | "price";
type ProductRevenueMetric = {
  product_id: string;
  detail_views: number;
  affiliate_clicks: number;
  affiliate_ctr: number;
  cta_ready: boolean;
};

export default function AdminCandidateTable({ password, refreshToken }: { password: string; refreshToken: number }) {
  const [products, setProducts] = useState<ProductWithScore[]>([]);
  const [productMetrics, setProductMetrics] = useState<Record<string, ProductRevenueMetric>>({});
  const [selected, setSelected] = useState<ProductWithScore | null>(null);
  const [status, setStatus] = useState<SourcingStatus | "all">("needs_review");
  const [category, setCategory] = useState<Category | "all">("all");
  const [query, setQuery] = useState("");
  const [minScore, setMinScore] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [conditionUnknownOnly, setConditionUnknownOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("score");

  async function loadProducts() {
    const [response, revenueResponse] = await Promise.all([
      fetch("/api/admin/products", { headers: headers(password) }),
      fetch("/api/admin/revenue-metrics", { headers: headers(password) })
    ]);
    const data = await response.json();
    const revenueData = await revenueResponse.json();
    const nextProducts = data.products ?? [];
    setProducts(nextProducts);
    setProductMetrics(
      Object.fromEntries((revenueData.metrics?.productMetrics ?? []).map((metric: ProductRevenueMetric) => [metric.product_id, metric]))
    );
    if (selected) {
      setSelected(nextProducts.find((product: ProductWithScore) => product.id === selected.id) ?? null);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, [password, refreshToken]);

  const filtered = useMemo(() => {
    const minScoreValue = Number(minScore) || 0;
    const minPriceValue = Number(minPrice) || 0;
    const maxPriceValue = Number(maxPrice) || Number.POSITIVE_INFINITY;

    return products
      .filter((product) => (status === "all" ? true : product.sourcing_status === status))
      .filter((product) => (category === "all" ? true : product.category === category))
      .filter((product) => (conditionUnknownOnly ? product.condition_grade === "확인필요" || product.condition_grade === "알수없음" : true))
      .filter((product) => (query ? product.title.toLowerCase().includes(query.toLowerCase()) : true))
      .filter((product) => (product.latest_score?.total_score ?? 0) >= minScoreValue)
      .filter((product) => {
        const price = product.return_price ?? product.source_price ?? 0;
        return price >= minPriceValue && price <= maxPriceValue;
      })
      .sort((a, b) => {
        if (sort === "score") return (b.latest_score?.total_score ?? 0) - (a.latest_score?.total_score ?? 0);
        if (sort === "discount") {
          const ad = calculateDiscountRate(a.naver_lowest_price ?? a.new_price ?? a.source_price, a.return_price ?? a.source_price) ?? -1;
          const bd = calculateDiscountRate(b.naver_lowest_price ?? b.new_price ?? b.source_price, b.return_price ?? b.source_price) ?? -1;
          return bd - ad;
        }
        if (sort === "price") return (b.return_price ?? b.source_price ?? 0) - (a.return_price ?? a.source_price ?? 0);
        return b.created_at.localeCompare(a.created_at);
      });
  }, [products, status, category, conditionUnknownOnly, query, minScore, minPrice, maxPrice, sort]);

  async function action(product: ProductWithScore, actionName: string) {
    if (actionName === "publish" && !product.affiliate_url) {
      const confirmed = window.confirm("제휴 URL이 없는 상품입니다. 게시하면 구매 버튼은 링크 확인필요로 표시됩니다. 계속할까요?");
      if (!confirmed) return;
    }
    await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: headers(password),
      body: JSON.stringify({ action: actionName })
    });
    await loadProducts();
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black">후보 검토 대시보드</h2>
          <button className="focus-ring rounded-lg border border-line px-3 py-2 text-sm font-black hover:bg-mist" onClick={loadProducts} type="button">
            새로고침
          </button>
        </div>

        <div className="grid gap-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel" size={16} aria-hidden />
            <input
              className="focus-ring w-full rounded-lg border border-line py-2 pl-9 pr-3 text-sm"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="검색"
            />
          </label>
          <select className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value as SourcingStatus | "all")}>
            <option value="needs_review">needs_review</option>
            <option value="candidate">candidate</option>
            <option value="approved">approved</option>
            <option value="published">published</option>
            <option value="rejected">rejected</option>
            <option value="sold_out">sold_out</option>
            <option value="all">전체</option>
          </select>
          <select className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" value={category} onChange={(event) => setCategory(event.target.value as Category | "all")}>
            <option value="all">전체 카테고리</option>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="score">점수 높은 순</option>
            <option value="discount">할인율 높은 순</option>
            <option value="latest">최신 수집순</option>
            <option value="price">가격 높은 순</option>
          </select>
          <input className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" value={minScore} onChange={(event) => setMinScore(event.target.value)} placeholder="최소 점수" inputMode="numeric" />
          <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-bold text-steel">
            <input checked={conditionUnknownOnly} onChange={(event) => setConditionUnknownOnly(event.target.checked)} type="checkbox" />
            확인필요
          </label>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="최소 가격" inputMode="numeric" />
          <input className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="최대 가격" inputMode="numeric" />
        </div>

        <div className="mt-4 overflow-auto rounded-lg border border-line">
          <table className="w-full min-w-[1240px] text-left text-sm">
            <thead className="bg-mist text-xs font-black text-steel">
              <tr>
                <th className="px-3 py-2">상품</th>
                <th className="px-3 py-2">카테고리</th>
                <th className="px-3 py-2">점수</th>
                <th className="px-3 py-2">가격</th>
                <th className="px-3 py-2">할인</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">수익 퍼널</th>
                <th className="px-3 py-2">CTA</th>
                <th className="px-3 py-2">수집</th>
                <th className="px-3 py-2">작업</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => {
                const discount = calculateDiscountRate(product.naver_lowest_price ?? product.new_price ?? product.source_price, product.return_price ?? product.source_price);
                const quality = getDealQuality(product);
                const revenue = productMetrics[product.id];
                return (
                  <tr key={product.id} className="border-t border-line align-top">
                    <td className="max-w-md px-3 py-3">
                      <button className="text-left font-black hover:text-pine" onClick={() => setSelected(product)} type="button">
                        {product.title}
                      </button>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <VerdictBadge verdict={product.latest_score?.verdict} />
                        <span className="rounded-md bg-mist px-2 py-1 text-xs font-bold text-steel">{product.condition_grade}</span>
                        <span className="rounded-md bg-pine/10 px-2 py-1 text-xs font-bold text-pine">
                          {quality.label} {quality.confidence}
                        </span>
                      </div>
                      {[...quality.blockers, ...quality.warnings].slice(0, 2).length ? (
                        <p className="mt-2 line-clamp-1 text-xs font-semibold text-steel">
                          {[...quality.blockers, ...quality.warnings].slice(0, 2).join(" · ")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">{getCategoryLabel(product.category)}</td>
                    <td className="px-3 py-3">
                      <ScoreBadge score={product.latest_score?.total_score} />
                    </td>
                    <td className="px-3 py-3 font-bold">{formatPrice(product.return_price ?? product.source_price)}</td>
                    <td className="px-3 py-3 font-bold">{formatPercent(discount)}</td>
                    <td className="px-3 py-3">{product.sourcing_status}</td>
                    <td className="px-3 py-3 text-xs font-bold text-steel">
                      상세 {revenue?.detail_views ?? 0} · 구매 {revenue?.affiliate_clicks ?? 0}
                      <br />
                      CTA {revenue?.affiliate_ctr ?? 0}%
                    </td>
                    <td className="px-3 py-3">
                      <span className={product.affiliate_url ? "rounded-md bg-pine/10 px-2 py-1 text-xs font-black text-pine" : "rounded-md bg-coral/10 px-2 py-1 text-xs font-black text-coral"}>
                        {product.affiliate_url ? "준비됨" : "링크 누락"}
                      </span>
                    </td>
                    <td className="px-3 py-3">{formatDate(product.created_at)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button className="focus-ring rounded-md border border-line p-2 hover:bg-mist" title="승인" onClick={() => action(product, "approve")} type="button">
                          <Check size={15} aria-hidden />
                        </button>
                        <button className="focus-ring rounded-md border border-line p-2 hover:bg-mist" title="게시" onClick={() => action(product, "publish")} type="button">
                          <PackageCheck size={15} aria-hidden />
                        </button>
                        <button className="focus-ring rounded-md border border-line p-2 hover:bg-mist" title="비공개" onClick={() => action(product, "unpublish")} type="button">
                          <EyeOff size={15} aria-hidden />
                        </button>
                        <button className="focus-ring rounded-md border border-line p-2 hover:bg-mist" title="거절" onClick={() => action(product, "reject")} type="button">
                          <X size={15} aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length ? (
                <tr>
                  <td className="px-3 py-8 text-center font-bold text-steel" colSpan={10}>
                    조건에 맞는 후보가 없습니다
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AdminProductEditor product={selected} password={password} onSaved={loadProducts} />
        <TelegramPreview product={selected} password={password} />
      </div>
    </section>
  );
}
