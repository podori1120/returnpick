"use client";

import { useEffect, useState } from "react";
import { compareProductIdsEqual, MAX_COMPARE_ITEMS, normalizeCompareProductId } from "@/lib/compareIdentity";
import { getStoredJsonArray, setStoredJsonArray } from "@/lib/clientTracking";

const storageKey = "returnpick_compare_deals";
const changeEvent = "returnpick_compare_deals_changed";

function readItems() {
  return getStoredJsonArray<Array<{ id: string; title: string }>[number]>(storageKey);
}

export default function CompareButton({ productId, title }: { productId: string; title: string }) {
  const [selected, setSelected] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    function sync() {
      setSelected(readItems().some((item) => compareProductIdsEqual(item.id, productId)));
    }
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(changeEvent, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(changeEvent, sync);
    };
  }, [productId]);

  function toggle() {
    const items = readItems();
    const exists = items.some((item) => compareProductIdsEqual(item.id, productId));
    if (!exists && items.length >= MAX_COMPARE_ITEMS) {
      setStatus(`비교함은 최대 ${MAX_COMPARE_ITEMS}개까지 담을 수 있습니다.`);
      return;
    }
    const next = exists
      ? items.filter((item) => !compareProductIdsEqual(item.id, productId))
      : [{ id: normalizeCompareProductId(productId), title }, ...items];
    setStoredJsonArray(storageKey, next);
    try {
      window.dispatchEvent(new Event(changeEvent));
    } catch {
      // Compare storage is best-effort and should not block browsing.
    }
    setSelected(!exists);
    setStatus(exists ? "비교함에서 제거했습니다." : "비교함에 담았습니다.");
  }

  return (
    <div className="space-y-1">
      <button
        className="focus-ring rounded-lg border border-line px-3 py-2 text-xs font-black text-steel hover:bg-mist hover:text-pine"
        onClick={toggle}
        aria-pressed={selected}
        type="button"
      >
        {selected ? "비교 해제" : "비교함"}
      </button>
      {status ? <p className="text-xs font-bold text-steel" role="status" aria-live="polite">{status}</p> : null}
    </div>
  );
}
