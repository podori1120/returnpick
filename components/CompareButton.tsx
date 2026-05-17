"use client";

import { useEffect, useState } from "react";

const storageKey = "returnpick_compare_deals";
const changeEvent = "returnpick_compare_deals_changed";

function readItems() {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey) || "[]") as Array<{ id: string; title: string }>;
  } catch {
    return [];
  }
}

export default function CompareButton({ productId, title }: { productId: string; title: string }) {
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    function sync() {
      setSelected(readItems().some((item) => item.id === productId));
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
    const exists = items.some((item) => item.id === productId);
    const next = exists ? items.filter((item) => item.id !== productId) : [{ id: productId, title }, ...items].slice(0, 6);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    window.dispatchEvent(new Event(changeEvent));
    setSelected(!exists);
  }

  return (
    <button
      className="focus-ring rounded-lg border border-line px-3 py-2 text-xs font-black text-steel hover:bg-mist hover:text-pine"
      onClick={toggle}
      aria-pressed={selected}
      type="button"
    >
      {selected ? "비교 해제" : "비교함"}
    </button>
  );
}
