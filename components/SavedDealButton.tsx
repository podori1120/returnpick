"use client";

import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { getSavedDealItems, savedDealsChangeEvent, setSavedDealItems } from "@/lib/clientTracking";

export default function SavedDealButton({ productId, title }: { productId: string; title: string }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    function sync() {
      setSaved(getSavedDealItems().some((item) => item.id === productId));
    }

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(savedDealsChangeEvent, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(savedDealsChangeEvent, sync);
    };
  }, [productId]);

  function toggle() {
    const items = getSavedDealItems();
    const exists = items.some((item) => item.id === productId);
    const next = exists
      ? items.filter((item) => item.id !== productId)
      : [{ id: productId, title, savedAt: new Date().toISOString() }, ...items].slice(0, 12);
    setSavedDealItems(next);
    setSaved(!exists);
  }

  return (
    <button
      aria-label={saved ? "찜한 딜에서 제거" : "찜한 딜에 저장"}
      aria-pressed={saved}
      className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-black text-steel hover:bg-mist hover:text-pine"
      onClick={toggle}
      title={saved ? "찜한 딜에서 제거" : "찜한 딜에 저장"}
      type="button"
    >
      <Heart size={15} fill={saved ? "currentColor" : "none"} aria-hidden />
      {saved ? "찜함" : "찜"}
    </button>
  );
}
