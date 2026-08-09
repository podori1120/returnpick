"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, RefreshCw, Target, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AffiliateButton from "@/components/AffiliateButton";
import AffiliateInlineDisclosure from "@/components/AffiliateInlineDisclosure";
import { getCoupangOutboundLink } from "@/lib/coupangLink";
import { formatDate, formatPrice } from "@/lib/format";
import { evaluatePriceWatch, getPriceWatchItems, getPriceWatchPriceDelta, maxPriceWatches, priceWatchChangeEvent, removePriceWatch, setPriceWatchItems, type PriceWatchItem } from "@/lib/priceWatch";
import type { PublicDeal } from "@/lib/publicDeal";

type CompareResponse = {
  products?: PublicDeal[];
  message?: string;
  error?: string;
};

function getWatchStatus(currentPrice: number | null, targetPrice: number) {
  const status = evaluatePriceWatch(currentPrice, targetPrice);
  if (status === "hit") {
    return {
      tone: "border-pine bg-pine/10 text-pine",
      icon: CheckCircle2,
      label: "목표가 도달",
      detail: `현재가 ${formatPrice(currentPrice)}가 내가 정한 가격 이하입니다.`
    };
  }
  if (status === "above" && currentPrice != null) {
    return {
      tone: "border-lemon bg-lemon/20 text-ink",
      icon: Target,
      label: "목표가 기다리는 중",
      detail: `현재가 ${formatPrice(currentPrice)} · 목표가까지 ${formatPrice(currentPrice - targetPrice)} 차이`
    };
  }
  return {
    tone: "border-line bg-mist text-steel",
    icon: AlertTriangle,
    label: "현재가 확인필요",
    detail: "현재 가격이 확인되면 목표가와 다시 비교할 수 있습니다."
  };
}

