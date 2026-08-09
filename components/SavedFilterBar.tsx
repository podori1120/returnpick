"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { categoryOptions } from "@/lib/category";
import { priceBandOptions } from "@/lib/priceBand";
import { getStoredJsonArray, setStoredJsonArray } from "@/lib/clientTracking";
import { buildSavedFilterLabel, normalizeSavedFilters, savedFiltersChangeEvent, savedFiltersStorageKey, type SavedFilter } from "@/lib/savedFilters";
import { useCaseOptions } from "@/lib/dealIntelligence";

function readSavedFilters() {
  return normalizeSavedFilters(getStoredJsonArray<SavedFilter>(savedFiltersStorageKey));
}

export default function SavedFilterBar() {
  const [items, setItems] = useState<SavedFilter[]>(() => readSavedFilters());

  useEffect(() => {
    function syncSavedFilters() {
      setItems(readSavedFilters());
    }

    window.addEventListener("storage", syncSavedFilters);
    window.addEventListener(savedFiltersChangeEvent, syncSavedFilters);
    return () => {
      window.removeEventListener("storage", syncSavedFilters);
      window.removeEventListener(savedFiltersChangeEvent, syncSavedFilters);
    };
  }, []);

  function persist(next: SavedFilter[]) {
    setStoredJsonArray(savedFiltersStorageKey, next);
    window.dispatchEvent(new Event(savedFiltersChangeEvent));
    setItems(next);
  }

  function saveCurrentFilter() {
    const href = `${window.location.pathname}${window.location.search}`;
    const params = new URLSearchParams(window.location.search);
    const label = buildSavedFilterLabel(params, { useCases: useCaseOptions, categories: categoryOptions, priceBands: priceBandOptions });
    const next = normalizeSavedFilters([{ label, href, savedAt: new Date().toISOString() }, ...readSavedFilters().filter((item) => item.href !== href)]);
    persist(next);
  }

  function clearSaved() {
    persist([]);
  }

  function removeSavedFilter(href: string) {
    persist(readSavedFilters().filter((item) => item.href !== href));
  }

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black text-pine">My Filters</p>
          <h2 className="text-lg font-black">관심 조건 저장</h2>
          <p className="mt-1 text-xs font-semibold text-steel">검색·예산·품질·재고 조건을 저장해 다음 방문에 바로 비교하세요.</p>
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
            <div key={item.href} className="inline-flex max-w-full items-stretch rounded-md bg-mist text-xs font-black text-steel">
              <Link className="focus-ring min-w-0 truncate px-3 py-2 hover:text-pine" href={item.href} title={item.label}>
                {item.label}
              </Link>
              <button
                aria-label={`저장 조건 삭제: ${item.label}`}
                className="focus-ring shrink-0 border-l border-line px-2 text-steel hover:bg-white hover:text-ink"
                onClick={() => removeSavedFilter(item.href)}
                title="저장 조건 삭제"
                type="button"
              >
                <X size={14} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm font-semibold text-steel">현재 필터 적용 후 저장하면 검색어와 예산까지 그대로 다시 열립니다.</p>
      )}
    </section>
  );
}
