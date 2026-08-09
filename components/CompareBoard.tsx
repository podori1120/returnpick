"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Scale, Share2, ShieldCheck, Trash2 } from "lucide-react";
import AffiliateButton from "@/components/AffiliateButton";
import AffiliateInlineDisclosure from "@/components/AffiliateInlineDisclosure";
import AffiliateNotice from "@/components/AffiliateNotice";
import CompareProductPicker, { type CompareProductSuggestion } from "@/components/CompareProductPicker";
import { getStoredJsonArray, setStoredJsonArray, trackAffiliateEvent } from "@/lib/clientTracking";
import { getCoupangOutboundLink } from "@/lib/coupangLink";
import { COMPARE_UUID_PATTERN, compareProductIdsEqual, MAX_COMPARE_ITEMS, normalizeCompareProductId } from "@/lib/compareIdentity";
import { comparePriorityOptions, getCompareDecision, getComparePriority, type ComparePriority } from "@/lib/compareDecision";
import { formatPercent, formatPrice } from "@/lib/format";
import { formatProductSpecSummary } from "@/lib/productSpecs";
import type { PublicDeal } from "@/lib/publicDeal";

type StoredCompareItem = {
  id: string;
  title: string;
};

const storageKey = "returnpick_compare_deals";
const maxCompareItems = MAX_COMPARE_ITEMS;
const uuidPattern = COMPARE_UUID_PATTERN;
const sharedCompareTitle = "공유된 비교 상품";
const priorityStorageKey = "returnpick_compare_priority";

function readCompareItems(): StoredCompareItem[] {
  return getStoredJsonArray<StoredCompareItem>(storageKey).filter(
    (item) => typeof item?.id === "string" && item.id && typeof item?.title === "string" && item.title
  ).map((item) => ({ ...item, id: normalizeCompareProductId(item.id) })).filter((item) => uuidPattern.test(item.id));
}

function readUrlCompareItems(url: URL): StoredCompareItem[] {
  const ids = Array.from(
    new Set(
      (url.searchParams.get("ids") ?? "")
        .split(",")
        .map(normalizeCompareProductId)
        .filter((id) => uuidPattern.test(id))
    )
  ).slice(0, maxCompareItems);

  return ids.map((id) => ({ id, title: sharedCompareTitle }));
}

function mergeCompareItems(sharedItems: StoredCompareItem[], storedItems: StoredCompareItem[]) {
  const seen = new Set<string>();
  return [...sharedItems, ...storedItems]
    .map((item) => ({ ...item, id: normalizeCompareProductId(item.id) }))
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, maxCompareItems);
}

function writeCompareItems(items: StoredCompareItem[]) {
  const normalizedItems = items
    .map((item) => ({ ...item, id: normalizeCompareProductId(item.id) }))
    .filter((item) => uuidPattern.test(item.id));
  setStoredJsonArray(storageKey, normalizedItems);
  try {
    window.dispatchEvent(new Event("returnpick_compare_deals_changed"));
  } catch {
    // Compare storage is a convenience feature. It should not break the page.
  }
}

function valueClass(isBest: boolean) {
  return isBest ? "font-black text-pine" : "font-black text-ink";
}

function getPriceTimingTone(status: PublicDeal["price_timing"]["status"]) {
  if (status === "lowest" || status === "good") {
    return {
      box: "border-pine/20 bg-pine/5",
      label: "text-pine",
      badge: "bg-white text-pine"
    };
  }
  if (status === "unknown") {
    return {
      box: "border-line bg-mist",
      label: "text-ink",
      badge: "bg-white text-ink"
    };
  }
  return {
    box: "border-lemon bg-lemon/15",
    label: "text-ink",
    badge: "bg-white text-ink"
  };
}

function readStoredPriority(): ComparePriority {
  if (typeof window === "undefined") return "balanced";
  try {
    return getComparePriority(window.localStorage.getItem(priorityStorageKey));
  } catch {
    return "balanced";
  }
}

