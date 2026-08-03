"use client";

import { Loader2, Plus, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export type CompareProductSuggestion = {
  id: string;
  title: string;
  brand: string | null;
  model_name: string | null;
  category_label: string;
  score: number | null;
};

function isSuggestion(value: unknown): value is CompareProductSuggestion {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    item.id.length > 0 &&
    typeof item.title === "string" &&
    item.title.trim().length > 0 &&
    (item.brand === null || typeof item.brand === "string") &&
    (item.model_name === null || typeof item.model_name === "string") &&
    typeof item.category_label === "string" &&
    (item.score === null || typeof item.score === "number")
  );
}

function parseSuggestions(body: unknown) {
  if (!body || typeof body !== "object" || !("items" in body) || !Array.isArray(body.items)) return [];

  const seen = new Set<string>();
  return body.items.filter(isSuggestion).filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export default function CompareProductPicker({
  onSelect,
  currentCount,
  maxItems
}: {
  onSelect: (item: CompareProductSuggestion) => void;
  currentCount: number;
  maxItems: number;
}) {
  const idPrefix = useId().replace(/:/g, "");
  const inputId = `compare-product-picker-input-${idPrefix}`;
  const listboxId = `compare-product-picker-listbox-${idPrefix}`;
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CompareProductSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/products/search-suggestions?q=${encodeURIComponent(trimmed)}&surface=compare`, {
          cache: "no-store",
          signal: controller.signal
        });
        if (!response.ok) throw new Error("COMPARE_PRODUCT_SEARCH_FAILED");
        const body: unknown = await response.json();
        if (controller.signal.aborted) return;
        setItems(parseSuggestions(body));
        setActiveIndex(-1);
      } catch (error) {
        if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) return;
        setItems([]);
        setActiveIndex(-1);
        setSearchError("공개 상품 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  function select(item: CompareProductSuggestion) {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setQuery("");
    setItems([]);
    setOpen(false);
    setActiveIndex(-1);
    onSelect(item);
  }

  function handleBlur() {
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setActiveIndex(-1);
    }, 140);
  }

  function handleFocus() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    if (query.trim().length >= 2) setOpen(true);
  }

  const listboxVisible = open && query.trim().length >= 2;
  const activeItem = activeIndex >= 0 ? items[activeIndex] : undefined;
  const isFull = currentCount >= maxItems;

  return (
    <div className="relative w-full min-w-0">
      <div className="mb-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-black text-ink">공개 상품을 비교함에 추가</p>
          <p className="text-xs font-black text-steel" aria-live="polite">현재 {currentCount}/{maxItems}개</p>
        </div>
        <p className="mt-1 text-xs font-semibold leading-5 text-steel">
          상품명, 브랜드, 모델명으로 2자 이상 검색하세요. 공개 게시 기준을 통과한 상품만 비교함에 담을 수 있습니다.
        </p>
      </div>
      <div className="relative w-full min-w-0">
        <label className="sr-only" htmlFor={inputId}>
          공개 상품을 비교함에 추가할 상품 검색
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel" size={17} aria-hidden />
        <input
          id={inputId}
          aria-activedescendant={activeItem ? `${listboxId}-option-${activeItem.id}` : undefined}
          aria-autocomplete="list"
          aria-busy={loading}
          aria-controls={listboxId}
          aria-expanded={listboxVisible}
          autoComplete="off"
          className="focus-ring h-11 w-full rounded-lg border border-line bg-white pl-9 pr-10 text-sm font-bold text-ink placeholder:text-steel"
          disabled={isFull}
          onBlur={handleBlur}
          onChange={(event) => {
            const nextQuery = event.target.value;
            const trimmedNextQuery = nextQuery.trim();
            setQuery(nextQuery);
            setOpen(trimmedNextQuery.length >= 2);
            setActiveIndex(-1);
            if (trimmedNextQuery.length < 2) {
              setItems([]);
              setLoading(false);
              setSearchError("");
            } else {
              setLoading(true);
              setSearchError("");
            }
          }}
          onFocus={handleFocus}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              setActiveIndex(-1);
              return;
            }
            if (!items.length) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => (index + 1) % items.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => (index <= 0 ? items.length - 1 : index - 1));
            } else if (event.key === "Enter" && activeIndex >= 0) {
              event.preventDefault();
              select(items[activeIndex]);
            }
          }}
          placeholder={isFull ? "비교함이 가득 찼습니다" : "상품명, 브랜드, 모델명을 입력하세요"}
          role="combobox"
          type="search"
          value={query}
        />
        {loading ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-pine" size={17} aria-hidden /> : null}
      </div>
      {listboxVisible ? (
        <div
          aria-label="공개 상품 검색 결과"
          className="absolute z-40 mt-2 max-h-72 w-full max-w-full overflow-y-auto overscroll-contain rounded-lg border border-line bg-white p-1.5 shadow-soft"
          id={listboxId}
          role="listbox"
        >
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm font-semibold text-steel" role="status">
              <Loader2 className="animate-spin text-pine" size={16} aria-hidden />
              <span>공개 상품을 검색하고 있습니다.</span>
            </div>
          ) : searchError ? (
            <p className="px-3 py-4 text-sm font-semibold leading-6 text-coral" role="status">
              {searchError}
            </p>
          ) : items.length ? (
            items.map((item, index) => (
              <button
                aria-selected={index === activeIndex}
                className={`focus-ring flex w-full min-w-0 items-start gap-2 rounded-md px-3 py-3 text-left hover:bg-mist ${index === activeIndex ? "bg-mist" : ""}`}
                id={`${listboxId}-option-${item.id}`}
                key={item.id}
                onClick={() => select(item)}
                onMouseDown={(event) => event.preventDefault()}
                role="option"
                type="button"
              >
                <Plus className="mt-0.5 shrink-0 text-pine" size={16} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-ink">{item.title}</span>
                  <span className="mt-1 block truncate text-xs font-bold text-steel">
                    {item.category_label}{item.brand ? ` • ${item.brand}` : ""}{item.model_name ? ` • ${item.model_name}` : ""}
                  </span>
                </span>
                {item.score != null ? <span className="shrink-0 rounded-md bg-pine/10 px-2 py-1 text-xs font-black text-pine">{item.score}</span> : null}
              </button>
            ))
          ) : (
            <p className="px-3 py-4 text-sm font-semibold leading-6 text-steel" role="status">
              일치하는 공개 상품이 없습니다.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
