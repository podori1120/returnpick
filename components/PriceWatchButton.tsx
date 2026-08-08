"use client";

import { Check, Target, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";
import { evaluatePriceWatch, getPriceWatchItem, priceWatchChangeEvent, removePriceWatch, upsertPriceWatch, type PriceWatchItem } from "@/lib/priceWatch";

type PriceWatchButtonProps = {
  productId: string;
  title: string;
  currentPrice: number | null;
};

function statusCopy(currentPrice: number | null, targetPrice: number) {
  const status = evaluatePriceWatch(currentPrice, targetPrice);
  if (status === "hit") {
    return {
      className: "border-pine bg-pine/10 text-pine",
      title: "목표가 도달",
      detail: `현재가 ${formatPrice(currentPrice)}가 목표가 ${formatPrice(targetPrice)} 이하입니다.`
    };
  }
  if (status === "above" && currentPrice != null) {
    return {
      className: "border-lemon bg-lemon/20 text-ink",
      title: "목표가 기다리는 중",
      detail: `현재가 ${formatPrice(currentPrice)} · 목표가까지 ${formatPrice(currentPrice - targetPrice)} 차이`
    };
  }
  return {
    className: "border-line bg-mist text-steel",
    title: "현재가 확인필요",
    detail: "현재 가격이 확인되면 목표가와 다시 비교할 수 있습니다."
  };
}

export default function PriceWatchButton({ productId, title, currentPrice }: PriceWatchButtonProps) {
  const [watch, setWatch] = useState<PriceWatchItem | null>(null);
  const [targetInput, setTargetInput] = useState(currentPrice ? String(currentPrice) : "");
  const [status, setStatus] = useState("");

  useEffect(() => {
    function sync() {
      const next = getPriceWatchItem(productId);
      setWatch(next);
      setTargetInput(next ? String(next.targetPrice) : currentPrice ? String(currentPrice) : "");
    }

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(priceWatchChangeEvent, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(priceWatchChangeEvent, sync);
    };
  }, [currentPrice, productId]);

  function save() {
    const targetPrice = Number(targetInput.replace(/,/g, "").trim());
    if (!Number.isSafeInteger(targetPrice) || targetPrice <= 0) {
      setStatus("1원 이상 정수로 목표가를 입력하세요.");
      return;
    }

    const next = {
      productId,
      title,
      targetPrice,
      createdAt: watch?.createdAt ?? new Date().toISOString()
    } satisfies PriceWatchItem;
    upsertPriceWatch(next);
    setWatch(next);
    setTargetInput(String(targetPrice));
    setStatus("이 브라우저에 가격 기준을 저장했습니다.");
  }

  function remove() {
    removePriceWatch(productId);
    setWatch(null);
    setTargetInput(currentPrice ? String(currentPrice) : "");
    setStatus("가격 기준을 삭제했습니다.");
  }

  const watchStatus = watch ? statusCopy(currentPrice, watch.targetPrice) : null;

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-pine/10 p-2 text-pine">
          <Target size={18} aria-hidden />
        </div>
        <div>
          <p className="text-xs font-black text-pine">My Price Target</p>
          <h2 className="mt-1 text-lg font-black">내가 정한 가격 저장</h2>
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-steel">
        사고 싶은 상한가를 저장해 두면 다음에 이 상품을 다시 열 때 현재가와 비교합니다. 이 정보는 이 브라우저에만 저장되며 문자·푸시·이메일 알림은 보내지 않습니다.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block text-sm font-black" htmlFor={`price-target-${productId}`}>
          목표 구매가
          <span className="mt-1 flex items-center rounded-lg border border-line bg-mist px-3 focus-within:border-pine focus-within:ring-2 focus-within:ring-pine/20">
            <input
              className="min-w-0 flex-1 bg-transparent py-3 text-base font-black outline-none"
              id={`price-target-${productId}`}
              inputMode="numeric"
              min="1"
              name="price-target"
              onChange={(event) => setTargetInput(event.target.value)}
              placeholder={currentPrice == null ? "현재가 확인필요" : "예: 700000"}
              step="1000"
              type="number"
              value={targetInput}
            />
            <span className="text-sm font-black text-steel">원</span>
          </span>
        </label>
        <div className="flex gap-2">
          <button className="focus-ring inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-black text-white hover:bg-pine sm:flex-none" onClick={save} type="button">
            <Check size={16} aria-hidden />
            {watch ? "기준 변경" : "가격 기준 저장"}
          </button>
          {watch ? (
            <button aria-label="가격 기준 삭제" className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-3 text-steel hover:bg-mist" onClick={remove} title="가격 기준 삭제" type="button">
              <Trash2 size={16} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      {watchStatus ? (
        <div className={`mt-4 rounded-lg border px-3 py-3 text-sm font-bold leading-5 ${watchStatus.className}`} role="status">
          <p className="font-black">{watchStatus.title}</p>
          <p className="mt-1">{watchStatus.detail}</p>
        </div>
      ) : null}
      {status ? <p className="mt-3 text-xs font-bold text-steel" role="status" aria-live="polite">{status}</p> : null}
    </section>
  );
}
