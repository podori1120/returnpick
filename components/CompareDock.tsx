"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Scale, X } from "lucide-react";
import { getStoredJsonArray, setStoredJsonArray } from "@/lib/clientTracking";

type StoredCompareItem = {
  id: string;
  title: string;
};

const storageKey = "returnpick_compare_deals";

function readItems() {
  return getStoredJsonArray<StoredCompareItem>(storageKey);
}

export default function CompareDock() {
  const [items, setItems] = useState<StoredCompareItem[]>([]);

  useEffect(() => {
    function sync() {
      setItems(readItems());
    }
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("returnpick_compare_deals_changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("returnpick_compare_deals_changed", sync);
    };
  }, []);

  function clear() {
    setStoredJsonArray(storageKey, []);
    try {
      window.dispatchEvent(new Event("returnpick_compare_deals_changed"));
    } catch {
      // Compare dock is best-effort UI state.
    }
    setItems([]);
  }

  if (!items.length) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-30 mx-auto max-w-xl rounded-lg border border-line bg-ink p-3 text-white shadow-soft md:bottom-4">
      <div className="flex items-center justify-between gap-3">
        <Link className="flex min-w-0 flex-1 items-center gap-3" href="/compare">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/10">
            <Scale size={18} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-black">비교함 {items.length}개</span>
            <span className="block truncate text-xs font-semibold text-white/70">{items[0]?.title}</span>
          </span>
        </Link>
        <Link className="focus-ring rounded-md bg-pine px-3 py-2 text-xs font-black text-white hover:bg-white hover:text-ink" href="/compare">
          비교
        </Link>
        <button className="focus-ring rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white" onClick={clear} type="button" aria-label="비교함 비우기">
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