export default function CompareBoard() {
  const [items, setItems] = useState<StoredCompareItem[]>([]);
  const [products, setProducts] = useState<PublicDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [pickerStatus, setPickerStatus] = useState("");
  const [priority, setPriority] = useState<ComparePriority>(() => readStoredPriority());

  useEffect(() => {
    const sharedItems = readUrlCompareItems(new URL(window.location.href));
    const mergedItems = mergeCompareItems(sharedItems, readCompareItems());
    if (sharedItems.length) writeCompareItems(mergedItems);
    setItems(mergedItems);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      const ids = items.map((item) => item.id);
      if (!ids.length) {
        setProducts([]);
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(`/api/products/compare?ids=${encodeURIComponent(ids.join(","))}`, { cache: "no-store" });
        const body = (await response.json().catch(() => ({}))) as { products?: PublicDeal[]; error?: string; message?: string };
        if (cancelled) return;
        if (!response.ok || body.error) {
          setProducts([]);
          setError(body.message ?? body.error ?? "비교 상품 정보를 불러오지 못했습니다.");
          return;
        }
        const loadedProducts = body.products ?? [];
        const updatedItems = items.map((item) => {
          const product = loadedProducts.find((candidate) => compareProductIdsEqual(candidate.id, item.id));
          return product ? { ...item, title: product.title } : item;
        });
        if (updatedItems.some((item, index) => item.title !== items[index]?.title)) writeCompareItems(updatedItems);
        setProducts(loadedProducts);
      } catch {
        if (cancelled) return;
        setProducts([]);
        setError("네트워크 문제로 비교 상품 정보를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const best = useMemo(() => {
    const ready = products.filter((product) => getCoupangOutboundLink(product).isAffiliate);
    const candidates = ready.length ? ready : products;
    const byScore = [...candidates].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null;
    const byPrice = [...products].filter((product) => product.deal_price != null).sort((a, b) => (a.deal_price ?? 0) - (b.deal_price ?? 0))[0] ?? null;
    const byDiscount = [...products].sort((a, b) => (b.discount_rate ?? -1) - (a.discount_rate ?? -1))[0] ?? null;
    return { byScore, byPrice, byDiscount };
  }, [products]);
  const decision = useMemo(() => getCompareDecision(products, priority), [products, priority]);

  const unavailableItems = error ? [] : items.filter((item) => !products.some((product) => compareProductIdsEqual(product.id, item.id)));
  const recommendedProduct = decision.product ?? best.byScore;
  const recommendedOutboundLink = recommendedProduct ? getCoupangOutboundLink(recommendedProduct) : null;
  const shareableProductIds = products
    .filter((product) => uuidPattern.test(product.id))
    .map((product) => product.id);

  function buildShareUrl() {
    if (!shareableProductIds.length) return null;
    const shareUrl = new URL("/compare", window.location.origin);
    shareUrl.searchParams.set("ids", shareableProductIds.join(","));
    return shareUrl.toString();
  }

  async function shareCompare() {
    const shareUrl = buildShareUrl();
    if (!shareUrl) {
      setShareStatus("공개된 비교 상품이 없어 공유할 수 없습니다.");
      return;
    }

    const canUseWebShare = typeof navigator.share === "function";
    try {
      if (canUseWebShare) {
        await navigator.share({
          title: "ReturnPick 비교함",
          text: "ReturnPick에서 비교한 공개 상품입니다.",
          url: shareUrl
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        throw new Error("COMPARE_SHARE_UNAVAILABLE");
      }

      try {
        trackAffiliateEvent({ eventType: "share_copy", channel: "web_compare", context: "compare_share" });
      } catch {
        // Analytics is best-effort and must not block a completed share or copy.
      }
      setShareStatus(canUseWebShare ? "비교 링크를 공유했습니다." : "비교 링크를 복사했습니다.");
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name === "AbortError") {
        setShareStatus("공유를 취소했습니다.");
        return;
      }
      setShareStatus("공유에 실패했습니다. 권한을 확인하거나 잠시 후 다시 시도해 주세요.");
    }
  }

  function removeItem(id: string) {
    const normalizedId = normalizeCompareProductId(id);
    const next = readCompareItems().filter((item) => !compareProductIdsEqual(item.id, normalizedId));
    writeCompareItems(next);
    setItems(next);
  }

  function clearItems() {
    writeCompareItems([]);
    setItems([]);
  }

  function changePriority(nextPriority: ComparePriority) {
    setPriority(nextPriority);
    try {
      window.localStorage.setItem(priorityStorageKey, nextPriority);
    } catch {
      // The preference is optional and must not block comparison.
    }
  }

  function addCompareProduct(product: CompareProductSuggestion) {
    const normalizedId = normalizeCompareProductId(product.id);
    if (!uuidPattern.test(normalizedId)) {
      setPickerStatus("공개 상품 목록에서 선택해 주세요.");
      return;
    }

    const current = readCompareItems();
    if (current.some((item) => compareProductIdsEqual(item.id, normalizedId))) {
      setPickerStatus(`\"${product.title}\"은(는) 이미 비교함에 있습니다.`);
      return;
    }
    if (current.length >= maxCompareItems) {
      setPickerStatus(`비교함은 최대 ${maxCompareItems}개까지 담을 수 있습니다.`);
      return;
    }

    const next = [...current, { id: normalizedId, title: product.title }];
    writeCompareItems(next);
    setItems(next);
    setPickerStatus(`\"${product.title}\"을(를) 비교함에 추가했습니다.`);
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-line bg-white p-8 text-center shadow-soft">
        <Loader2 className="mx-auto animate-spin text-pine" size={28} aria-hidden />
        <p className="mt-3 text-sm font-bold text-steel">비교함을 불러오는 중입니다.</p>
      </div>
    );
  }

  if (!products.length) {
    return (
      <section className="rounded-lg border border-line bg-white p-8 text-center shadow-soft">
        {error ? <AlertTriangle className="mx-auto text-coral" size={34} aria-hidden /> : <Scale className="mx-auto text-pine" size={34} aria-hidden />}
        <h2 className="mt-3 text-xl font-black">
          {error ? "비교 정보를 불러오지 못했습니다" : items.length ? "비교한 상품이 공개 목록에서 사라졌습니다" : "아직 비교할 상품이 없습니다"}
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-steel">
          {error || (items.length ? "비공개되었거나 만료된 상품을 비교함에서 제거한 뒤 새로운 딜을 비교해 보세요." : "딜 목록이나 상세 페이지에서 비교함을 눌러 모아보세요. 공유 링크는 공개 상품을 최대 12개까지 담을 수 있습니다.")}
        </p>
        {unavailableItems.length ? (
          <div className="mx-auto mt-5 max-w-lg rounded-lg border border-lemon bg-lemon/20 p-4 text-left">
            <p className="text-xs font-black text-ink">현재 확인되지 않는 비교 상품 {unavailableItems.length}개</p>
            <ul className="mt-3 space-y-2">
              {unavailableItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 text-sm font-bold text-ink">
                  <span className="min-w-0 truncate">{item.title}</span>
                  <button className="focus-ring shrink-0 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-black text-steel hover:text-pine" onClick={() => removeItem(item.id)} type="button">
                    제거
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mx-auto mt-6 w-full max-w-2xl text-left">
          <CompareProductPicker currentCount={items.length} maxItems={maxCompareItems} onSelect={addCompareProduct} />
          {pickerStatus ? <p className="mt-2 text-xs font-bold text-steel" role="status" aria-live="polite">{pickerStatus}</p> : null}
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link className="focus-ring inline-flex rounded-lg bg-pine px-5 py-3 text-sm font-black text-white hover:bg-ink" href="/deals">
            딜 보러가기
          </Link>
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-4 py-3 text-sm font-black hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!shareableProductIds.length}
            onClick={() => void shareCompare()}
            type="button"
          >
            <Share2 size={16} aria-hidden /> 비교 링크 공유
          </button>
          {items.length ? (
            <button className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-4 py-3 text-sm font-black hover:bg-mist" onClick={clearItems} type="button">
              <Trash2 size={16} aria-hidden /> 비교함 비우기
            </button>
          ) : null}
        </div>
        {shareStatus ? <p className="mt-3 text-xs font-bold text-steel" role="status" aria-live="polite">{shareStatus}</p> : null}
      </section>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-pine">Compare</p>
            <h2 className="text-xl font-black">구매 전 최종 비교</h2>
            <p className="mt-1 text-sm font-semibold text-steel">점수, 가격 차이, 반품등급, 제휴 링크 준비 상태를 한 화면에서 봅니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-black hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!shareableProductIds.length}
              onClick={() => void shareCompare()}
              type="button"
            >
              <Share2 size={16} aria-hidden /> 비교 링크 공유
            </button>
            <button className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-black hover:bg-mist" onClick={clearItems} type="button">
              <Trash2 size={16} aria-hidden /> 모두 비우기
            </button>
          </div>
        </div>
        {shareStatus ? <p className="mt-2 text-xs font-bold text-steel" role="status" aria-live="polite">{shareStatus}</p> : null}
        {unavailableItems.length ? (
          <div className="mt-4 rounded-lg border border-lemon bg-lemon/20 p-3" role="status">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-black text-ink">비공개되었거나 만료된 비교 상품 {unavailableItems.length}개</p>
              <button className="focus-ring rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-black text-steel hover:text-pine" onClick={() => unavailableItems.forEach((item) => removeItem(item.id))} type="button">
                확인되지 않는 상품 제거
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-steel">
              {unavailableItems.map((item) => <span key={item.id} className="rounded-md bg-white px-2.5 py-1">{item.title}</span>)}
            </div>
          </div>
        ) : null}
        <div className="mt-5 text-left">
          <CompareProductPicker currentCount={items.length} maxItems={maxCompareItems} onSelect={addCompareProduct} />
          {pickerStatus ? <p className="mt-2 text-xs font-bold text-steel" role="status" aria-live="polite">{pickerStatus}</p> : null}
        </div>
        <fieldset className="mt-5 rounded-lg border border-line bg-mist p-3">
          <legend className="px-1 text-xs font-black text-pine">어떤 기준으로 고를까요?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {comparePriorityOptions.map((option) => (
              <label key={option.id} className="focus-within:ring-2 focus-within:ring-pine/30 cursor-pointer rounded-lg border border-line bg-white p-3 has-[:checked]:border-pine has-[:checked]:bg-pine/5">
                <input
                  className="sr-only"
                  checked={priority === option.id}
                  name="compare-priority"
                  onChange={() => changePriority(option.id)}
                  type="radio"
                  value={option.id}
                />
                <span className="flex items-center gap-2 text-sm font-black text-ink">
                  {option.id === "return_safety" ? <ShieldCheck size={16} className="text-pine" aria-hidden /> : null}
                  {option.label}
                </span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-steel">{option.description}</span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs font-bold leading-5 text-steel" role="status" aria-live="polite">
            {decision.label}: {decision.reason}
          </p>
        </fieldset>
        {best.byScore && recommendedProduct ? (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-pine/10 p-4">
                <p className="text-xs font-black text-pine">리턴픽 추천</p>
                <p className="mt-1 line-clamp-2 text-sm font-black">{best.byScore.title}</p>
                <p className="mt-2 text-2xl font-black text-pine">{best.byScore.score ?? 0}점</p>
              </div>
              <div className="rounded-lg bg-mist p-4">
                <p className="text-xs font-black text-steel">최저 구매가</p>
                <p className="mt-1 line-clamp-2 text-sm font-black">{best.byPrice?.title ?? "-"}</p>
                <p className="mt-2 text-2xl font-black">{formatPrice(best.byPrice?.deal_price)}</p>
              </div>
              <div className="rounded-lg bg-mist p-4">
                <p className="text-xs font-black text-steel">최대 할인율</p>
                <p className="mt-1 line-clamp-2 text-sm font-black">{best.byDiscount?.title ?? "-"}</p>
                <p className="mt-2 text-2xl font-black">{formatPercent(best.byDiscount?.discount_rate)}</p>
              </div>
            </div>
            <div className="rounded-lg border border-pine/30 bg-pine/5 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-black text-pine">비교 후 다음 단계</p>
                  <p className="mt-1 text-sm font-black">{decision.label} 기준 후보: {recommendedProduct.title}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-steel">{decision.reason}</p>
                  <Link className="focus-ring mt-2 inline-flex text-xs font-black text-pine underline decoration-pine/30 underline-offset-4 hover:text-ink" href={recommendedProduct.detail_url}>
                    추천 이유와 확인 항목 보기
                  </Link>
                </div>
                <AffiliateButton
                  productId={recommendedProduct.id}
                  href={recommendedOutboundLink?.href}
                  label="쿠팡에서 추천 상품 가격 확인"
                  disabledLabel="링크 확인필요 · 구매 전 확인"
                  sponsored={recommendedOutboundLink?.isAffiliate}
                  channel="compare"
                  context="compare"
                  placement="compare_recommended"
                  className="focus-ring inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-pine px-4 py-3 text-sm font-black text-white hover:bg-ink sm:w-auto"
                />
              </div>
              <p className="mt-3 text-xs font-semibold leading-5 text-steel">
                {recommendedOutboundLink?.isAffiliate
                  ? <>이 페이지의 일부 링크는 제휴 링크이며, 구매가 발생하면 운영자가 수수료를 받을 수 있습니다. 가격과 재고, 반품등급은 수시로 변동될 수 있습니다. <Link className="font-black text-pine underline" href="/disclosure">제휴 안내</Link></>
                  : <>상품별 파트너스 링크가 확인되기 전에는 구매 버튼을 활성화하지 않습니다. <Link className="font-black text-pine underline" href="/disclosure">제휴 안내</Link></>}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {products.map((product) => {
          const outboundLink = getCoupangOutboundLink(product);
          const priceTimingTone = getPriceTimingTone(product.price_timing.status);
          return (
          <article key={product.id} className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
            <Link href={product.detail_url} className="block">
              <div className="aspect-[16/10] bg-line">
                {product.image_url ? (
                  <img className="h-full w-full object-cover" src={product.image_url} alt={product.title} />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-bold text-steel">ReturnPick</div>
                )}
              </div>
            </Link>
            <div className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black text-pine">{product.category_label}</p>
                  <Link className="mt-1 line-clamp-2 font-black hover:text-pine" href={product.detail_url}>
                    {product.title}
                  </Link>
                </div>
                <button className="focus-ring rounded-md border border-line p-2 text-steel hover:bg-mist" onClick={() => removeItem(product.id)} type="button" aria-label="비교함에서 제거">
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-mist p-3">
                  <p className="text-xs font-bold text-steel">점수</p>
                  <p className={valueClass(Boolean(best.byScore && compareProductIdsEqual(best.byScore.id, product.id)))}>{product.score ?? 0}점</p>
                </div>
                <div className="rounded-lg bg-mist p-3">
                  <p className="text-xs font-bold text-steel">할인율</p>
                  <p className={valueClass(Boolean(best.byDiscount && compareProductIdsEqual(best.byDiscount.id, product.id)))}>{formatPercent(product.discount_rate)}</p>
                </div>
                <div className="rounded-lg bg-mist p-3">
                  <p className="text-xs font-bold text-steel">구매가</p>
                  <p className={valueClass(Boolean(best.byPrice && compareProductIdsEqual(best.byPrice.id, product.id)))}>{formatPrice(product.deal_price)}</p>
                </div>
                <div className="rounded-lg bg-mist p-3">
                  <p className="text-xs font-bold text-steel">반품등급</p>
                  <p className="font-black">{product.condition_grade}</p>
                </div>
              </div>
              <div className={`min-w-0 rounded-lg border p-3 ${priceTimingTone.box}`} data-price-timing={product.price_timing.status}>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <p className={`text-xs font-black ${priceTimingTone.label}`}>가격 시점</p>
                  <span className={`max-w-full rounded-md px-2 py-1 text-xs font-black ${priceTimingTone.badge}`}>{product.price_timing.label}</span>
                </div>
                <p className="mt-1 break-words text-xs font-bold leading-5 text-steel">{product.price_timing.description}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-bold text-steel">
                  {product.price_timing.average_price != null ? <span>관찰 평균 {formatPrice(product.price_timing.average_price)}</span> : null}
                  {product.price_timing.lowest_price != null ? <span>관찰 최저 {formatPrice(product.price_timing.lowest_price)}</span> : null}
                  <span>동일 기준 관찰 {product.price_timing.sample_count}회</span>
                </div>
              </div>
              <div className="rounded-lg border border-line p-3 text-xs font-bold leading-5 text-steel">
                {product.primary_use_case ? product.primary_use_case.reason : product.reasons[0] ?? "상세 페이지에서 추천 이유와 위험 플래그를 확인하세요."}
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-black">
                {outboundLink.isAffiliate ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-pine/10 px-2.5 py-1 text-pine">
                    <CheckCircle2 size={14} aria-hidden /> CTA 준비
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-lemon/30 px-2.5 py-1 text-ink">
                    <AlertTriangle size={14} aria-hidden /> 링크 확인필요
                  </span>
                )}
                <span className="rounded-md bg-mist px-2.5 py-1 text-steel">위험 {product.risk_flags.length}</span>
                <span className="rounded-md bg-mist px-2.5 py-1 text-steel">재고 {product.stock_count ?? "확인필요"}</span>
              </div>
              <AffiliateButton
                productId={product.id}
                href={outboundLink.href}
                label={outboundLink.label}
                disabledLabel="링크 확인필요 · 구매 전 확인"
                sponsored={outboundLink.isAffiliate}
                channel="compare"
                context="compare"
                placement="compare_card"
              />
              {outboundLink.isAffiliate ? <AffiliateInlineDisclosure className="mt-2" /> : null}
            </div>
          </article>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <div className="max-w-full overflow-x-auto overscroll-x-contain" aria-label="상품 비교표. 좌우로 밀어 더 많은 비교 항목을 확인할 수 있습니다.">
          <table className="min-w-[820px] w-full text-left text-sm">
            <thead className="bg-mist text-xs font-black text-steel">
              <tr>
                <th className="p-3">항목</th>
                {products.map((product) => (
                  <th key={product.id} className="p-3">{product.title}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[
                ["점수", (product: PublicDeal) => `${product.score ?? 0}점`],
                ["판정", (product: PublicDeal) => product.verdict ?? "판정대기"],
                ["구매가", (product: PublicDeal) => formatPrice(product.deal_price)],
                ["가격 시점", (product: PublicDeal) => product.price_timing.status === "unknown" ? "확인필요" : product.price_timing.label],
                ["기준가", (product: PublicDeal) => formatPrice(product.reference_price)],
                ["할인율", (product: PublicDeal) => formatPercent(product.discount_rate)],
                ["반품등급", (product: PublicDeal) => product.condition_grade],
                ["핵심 사양", (product: PublicDeal) => formatProductSpecSummary(product) || "상품명에서 확인할 사양 없음"],
                ["검수", (product: PublicDeal) => `${product.quality.label} ${product.quality.confidence}`],
                ["위험 플래그", (product: PublicDeal) => `${product.risk_flags.length}개`],
                ["제휴 링크", (product: PublicDeal) => (getCoupangOutboundLink(product).isAffiliate ? "준비됨" : "확인필요")]
              ].map(([label, getter]) => (
                <tr key={String(label)}>
                  <th className="w-28 bg-mist/50 p-3 text-xs font-black text-steel">{String(label)}</th>
                  {products.map((product) => (
                    <td key={product.id} className="p-3 font-bold">{(getter as (product: PublicDeal) => string)(product)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <AffiliateNotice />
    </div>
  );
}
