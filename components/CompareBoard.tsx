"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Scale, Trash2 } from "lucide-react";
import AffiliateButton from "@/components/AffiliateButton";
import AffiliateNotice from "@/components/AffiliateNotice";
import { getStoredJsonArray, setStoredJsonArray } from "@/lib/clientTracking";
import { getCoupangOutboundLink } from "@/lib/coupangLink";
import { formatPercent, formatPrice } from "@/lib/format";
import type { PublicDeal } from "@/lib/publicDeal";

type StoredCompareItem = {
  id: string;
  title: string;
};

const storageKey = "returnpick_compare_deals";

function readCompareItems(): StoredCompareItem[] {
  return getStoredJsonArray<StoredCompareItem>(storageKey).filter((item) => item.id && item.title);
}

function writeCompareItems(items: StoredCompareItem[]) {
  setStoredJsonArray(storageKey, items);
  try {
    window.dispatchEvent(new Event("returnpick_compare_deals_changed"));
  } catch {
    // Compare storage is a convenience feature. It should not break the page.
  }
}

function valueClass(isBest: boolean) {
  return isBest ? "font-black text-pine" : "font-black text-ink";
}

export default function CompareBoard() {
  const [items, setItems] = useState<StoredCompareItem[]>([]);
  const [products, setProducts] = useState<PublicDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(readCompareItems());
  }, []);

  useEffect(() => {
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
        if (!response.ok || body.error) {
          setProducts([]);
          setError(body.message ?? body.error ?? "비교 상품 정보를 불러오지 못했습니다.");
          return;
        }
        setProducts(body.products ?? []);
      } catch {
        setProducts([]);
        setError("네트워크 문제로 비교 상품 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [items]);

  const best = useMemo(() => {
    const ready = products.filter((product) => getCoupangOutboundLink(product).isAffiliate);
    const candidates = ready.length ? ready : products;
    const byScore = [...candidates].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null;
    const byPrice = [...products].filter((product) => product.deal_price != null).sort((a, b) => (a.deal_price ?? 0) - (b.deal_price ?? 0))[0] ?? null;
    const byDiscount = [...products].sort((a, b) => (b.discount_rate ?? -1) - (a.discount_rate ?? -1))[0] ?? null;
    return { byScore, byPrice, byDiscount };
  }, [products]);

  const unavailableItems = error ? [] : items.filter((item) => !products.some((product) => product.id === item.id));

  function removeItem(id: string) {
    const next = readCompareItems().filter((item) => item.id !== id);
    writeCompareItems(next);
    setItems(next);
  }

  function clearItems() {
    writeCompareItems([]);
    setItems([]);
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
          {error || (items.length ? "비공개되었거나 만료된 상품을 비교함에서 제거한 뒤 새로운 딜을 비교해 보세요." : "딜 목록이나 상세 페이지에서 비교함을 눌러 최대 6개까지 모아볼 수 있습니다.")}
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
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link className="focus-ring inline-flex rounded-lg bg-pine px-5 py-3 text-sm font-black text-white hover:bg-ink" href="/deals">
            딜 보러가기
          </Link>
          {items.length ? (
            <button className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-4 py-3 text-sm font-black hover:bg-mist" onClick={clearItems} type="button">
              <Trash2 size={16} aria-hidden /> 비교함 비우기
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-pine">Compare</p>
            <h2 className="text-xl font-black">구매 전 최종 비교</h2>
            <p className="mt-1 text-sm font-semibold text-steel">점수, 가격 차이, 반품등급, 제휴 링크 준비 상태를 한 화면에서 봅니다.</p>
          </div>
          <button className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-black hover:bg-mist" onClick={clearItems} type="button">
            <Trash2 size={16} aria-hidden /> 모두 비우기
          </button>
        </div>
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
        {best.byScore ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
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
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {products.map((product) => {
          const outboundLink = getCoupangOutboundLink(product);
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
                <div>
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
                  <p className={valueClass(best.byScore?.id === product.id)}>{product.score ?? 0}점</p>
                </div>
                <div className="rounded-lg bg-mist p-3">
                  <p className="text-xs font-bold text-steel">할인율</p>
                  <p className={valueClass(best.byDiscount?.id === product.id)}>{formatPercent(product.discount_rate)}</p>
                </div>
                <div className="rounded-lg bg-mist p-3">
                  <p className="text-xs font-bold text-steel">구매가</p>
                  <p className={valueClass(best.byPrice?.id === product.id)}>{formatPrice(product.deal_price)}</p>
                </div>
                <div className="rounded-lg bg-mist p-3">
                  <p className="text-xs font-bold text-steel">반품등급</p>
                  <p className="font-black">{product.condition_grade}</p>
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
                sponsored={outboundLink.isAffiliate}
                channel="compare"
              />
            </div>
          </article>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <div className="overflow-x-auto">
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
                ["기준가", (product: PublicDeal) => formatPrice(product.reference_price)],
                ["할인율", (product: PublicDeal) => formatPercent(product.discount_rate)],
                ["반품등급", (product: PublicDeal) => product.condition_grade],
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