export default function PriceWatchBoard() {
  const [items, setItems] = useState<PriceWatchItem[]>([]);
  const [products, setProducts] = useState<PublicDeal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  useEffect(() => {
    function sync() {
      setItems(getPriceWatchItems());
    }

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(priceWatchChangeEvent, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(priceWatchChangeEvent, sync);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setError("");
      if (!items.length) {
        setProducts([]);
        setLoading(false);
        setLastCheckedAt(null);
        return;
      }

      setLoading(true);
      setProducts([]);
      try {
        const ids = items.map((item) => item.productId).join(",");
        const response = await fetch(`/api/products/compare?ids=${encodeURIComponent(ids)}`, { cache: "no-store" });
        const body = (await response.json().catch(() => ({}))) as CompareResponse;
        if (!response.ok || body.error) {
          if (active) {
            setError(body.message ?? body.error ?? "가격 기준 상품을 불러오지 못했습니다.");
            setProducts([]);
          }
          return;
        }
        if (active) {
          setProducts(body.products ?? []);
          setLastCheckedAt(new Date().toISOString());
        }
      } catch {
        if (active) {
          setError("네트워크 문제로 가격 기준 상품을 불러오지 못했습니다.");
          setProducts([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [items, refreshKey]);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const unavailableItems = items.filter((item) => !productMap.has(item.productId));

  function clearAll() {
    setPriceWatchItems([]);
    setItems([]);
    setProducts([]);
  }

  function removeItem(productId: string) {
    removePriceWatch(productId);
    setItems(getPriceWatchItems());
  }

  if (loading && !items.length) {
    return (
      <div className="rounded-lg border border-line bg-white p-8 text-center shadow-soft">
        <Loader2 className="mx-auto animate-spin text-pine" size={28} aria-hidden />
        <p className="mt-3 text-sm font-bold text-steel">가격 기준을 불러오는 중입니다.</p>
      </div>
    );
  }

  if (!items.length) {
    return (
      <section className="rounded-lg border border-line bg-white p-8 shadow-soft">
        <div className="mx-auto max-w-2xl text-center">
          <Target className="mx-auto text-pine" size={36} aria-hidden />
          <h2 className="mt-3 text-xl font-black">아직 저장한 가격 기준이 없습니다</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-steel">
            상품 상세에서 내가 사고 싶은 상한가를 저장해 두면, 다음 방문 때 최신 확인값과 바로 비교할 수 있습니다. 로그인 없이 이 브라우저에만 저장됩니다.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-5 py-3 text-sm font-black text-white hover:bg-ink" href="/deals">
              딜 찾아보기 <ArrowRight size={16} aria-hidden />
            </Link>
            <Link className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-5 py-3 text-sm font-black hover:bg-mist" href="/recommend">
              용도별 추천 보기
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-white p-4 shadow-soft sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-pine">Browser Price Watch</p>
            <h2 className="mt-1 text-xl font-black">저장한 가격 기준 {items.length}개</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-steel">
              로그인 없이 이 브라우저에만 저장합니다. 자동 문자·푸시·이메일 알림은 보내지 않으므로, 아래 버튼으로 현재 확인가를 다시 조회하세요.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button aria-label="저장한 상품의 최신 확인가 다시 조회" className="focus-ring inline-flex items-center gap-2 rounded-lg border border-pine/30 px-4 py-2 text-sm font-black text-pine hover:bg-pine/5 disabled:cursor-not-allowed disabled:opacity-50" disabled={loading} onClick={() => setRefreshKey((value) => value + 1)} title="최신 확인가 다시 조회" type="button">
              <RefreshCw className={loading ? "animate-spin" : ""} size={16} aria-hidden /> 다시 확인
            </button>
            <button className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-black hover:bg-mist" onClick={clearAll} type="button">
              <Trash2 size={16} aria-hidden /> 모두 비우기
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-steel">
          <span className="rounded-md bg-mist px-2.5 py-1.5">최대 {maxPriceWatches}개 저장</span>
          <Link className="rounded-md bg-pine/10 px-2.5 py-1.5 text-pine hover:text-ink" href="/deals">새 딜 찾기</Link>
          {lastCheckedAt ? <span className="rounded-md bg-mist px-2.5 py-1.5">화면 확인 {formatDate(lastCheckedAt)}</span> : null}
        </div>
        {loading ? <p className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line bg-mist px-3 py-2 text-xs font-bold text-steel" role="status"><Loader2 className="animate-spin" size={14} aria-hidden /> 공개 상품의 최신 확인값을 불러오는 중입니다.</p> : null}
        {error ? <p className="mt-4 rounded-lg border border-coral/30 bg-coral/10 px-3 py-2 text-sm font-bold text-coral" role="alert">{error}</p> : null}
        {!loading && !error && unavailableItems.length ? (
          <div className="mt-4 rounded-lg border border-lemon bg-lemon/20 p-3" role="status">
            <p className="text-xs font-black text-ink">현재 공개 목록에서 다시 확인되지 않는 상품 {unavailableItems.length}개</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-steel">비공개·품절·오래된 관찰 상태일 수 있습니다. 확인되지 않은 가격을 목표가 도달로 표시하지 않습니다.</p>
            <ul className="mt-2 space-y-2">
              {unavailableItems.map((item) => (
                <li className="flex items-center justify-between gap-3 text-xs font-bold text-ink" key={item.productId}>
                  <span className="min-w-0 truncate">{item.title}</span>
                  <button className="focus-ring shrink-0 rounded-md border border-line bg-white px-2.5 py-1.5 font-black text-steel hover:text-pine" onClick={() => removeItem(item.productId)} type="button">제거</button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2" aria-label="저장한 가격 기준 목록">
        {items.map((item) => {
          const product = productMap.get(item.productId);
          if (!product) return null;

          const currentPrice = product.deal_price;
          const status = getWatchStatus(currentPrice, item.targetPrice);
          const StatusIcon = status.icon;
          const outboundLink = getCoupangOutboundLink(product);
          const priceDelta = getPriceWatchPriceDelta(currentPrice, item.baselinePrice);

          return (
            <article className="overflow-hidden rounded-lg border border-line bg-white shadow-soft" key={item.productId}>
              <Link className="block" href={product.detail_url}>
                <div className="aspect-[16/8] bg-line">
                  {product.image_url ? <img className="h-full w-full object-cover" src={product.image_url} alt={product.title} /> : <div className="flex h-full items-center justify-center text-sm font-bold text-steel">ReturnPick</div>}
                </div>
              </Link>
              <div className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-pine">{product.category_label}</p>
                    <Link className="mt-1 line-clamp-2 text-base font-black leading-6 hover:text-pine" href={product.detail_url}>{product.title}</Link>
                  </div>
                  <button aria-label={`${product.title} 가격 기준 삭제`} className="focus-ring shrink-0 rounded-md p-2 text-steel hover:bg-mist hover:text-coral" onClick={() => removeItem(product.id)} title="가격 기준 삭제" type="button">
                    <Trash2 size={17} aria-hidden />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-mist p-3">
                    <p className="text-xs font-bold text-steel">내 목표가</p>
                    <p className="mt-1 font-black">{formatPrice(item.targetPrice)}</p>
                  </div>
                  <div className="rounded-md bg-mist p-3">
                    <p className="text-xs font-bold text-steel">현재 확인가</p>
                    <p className="mt-1 font-black">{formatPrice(currentPrice)}</p>
                    {priceDelta !== null ? <p className={`mt-1 text-[11px] font-bold ${priceDelta < 0 ? "text-pine" : priceDelta > 0 ? "text-coral" : "text-steel"}`}>{priceDelta === 0 ? "저장 당시와 동일" : `저장 당시 대비 ${priceDelta < 0 ? "하락" : "상승"} ${formatPrice(Math.abs(priceDelta))}`}</p> : null}
                  </div>
                </div>

                <div className={`rounded-lg border px-3 py-3 text-sm font-bold leading-5 ${status.tone}`} role="status">
                  <p className="flex items-center gap-2 font-black"><StatusIcon size={16} aria-hidden /> {status.label}</p>
                  <p className="mt-1">{status.detail}</p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-bold text-steel">
                  <span className="rounded-md bg-mist px-2.5 py-1.5">반품등급 {product.condition_grade}</span>
                  <span className="rounded-md bg-mist px-2.5 py-1.5">{product.change_summary.observed_at ? `${formatDate(product.change_summary.observed_at)} 관찰` : "관찰 시점 확인필요"}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link className="focus-ring inline-flex min-w-[140px] flex-1 items-center justify-center rounded-lg border border-line px-3 py-2.5 text-sm font-black hover:bg-mist" href={product.detail_url}>상세에서 기준 변경</Link>
                  <AffiliateButton productId={product.id} href={outboundLink.href} label={outboundLink.label} sponsored={outboundLink.isAffiliate} channel="watchlist" context="watchlist" placement="watchlist_card" className="focus-ring inline-flex min-w-[150px] flex-1 items-center justify-center rounded-lg bg-pine px-3 py-2.5 text-sm font-black text-white hover:bg-ink" />
                </div>
                {outboundLink.isAffiliate ? <AffiliateInlineDisclosure className="mt-1" /> : <p className="text-xs font-semibold leading-5 text-steel">상품별 파트너스 링크가 확인되기 전에는 구매 버튼을 활성화하지 않습니다.</p>}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
