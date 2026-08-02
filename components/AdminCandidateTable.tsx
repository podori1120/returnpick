"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, EyeOff, ExternalLink, Search, X, PackageCheck } from "lucide-react";
import AdminProductEditor from "@/components/AdminProductEditor";
import TelegramPreview from "@/components/TelegramPreview";
import ScoreBadge from "@/components/ScoreBadge";
import VerdictBadge from "@/components/VerdictBadge";
import {
  ADMIN_CANDIDATE_QUEUE_EVENT,
  type AdminCandidateQueue,
  type AdminCandidateQueueEventDetail
} from "@/lib/adminNavigation";
import { categoryOptions, getCategoryLabel } from "@/lib/category";
import { isApprovalSampleAffiliateUrl, isUsableAffiliateUrl } from "@/lib/coupangLink";
import { formatDate, formatPercent, formatPrice } from "@/lib/format";
import { getAppliedDiscountRate } from "@/lib/priceReference";
import { getNaverPriceTrust } from "@/lib/naverPriceTrust";
import { getCustomerPublishReadiness, getDealQuality } from "@/lib/quality";
import { getPublicWebEvidence } from "@/lib/publicWebEvidence";
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
  unique_detail_visitors?: number;
  unique_affiliate_clickers?: number;
  session_affiliate_ctr?: number;
  cta_ready: boolean;
};

type AdminProductsResponse = {
  products?: ProductWithScore[];
  error?: string;
  message?: string;
};

type RevenueMetricsResponse = {
  metrics?: {
    productMetrics?: ProductRevenueMetric[];
  };
  error?: string;
  message?: string;
};

function noticeClassName(type: "info" | "success" | "error") {
  if (type === "error") return "border-coral/30 bg-coral/10 text-coral";
  if (type === "success") return "border-pine/30 bg-pine/10 text-pine";
  return "border-line bg-mist text-steel";
}

function isProductPublishReady(product: ProductWithScore) {
  return isUsableAffiliateUrl(product.affiliate_url) && !isApprovalSampleAffiliateUrl(product.affiliate_url);
}

function isCustomerPublishReady(product: ProductWithScore) {
  return getCustomerPublishReadiness(product).ready;
}

function isPublishedPublicBlocked(product: ProductWithScore) {
  return product.is_published && product.sourcing_status === "published" && !isCustomerPublishReady(product);
}

