"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SavedFilter = {
  label: string;
  href: string;
  savedAt: string;
};

const storageKey = "returnpick_saved_filters";

export default function SavedFilterBar() {
  const [items, setItems] = useState<SavedFilter[]>([]);

  useEffect(() => {
    setItems(JSON.parse(window.localStorage.getItem(storageKey) || "[]") as SavedFilter[]);
  }, []);

  function saveCurrentFilter() {
    const href = `${window.location.pathname}${window.location.search}`;
    const params = new URLSearchParams(window.location.search);
    const label =
      [params.get("useCase"), params.get("category"), params.get("minScore") ? `${params.get("minScore")}점+` : null, params.get("minDiscount") ? `${params.get("minDiscount")}%+` : null]
        .filter(Boolean)
        .join(" · ") || "전체 딜";
    const next = [{ label, href, savedAt: new Date().toISOString() }, ...items.filter((item) => item.href !== href)].slice(0, 8);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    setItems(next);
  }

  function clearSaved() {
    window.localStorage.removeItem(storageKey);
    setItems([]);
  }

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black text-pine">My Filters</p>
          <h2 className="text-lg font-black">관심 조건 저장</h2>
        </div>
        <div className="flex gap-2">
          <button className="focus-ring rounded-lg bg-ink px-3 py-2 text-xs font-black text-white hover:bg-pine" onClick={saveCurrentFilter} type="button">
            현재 조건 저장
          </button>
          {items.length ? (
            <button className="focus-ring rounded-lg border border-line px-3 py-2 text-xs font-black hover:bg-mist" onClick={clearSaved} type="button">
              비우기
            </button>
          ) : null}
        </div>
      </div>
      {items.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <Link key={item.href} className="rounded-md bg-mist px-3 py-2 text-xs font-black text-steel hover:text-pine" href={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm font-semibold text-steel">자주 보는 점수, 할인율, 용도 조건을 저장해두면 다음 방문 때 바로 열 수 있습니다.</p>
      )}
    </section>
  );
}
