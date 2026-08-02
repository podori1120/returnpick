"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Heart, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import AffiliateButton from "@/components/AffiliateButton";
import AffiliateNotice from "@/components/AffiliateNotice";
import SavedDealButton from "@/components/SavedDealButton";
import { getCoupangOutboundLink } from "@/lib/coupangLink";
import { getSavedDealItems, savedDealsChangeEvent, setSavedDealItems, type SavedDealItem } from "@/lib/clientTracking";
import { formatDate, formatPercent, formatPrice } from "@/lib/format";
import type { PublicDeal } from "@/lib/publicDeal";

export default function SavedDealsBoard() {
  const [items, setItems] = useState<SavedDealItem[]>([]);
  const [products, setProducts] = useState<PublicDeal[]>([]);
  const [removedCount, setRemovedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    function sync() {
      setItems(getSavedDealItems());
    }

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(savedDealsChangeEvent, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(savedDealsChangeEvent, sync);
    };
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      setRemovedCount(0);
      if (!items.length) {
        setProducts([]);
        setLoading(false);
        return;
      }

      try {
        const ids = items.map((item) => item.id);
        const response = await fetch(`/api/products/compare?ids=${encodeURIComponent(ids.join(","))}`, { cache: "no-store" });
        const body = (await response.json().catch(() => ({}))) as { products?: PublicDeal[]; error?: string; message?: string };
        if (!response.ok || body.error) {
          setProducts([]);
          setError(body.message ?? body.error ?? "찜한 딜을 불러오지 못했습니다.");
          return;
        }
        setProducts(body.products ?? []);
        setRemovedCount(Math.max(0, ids.length - (body.products?.length ?? 0)));
      } catch {
        setProducts([]);
        setError("네트워크 문제로 찜한 딜을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [items]);

  function clearAll() {
    setSavedDealItems([]);
    setItems([]);
  }

  function removeItem(id: string) {
    const next = getSavedDealItems().filter((item) => item.id !== id);
    setSavedDealItems(next);
    setItems(next);
  }

  const unavailableItems = error ? [] : items.filter((item) => !products.some((product) => product.id === item.id));

  function getChangeNotice(product: PublicDeal) {
    const observedAt = product.change_summary.observed_at;
    if (!observedAt) {
      return {
        className: "border-line bg-mist text-steel",
        label: "관찰 기록 없음",
        detail: "가격·재고 변동을 판단할 자동 관찰 기록이 없습니다. 구매 전 쿠팡에서 다시 확인하세요."
      };
    }

    const savedAt = items.find((item) => item.id === product.id)?.savedAt;
    const observedMs = new Date(observedAt).getTime();
    const savedMs = savedAt ? new Date(savedAt).getTime() : Number.NaN;
    const observedAfterSave = Number.isFinite(observedMs) && Number.isFinite(savedMs) && observedMs > savedMs;
    const labels = product.change_summary.labels.join(", ");

    if (observedAfterSave && product.change_summary.has_change) {
      return {
        className: "border-lemon bg-lemon/20 text-ink",
        label: "저장 후 변동 확인",
        detail: `${labels || "가격·재고 조건"} · ${formatDate(observedAt)} 관찰`
      };
    }

    if (product.change_summary.has_change) {
      return {
        className: "border-line bg-mist text-steel",
        label: "최근 변동 기록",
        detail: `${labels || "조건 변동"} · ${formatDate(observedAt)} 관찰`
      };
    }

    return {
      className: "border-line bg-mist text-steel",
      label: "최근 관찰",
      detail: `${formatDate(observedAt)} 기준으로 확인된 상품입니다.`
    };
  }

  function removeUnavailableItems() {
    const unavailableIds = new Set(unavailableItems.map((item) => item.id));
    const next = getSavedDealItems().filter((item) => !unavailableIds.has(item.id));
    setSavedDealItems(next);
    setItems(next);
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-line bg-white p-8 text-center shadow-soft">
        <Loader2 className="mx-auto animate-spin text-pine" size={28} aria-hidden />
        <p className="mt-3 text-sm font-bold text-steel">찜한 딜을 불러오는 중입니다.</p>
      </div>
    );
  }

  if (!items.length) {
    return (
      <section className="rounded-lg border border-line bg-white p-8 text-center shadow-soft">
        <Heart className="mx-auto text-pine" size={34} aria-hidden />
        <h2 className="mt-3 text-xl font-black">아직 찜한 딜이 없습니다</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-steel">딜 목록에서 마음에 드는 상품을 저장해 두면 다시 방문했을 때 가격과 구매 조건을 바로 확인할 수 있습니다.</p>
        <Link className="focus-ring mt-5 inline-flex rounded-lg bg-pine px-5 py-3 text-sm font-black text-white hover:bg-ink" href="/deals">
          딜 보러가기
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-pine">Saved Deals</p>
            <h2 className="text-xl font-black">찜한 딜 {items.length}개</h2>
            <p className="mt-1 text-sm font-semibold text-steel">가격과 재고는 변동될 수 있으니 구매 전에 쿠팡에서 다시 확인하세요.</p>
          </div>
          <button className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-black hover:bg-mist" onClick={clearAll} type="button">
            <Trash2 size={16} aria-hidden /> 모두 비우기
          </button>
        </div>
        {removedCount ? (
          <p className="mt-4 rounded-lg border border-lemon bg-lemon/20 px-3 py-2 text-xs font-bold leading-5 text-ink" role="status">
            비공개되었거나 만료된 {removedCount}개 상품은 현재 목록에서 제외했습니다.
          </p>
        ) : null}
        {unavailableItems.length ? (
          <div className="mt-4 rounded-lg border border-lemon bg-lemon/20 p-3" role="status">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-black text-ink">확인되지 않는 찜한 상품 {unavailableItems.length}개</p>
              <button className="focus-ring rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-black text-steel hover:text-pine" onClick={removeUnavailableItems} type="button">
                확인되지 않는 상품 제거
              </button>
            </div>
            <ul className="mt-2 space-y-2">
              {unavailableItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 text-xs font-bold text-ink">
                  <span className="min-w-0 truncate">{item.title}</span>
                  <button className="focus-ring shrink-0 rounded-md border border-line bg-white px-2.5 py-1.5 font-black text-steel hover:text-pine" onClick={() => removeItem(item.id)} type="button">
                    제거
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-lg border border-coral/30 bg-coral/10 px-3 py-2 text-sm font-bold text-coral" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {products.length ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => {
            const outboundLink = getCoupangOutboundLink(product);
            return (
              <article className="overflow-hidden rounded-lg border border-line bg-white shadow-soft" key={product.id}>
                <Link className="block" href={product.detail_url}>
                  <div className="aspect-[16/10] bg-line">
                    {product.image_url ? <img className="h-full w-full object-cover" src={product.image_url} alt={product.title} /> : <div className="flex h-full items-center justify-center text-sm font-bold text-steel">ReturnPick</div>}
                  </div>
                </Link>
                <div className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-pine">{product.category_label}</p>
                      <Link className="mt-1 line-clamp-2 text-base font-black leading-6 hover:text-pine" href={product.detail_url}>{product.title}</Link>
                    </div>
                    <SavedDealButton productId={product.id} title={product.title} />
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-black">
                    <span className="rounded-md bg-pine/10 px-2.5 py-1 text-pine"><CheckCircle2 className="mr-1 inline" size={14} aria-hidden />{product.quality.label}</span>
                    <span className="rounded-md bg-mist px-2.5 py-1 text-steel">{product.condition_grade}</span>
                    {product.risk_flags.length ? <span className="rounded-md bg-coral/10 px-2.5 py-1 text-coral"><AlertTriangle className="mr-1 inline" size={14} aria-hidden />주의 {product.risk_flags.length}</span> : null}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div><p className="text-xs font-bold text-steel">구매가</p><p className="font-black">{formatPrice(product.deal_price)}</p></div>
                    <div><p className="text-xs font-bold text-steel">할인율</p><p className="font-black">{formatPercent(product.discount_rate)}</p></div>
                    <div><p className="text-xs font-bold text-steel">점수</p><p className="font-black">{product.score ?? 0}점</p></div>
                  </div>
                  {(() => {
                    const notice = getChangeNotice(product);
                    return (
                      <div className={`rounded-md border px-3 py-2 text-xs font-bold leading-5 ${notice.className}`} role="status">
                        <p className="font-black">{notice.label}</p>
                        <p className="mt-0.5">{notice.detail}</p>
                      </div>
                    );
                  })()}
                  <div className="flex flex-wrap gap-2">
                    <Link className="focus-ring min-w-[140px] flex-1 rounded-lg border border-line px-3 py-2.5 text-center text-sm font-black hover:bg-mist" href={product.detail_url}>상세 확인</Link>
                    <AffiliateButton productId={product.id} href={outboundLink.href} label={outboundLink.label} sponsored={outboundLink.isAffiliate} channel="saved" context="saved" className="focus-ring min-w-[160px] flex-1 rounded-lg bg-pine px-3 py-2.5 text-center text-sm font-black text-white hover:bg-ink" />
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="rounded-lg border border-line bg-white p-6 text-center shadow-soft">
          <p className="text-sm font-bold text-steel">현재 공개된 찜한 딜이 없습니다.</p>
          <Link className="focus-ring mt-4 inline-flex rounded-lg border border-line px-4 py-2 text-sm font-black hover:bg-mist" href="/deals">공개 딜 다시 보기</Link>
        </section>
      )}

      <AffiliateNotice />
    </div>
  );
}