export default function AdminCandidateTable({ password, refreshToken }: { password: string; refreshToken: number }) {
  const [products, setProducts] = useState<ProductWithScore[]>([]);
  const [productMetrics, setProductMetrics] = useState<Record<string, ProductRevenueMetric>>({});
  const [selected, setSelected] = useState<ProductWithScore | null>(null);
  const [notice, setNotice] = useState<{ type: "info" | "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionProductId, setActionProductId] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [publishedActionCount, setPublishedActionCount] = useState(0);
  const [status, setStatus] = useState<SourcingStatus | "all">("needs_review");
  const [category, setCategory] = useState<Category | "all">("all");
  const [query, setQuery] = useState("");
  const [minScore, setMinScore] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [conditionUnknownOnly, setConditionUnknownOnly] = useState(false);
  const [missingAffiliateOnly, setMissingAffiliateOnly] = useState(false);
  const [publishReadyOnly, setPublishReadyOnly] = useState(false);
  const [publicBlockedOnly, setPublicBlockedOnly] = useState(false);
  const [naverPriceNeedsReviewOnly, setNaverPriceNeedsReviewOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("score");
  const [focusProductIds, setFocusProductIds] = useState<string[]>([]);

  async function loadProducts() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/products", { headers: headers(password) });
      const data = (await response.json().catch(() => ({}))) as AdminProductsResponse;
      if (!response.ok || !Array.isArray(data.products)) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "후보 목록을 불러오지 못했습니다." });
        return;
      }

      const nextProducts = data.products;
      setProducts(nextProducts);
      setSelectedProductIds((currentIds) =>
        currentIds.filter((id) => nextProducts.some((product) => product.id === id && isCustomerPublishReady(product)))
      );
      if (selected) {
        setSelected(nextProducts.find((product: ProductWithScore) => product.id === selected.id) ?? null);
      }

      const revenueResponse = await fetch("/api/admin/revenue-metrics?days=30", { headers: headers(password) });
      const revenueData = (await revenueResponse.json().catch(() => ({}))) as RevenueMetricsResponse;
      if (!revenueResponse.ok) {
        setProductMetrics({});
        setNotice({ type: "error", message: revenueData.message ?? revenueData.error ?? "후보 목록은 불러왔지만 수익 지표를 불러오지 못했습니다." });
        return;
      }

      setProductMetrics(
        Object.fromEntries((revenueData.metrics?.productMetrics ?? []).map((metric: ProductRevenueMetric) => [metric.product_id, metric]))
      );
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 후보 목록을 불러오지 못했습니다." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, [password, refreshToken]);

  const applyCandidateQueue = useCallback((queue: AdminCandidateQueue, productIds: string[] = []) => {
    setFocusProductIds(Array.from(new Set(productIds.filter(Boolean))));
    setCategory("all");
    setQuery("");
    setMinScore("");
    setMinPrice("");
    setMaxPrice("");
    setConditionUnknownOnly(false);
    setSelectedProductIds([]);
    setSort("score");
    setNaverPriceNeedsReviewOnly(false);

    if (queue === "publish_ready") {
      setStatus("needs_review");
      setPublishReadyOnly(true);
      setMissingAffiliateOnly(false);
      setPublicBlockedOnly(false);
      return;
    }

    if (queue === "affiliate_backfill") {
      setStatus("needs_review");
      setPublishReadyOnly(false);
      setMissingAffiliateOnly(true);
      setPublicBlockedOnly(false);
      return;
    }

    if (queue === "public_repair") {
      setStatus("published");
      setPublishReadyOnly(false);
      setMissingAffiliateOnly(false);
      setPublicBlockedOnly(true);
      return;
    }

    setStatus("needs_review");
    setPublishReadyOnly(false);
    setMissingAffiliateOnly(false);
    setPublicBlockedOnly(false);
  }, []);

  useEffect(() => {
    function handleCandidateQueueEvent(event: Event) {
      const detail = (event as CustomEvent<Partial<AdminCandidateQueueEventDetail>>).detail;
      const queue = detail?.queue;
      if (!queue) return;
      applyCandidateQueue(queue, detail.productIds ?? []);
    }

    window.addEventListener(ADMIN_CANDIDATE_QUEUE_EVENT, handleCandidateQueueEvent);
    return () => window.removeEventListener(ADMIN_CANDIDATE_QUEUE_EVENT, handleCandidateQueueEvent);
  }, [applyCandidateQueue]);

  const filtered = useMemo(() => {
    const minScoreValue = Number(minScore) || 0;
    const minPriceValue = Number(minPrice) || 0;
    const maxPriceValue = Number(maxPrice) || Number.POSITIVE_INFINITY;

    return products
      .filter((product) => (status === "all" ? true : product.sourcing_status === status))
      .filter((product) => !focusProductIds.length || focusProductIds.includes(product.id))
      .filter((product) => (category === "all" ? true : product.category === category))
      .filter((product) => (conditionUnknownOnly ? product.condition_grade === "확인필요" || product.condition_grade === "알수없음" : true))
      .filter((product) => (missingAffiliateOnly ? !isProductPublishReady(product) : true))
      .filter((product) => (publishReadyOnly ? isCustomerPublishReady(product) : true))
      .filter((product) => (publicBlockedOnly ? isPublishedPublicBlocked(product) : true))
      .filter((product) => (naverPriceNeedsReviewOnly ? getNaverPriceTrust(product).trustedPrice == null : true))
      .filter((product) => (query ? product.title.toLowerCase().includes(query.toLowerCase()) : true))
      .filter((product) => (product.latest_score?.total_score ?? 0) >= minScoreValue)
      .filter((product) => {
        const price = product.return_price ?? product.source_price ?? product.new_price ?? 0;
        return price >= minPriceValue && price <= maxPriceValue;
      })
      .sort((a, b) => {
        if (sort === "score") return (b.latest_score?.total_score ?? 0) - (a.latest_score?.total_score ?? 0);
        if (sort === "discount") {
          const ad = getAppliedDiscountRate(a) ?? -1;
          const bd = getAppliedDiscountRate(b) ?? -1;
          return bd - ad;
        }
        if (sort === "price") return (b.return_price ?? b.source_price ?? 0) - (a.return_price ?? a.source_price ?? 0);
        return b.created_at.localeCompare(a.created_at);
      });
  }, [products, status, category, conditionUnknownOnly, missingAffiliateOnly, publishReadyOnly, publicBlockedOnly, naverPriceNeedsReviewOnly, query, minScore, minPrice, maxPrice, sort, focusProductIds]);

  const reviewStats = useMemo(() => {
    const needsReview = products.filter((product) => product.sourcing_status === "needs_review");
    const publishReady = needsReview.filter(isCustomerPublishReady);
    const linkBackfillNeeded = needsReview.filter((product) => !isProductPublishReady(product));
    const publicBlocked = products.filter(isPublishedPublicBlocked);
    const naverPriceNeedsReview = products.filter((product) => getNaverPriceTrust(product).trustedPrice == null);
    return {
      needsReviewCount: needsReview.length,
      publishReadyCount: publishReady.length,
      linkBackfillNeededCount: linkBackfillNeeded.length,
      publicBlockedCount: publicBlocked.length,
      naverPriceNeedsReviewCount: naverPriceNeedsReview.length
    };
  }, [products]);

  function showReviewQueue() {
    applyCandidateQueue("review");
  }

  function showPublishReadyQueue() {
    applyCandidateQueue("publish_ready");
  }

  function showAffiliateBackfillQueue() {
    applyCandidateQueue("affiliate_backfill");
  }

  function showPublicRepairQueue() {
    applyCandidateQueue("public_repair");
  }

  function showNaverPriceQueue() {
    setFocusProductIds([]);
    setStatus("all");
    setCategory("all");
    setQuery("");
    setMinScore("");
    setMinPrice("");
    setMaxPrice("");
    setConditionUnknownOnly(false);
    setMissingAffiliateOnly(false);
    setPublishReadyOnly(false);
    setPublicBlockedOnly(false);
    setNaverPriceNeedsReviewOnly(true);
    setSelectedProductIds([]);
    setSort("latest");
  }

  const publishReadyFiltered = useMemo(() => filtered.filter(isCustomerPublishReady), [filtered]);
  const selectedPublishReady = useMemo(
    () => publishReadyFiltered.filter((product) => selectedProductIds.includes(product.id)),
    [publishReadyFiltered, selectedProductIds]
  );
  const allPublishReadyFilteredSelected =
    publishReadyFiltered.length > 0 && publishReadyFiltered.every((product) => selectedProductIds.includes(product.id));

  function toggleProductSelection(productId: string) {
    setSelectedProductIds((currentIds) =>
      currentIds.includes(productId) ? currentIds.filter((id) => id !== productId) : [...currentIds, productId]
    );
  }

  function toggleAllPublishReadyFiltered() {
    const readyIds = publishReadyFiltered.map((product) => product.id);
    if (!readyIds.length) return;
    setSelectedProductIds((currentIds) => {
      if (readyIds.every((id) => currentIds.includes(id))) return currentIds.filter((id) => !readyIds.includes(id));
      return Array.from(new Set([...currentIds, ...readyIds]));
    });
  }

  function scrollToTelegramDistribution() {
    const target = document.getElementById("admin-telegram-distribution");
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", "#admin-telegram-distribution");
  }

  async function publishSelectedReady() {
    const targets = selectedPublishReady;
    if (!targets.length) {
      setNotice({ type: "error", message: "먼저 게시 가능한 후보를 선택하세요." });
      return;
    }

    setActionProductId("bulk_publish");
    let successCount = 0;
    const errors: string[] = [];
    try {
      for (const product of targets) {
        const response = await fetch(`/api/admin/products/${product.id}`, {
          method: "PATCH",
          headers: headers(password),
          body: JSON.stringify({ action: "publish" })
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
          errors.push(`${product.title.slice(0, 36)}: ${data.message ?? data.error ?? "게시 실패"}`);
          continue;
        }
        successCount += 1;
      }

      if (successCount > 0) {
        setPublishedActionCount((value) => value + successCount);
      }

      if (errors.length) {
        setNotice({
          type: successCount ? "info" : "error",
          message: `선택 게시 ${successCount}건 완료, ${errors.length}건 실패. ${errors[0]}`
        });
      } else {
        setNotice({ type: "success", message: `선택한 게시 가능 후보 ${successCount}건을 공개했습니다.` });
      }
      setSelectedProductIds((currentIds) => currentIds.filter((id) => !targets.some((product) => product.id === id)));
      await loadProducts();
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 선택 후보 게시를 완료하지 못했습니다." });
    } finally {
      setActionProductId(null);
    }
  }

  async function action(product: ProductWithScore, actionName: string) {
    if (actionName === "publish" && !isUsableAffiliateUrl(product.affiliate_url)) {
      setNotice({ type: "error", message: "게시 전 상품별 쿠팡 파트너스 링크를 먼저 입력하세요." });
      setSelected(product);
      return;
    }
    if (actionName === "publish" && isApprovalSampleAffiliateUrl(product.affiliate_url)) {
      setNotice({ type: "error", message: "승인용 샘플 링크는 심사용 페이지 전용입니다. 이 상품의 상품별 파트너스 링크를 새로 입력하세요." });
      setSelected(product);
      return;
    }
    if (actionName === "publish") {
      const publishReadiness = getCustomerPublishReadiness(product);
      if (!publishReadiness.ready) {
        setNotice({
          type: "error",
          message: `게시 전 ${publishReadiness.blockers.slice(0, 3).join(", ")} 확인이 필요합니다.`
        });
        setSelected(product);
        return;
      }
    }
    setActionProductId(product.id);
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: headers(password),
        body: JSON.stringify({ action: actionName })
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
        setNotice({ type: "error", message: data.message ?? data.error ?? "후보 상태 변경에 실패했습니다." });
        return;
      }
      if (actionName === "publish") {
        setPublishedActionCount((value) => value + 1);
      }
      setNotice({ type: "success", message: "후보 상태를 업데이트했습니다." });
      await loadProducts();
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 후보 상태를 변경하지 못했습니다." });
    } finally {
      setActionProductId(null);
    }
  }

  return (
    <section id="admin-candidate-review" className="scroll-mt-4 space-y-4">
      <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black">후보 검토 대시보드</h2>
          <button className="focus-ring rounded-lg border border-line px-3 py-2 text-sm font-black hover:bg-mist disabled:opacity-60" onClick={loadProducts} disabled={loading} type="button">
            {loading ? "불러오는 중" : "새로고침"}
          </button>
        </div>
        {notice ? (
          <p className={`mb-4 rounded-lg border px-3 py-2 text-sm font-bold ${noticeClassName(notice.type)}`} role="status" aria-live="polite">
            {notice.message}
          </p>
        ) : null}
        {focusProductIds.length ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-pine/30 bg-pine/5 px-3 py-3 text-sm font-bold text-pine" role="status">
            <span>방금 일괄 등록한 후보 {focusProductIds.length.toLocaleString("ko-KR")}개만 표시 중입니다. 각 상품의 공개 품질 blocker를 확인하세요.</span>
            <button
              className="focus-ring rounded-lg border border-pine/30 bg-white px-3 py-2 text-xs font-black text-pine hover:bg-pine/10"
              onClick={() => setFocusProductIds([])}
              type="button"
            >
              전체 검토 큐 보기
            </button>
          </div>
        ) : null}
        {publishedActionCount > 0 ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-pine/30 bg-pine/5 px-3 py-3 text-sm font-bold text-pine">
            <span>{publishedActionCount.toLocaleString("ko-KR")}건 게시 완료. 텔레그램 후보 발송으로 유입을 이어가세요.</span>
            <button
              className="focus-ring rounded-lg bg-pine px-3 py-2 text-xs font-black text-white hover:bg-ink"
              onClick={scrollToTelegramDistribution}
              type="button"
            >
              텔레그램 후보 발송으로 이동
            </button>
          </div>
        ) : null}

        <div className="mb-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <button
            className="focus-ring rounded-lg border border-line bg-mist p-3 text-left hover:border-pine hover:bg-white"
            onClick={showReviewQueue}
            type="button"
          >
            <span className="block text-xs font-black text-steel">검토 대기</span>
            <span className="mt-1 block text-2xl font-black">{reviewStats.needsReviewCount.toLocaleString("ko-KR")}건</span>
            <span className="mt-1 block text-xs font-bold text-steel">승인 전 후보 전체</span>
          </button>
          <button
            className="focus-ring rounded-lg border border-pine/30 bg-pine/5 p-3 text-left text-pine hover:bg-pine/10"
            onClick={showPublishReadyQueue}
            type="button"
          >
            <span className="block text-xs font-black">바로 게시 가능</span>
            <span className="mt-1 block text-2xl font-black">{reviewStats.publishReadyCount.toLocaleString("ko-KR")}건</span>
            <span className="mt-1 block text-xs font-bold">링크와 공개 품질 블로커 없음</span>
          </button>
          <button
            className="focus-ring rounded-lg border border-lemon/60 bg-lemon/20 p-3 text-left text-ink hover:bg-lemon/30"
            onClick={showAffiliateBackfillQueue}
            type="button"
          >
            <span className="block text-xs font-black">링크 보강 필요</span>
            <span className="mt-1 block text-2xl font-black">{reviewStats.linkBackfillNeededCount.toLocaleString("ko-KR")}건</span>
            <span className="mt-1 block text-xs font-bold">게시 전 상품별 링크 확인</span>
          </button>
          <button
            className="focus-ring rounded-lg border border-coral/30 bg-coral/10 p-3 text-left text-coral hover:bg-coral/15"
            onClick={showPublicRepairQueue}
            type="button"
          >
            <span className="block text-xs font-black">공개 보강 대기</span>
            <span className="mt-1 block text-2xl font-black">{reviewStats.publicBlockedCount.toLocaleString("ko-KR")}건</span>
            <span className="mt-1 block text-xs font-bold">게시됐지만 고객 화면 숨김</span>
          </button>
          <button
            className="focus-ring rounded-lg border border-sky/30 bg-sky/5 p-3 text-left text-ink hover:bg-sky/10"
            onClick={showNaverPriceQueue}
            type="button"
          >
            <span className="block text-xs font-black text-sky-800">네이버 가격 보강</span>
            <span className="mt-1 block text-2xl font-black">{reviewStats.naverPriceNeedsReviewCount.toLocaleString("ko-KR")}건</span>
            <span className="mt-1 block text-xs font-bold text-steel">없음·검증 필요</span>
          </button>
        </div>

        <div className="grid gap-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_1fr]">
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
          <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-bold text-steel">
            <input
              checked={missingAffiliateOnly}
              onChange={(event) => {
                setMissingAffiliateOnly(event.target.checked);
                if (event.target.checked) {
                  setPublishReadyOnly(false);
                  setPublicBlockedOnly(false);
                }
              }}
              type="checkbox"
            />
            제휴 링크 보강 필요
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-bold text-steel">
            <input checked={naverPriceNeedsReviewOnly} onChange={(event) => setNaverPriceNeedsReviewOnly(event.target.checked)} type="checkbox" />
            네이버 가격 보강 필요
          </label>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-bold text-steel">
            <input
              checked={publishReadyOnly}
              onChange={(event) => {
                setPublishReadyOnly(event.target.checked);
                if (event.target.checked) {
                  setMissingAffiliateOnly(false);
                  setPublicBlockedOnly(false);
                }
              }}
              type="checkbox"
            />
            게시 가능만 보기
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-bold text-steel">
            <input
              checked={publicBlockedOnly}
              onChange={(event) => {
                setPublicBlockedOnly(event.target.checked);
                if (event.target.checked) {
                  setStatus("published");
                  setPublishReadyOnly(false);
                  setMissingAffiliateOnly(false);
                }
              }}
              type="checkbox"
            />
            공개 보강 대기만 보기
          </label>
          <span className="text-xs font-bold text-steel">현재 조건 {filtered.length.toLocaleString("ko-KR")}건</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-mist px-3 py-2">
          <p className="text-xs font-bold text-steel">
            게시 가능 {publishReadyFiltered.length.toLocaleString("ko-KR")}건 중 {selectedPublishReady.length.toLocaleString("ko-KR")}건 선택
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className="focus-ring rounded-lg border border-line bg-white px-3 py-2 text-xs font-black hover:bg-mist disabled:opacity-50"
              onClick={toggleAllPublishReadyFiltered}
              disabled={!publishReadyFiltered.length || actionProductId === "bulk_publish"}
              type="button"
            >
              {allPublishReadyFilteredSelected ? "게시 가능 선택 해제" : "게시 가능 전체 선택"}
            </button>
            <button
              className="focus-ring rounded-lg bg-ink px-3 py-2 text-xs font-black text-white hover:bg-pine disabled:cursor-not-allowed disabled:opacity-50"
              onClick={publishSelectedReady}
              disabled={!selectedPublishReady.length || actionProductId === "bulk_publish"}
              type="button"
            >
              {actionProductId === "bulk_publish" ? "게시 중" : "선택 승인+게시"}
            </button>
          </div>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="최소 가격" inputMode="numeric" />
          <input className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="최대 가격" inputMode="numeric" />
        </div>

        <div className="mt-4 overflow-auto rounded-lg border border-line">
          <table className="w-full min-w-[1340px] text-left text-sm">
            <thead className="bg-mist text-xs font-black text-steel">
              <tr>
                <th className="px-3 py-2">선택</th>
                <th className="px-3 py-2">상품</th>
                <th className="px-3 py-2">카테고리</th>
                <th className="px-3 py-2">점수</th>
                <th className="px-3 py-2">가격</th>
                <th className="px-3 py-2">네이버 기준가</th>
                <th className="px-3 py-2">할인</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">수익 퍼널 (최근 30일)</th>
                <th className="px-3 py-2">CTA</th>
                <th className="px-3 py-2">수집</th>
                <th className="px-3 py-2">작업</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => {
                const discount = getAppliedDiscountRate(product);
                const quality = getDealQuality(product);
                const naverPriceTrust = getNaverPriceTrust(product);
                const revenue = productMetrics[product.id];
                const approvalSampleAffiliate = isApprovalSampleAffiliateUrl(product.affiliate_url);
                const affiliateReady = isProductPublishReady(product);
                const customerReadiness = getCustomerPublishReadiness(product);
                const publishReady = customerReadiness.ready;
                return (
                  <tr key={product.id} className="border-t border-line align-top">
                    <td className="px-3 py-3">
                      <input
                        aria-label={`${product.title} 선택`}
                        checked={selectedProductIds.includes(product.id)}
                        disabled={!publishReady || actionProductId === "bulk_publish"}
                        onChange={() => toggleProductSelection(product.id)}
                        type="checkbox"
                      />
                    </td>
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
                        {getPublicWebEvidence(product.raw_json) ? <span className="rounded-md bg-lemon/30 px-2 py-1 text-xs font-bold text-amber-800">웹 근거</span> : null}
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
                    <td className="px-3 py-3 font-bold">{formatPrice(product.return_price ?? product.source_price ?? product.new_price)}</td>
                    <td className="px-3 py-3">
                      {naverPriceTrust.trustedPrice != null ? (
                        <>
                          <p className="font-bold text-pine">{formatPrice(naverPriceTrust.trustedPrice)}</p>
                          <p className="mt-1 text-[11px] font-bold text-steel">{naverPriceTrust.label}</p>
                        </>
                      ) : (
                        <>
                          <p className="font-black text-coral">{naverPriceTrust.status === "unverified" ? "검증 필요" : "가격 없음"}</p>
                          <p className="mt-1 max-w-[150px] text-[11px] font-bold leading-4 text-steel">{naverPriceTrust.note}</p>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-3 font-bold">{formatPercent(discount)}</td>
                    <td className="px-3 py-3">{product.sourcing_status}</td>
                    <td className="px-3 py-3 text-xs font-bold text-steel">
                      상세 {revenue?.detail_views ?? 0} · 구매 {revenue?.affiliate_clicks ?? 0}
                      <br />
                      CTA {revenue?.affiliate_ctr ?? 0}% · 세션 {revenue?.session_affiliate_ctr ?? 0}%
                      <br />
                      고유 방문 {revenue?.unique_detail_visitors ?? 0} · 고유 클릭 {revenue?.unique_affiliate_clickers ?? 0}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={
                          publishReady
                            ? "rounded-md bg-pine/10 px-2 py-1 text-xs font-black text-pine"
                            : "rounded-md bg-lemon/30 px-2 py-1 text-xs font-black text-ink"
                        }
                      >
                        {publishReady ? "고객공개 준비" : approvalSampleAffiliate ? "승인용 링크" : affiliateReady ? "품질 확인" : "보강 필요"}
                      </span>
                      {!publishReady && customerReadiness.blockers.length ? (
                        <p className="mt-2 max-w-[180px] text-xs font-bold leading-5 text-steel">
                          {customerReadiness.blockers.slice(0, 2).join(" · ")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">{formatDate(product.created_at)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <a
                          className="focus-ring rounded-md border border-line p-2 hover:bg-mist"
                          title="상세 페이지"
                          href={`/deals/${product.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink size={15} aria-hidden />
                        </a>
                        <button
                          className="focus-ring rounded-md border border-line p-2 hover:bg-mist disabled:cursor-not-allowed disabled:opacity-40"
                          title="승인"
                          onClick={() => action(product, "approve")}
                          disabled={actionProductId === product.id}
                          type="button"
                        >
                          <Check size={15} aria-hidden />
                        </button>
                        <button
                          className="focus-ring rounded-md border border-line p-2 hover:bg-mist disabled:cursor-not-allowed disabled:opacity-40"
                          title={publishReady ? "게시" : approvalSampleAffiliate ? "승인용 샘플 링크는 게시 불가" : "상품별 파트너스 링크 필요"}
                          onClick={() => action(product, "publish")}
                          disabled={!publishReady || actionProductId === product.id}
                          type="button"
                        >
                          <PackageCheck size={15} aria-hidden />
                        </button>
                        <button
                          className="focus-ring rounded-md border border-line p-2 hover:bg-mist disabled:cursor-not-allowed disabled:opacity-40"
                          title="비공개"
                          onClick={() => action(product, "unpublish")}
                          disabled={actionProductId === product.id}
                          type="button"
                        >
                          <EyeOff size={15} aria-hidden />
                        </button>
                        <button
                          className="focus-ring rounded-md border border-line p-2 hover:bg-mist disabled:cursor-not-allowed disabled:opacity-40"
                          title="거절"
                          onClick={() => action(product, "reject")}
                          disabled={actionProductId === product.id}
                          type="button"
                        >
                          <X size={15} aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length ? (
                <tr>
                  <td className="px-3 py-8 text-center font-bold text-steel" colSpan={11}>
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
