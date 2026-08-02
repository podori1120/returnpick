"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchSuggestion = {
  id: string;
  title: string;
  brand: string | null;
  model_name: string | null;
  category_label: string;
  score: number | null;
  detail_url: string;
};

export default function SearchSuggest() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/products/search-suggestions?q=${encodeURIComponent(trimmed)}`, {
          cache: "no-store",
          signal: controller.signal
        });
        if (!response.ok) return;
        const body = (await response.json()) as { items?: SearchSuggestion[] };
        setItems(body.items ?? []);
        setActiveIndex(-1);
      } catch (error) {
        if ((error as DOMException).name !== "AbortError") setItems([]);
      }
    }, 160);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  function goToSearch() {
    const trimmed = query.trim();
    if (!trimmed) {
      router.push("/deals");
      return;
    }
    setOpen(false);
    router.push(`/deals?search=${encodeURIComponent(trimmed)}`);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    goToSearch();
  }

  function select(item: SearchSuggestion) {
    setOpen(false);
    setQuery(item.title);
    router.push(item.detail_url);
  }

  function handleBlur() {
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  }

  function handleFocus() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    if (query.trim().length >= 2) setOpen(true);
  }

  return (
    <form
      className="relative order-2 flex w-full min-w-0 max-w-xl items-center gap-1 rounded-lg border border-line bg-mist p-1 sm:order-none sm:mx-5 sm:flex-1"
      action="/deals"
      onSubmit={submit}
      role="search"
    >
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">상품 검색</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel" size={17} aria-hidden />
        <input
          aria-activedescendant={activeIndex >= 0 ? `search-suggestion-${items[activeIndex]?.id}` : undefined}
          aria-autocomplete="list"
          aria-controls="search-suggestions"
          aria-expanded={open && query.trim().length >= 2}
          autoComplete="off"
          className="focus-ring h-9 w-full rounded-md bg-transparent pl-9 pr-2 text-sm font-bold text-ink placeholder:text-steel"
          name="search"
          onBlur={handleBlur}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setOpen(nextQuery.trim().length >= 2);
            if (nextQuery.trim().length < 2) {
              setItems([]);
              setActiveIndex(-1);
            }
          }}
          onFocus={handleFocus}
          onKeyDown={(event) => {
            if (!items.length) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => (index + 1) % items.length);
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => (index <= 0 ? items.length - 1 : index - 1));
            }
            if (event.key === "Enter" && activeIndex >= 0) {
              event.preventDefault();
              select(items[activeIndex]);
            }
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder="상품명·브랜드·모델명 검색"
          role="combobox"
          value={query}
        />
      </label>
      <button className="focus-ring flex size-9 shrink-0 items-center justify-center rounded-md bg-ink text-white hover:bg-pine" type="submit" aria-label="상품 검색" title="상품 검색">
        <Search size={17} aria-hidden />
      </button>
      {open && query.trim().length >= 2 ? (
        <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-lg border border-line bg-white shadow-soft" id="search-suggestions" role="listbox">
          {items.length ? (
            <div className="p-1.5">
              {items.map((item, index) => (
                <button
                  className={`focus-ring flex w-full items-start justify-between gap-3 rounded-md px-3 py-2.5 text-left hover:bg-mist ${index === activeIndex ? "bg-mist" : ""}`}
                  id={`search-suggestion-${item.id}`}
                  key={item.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => select(item)}
                  role="option"
                  aria-selected={index === activeIndex}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-ink">{item.title}</span>
                    <span className="mt-1 block truncate text-xs font-bold text-steel">
                      {item.category_label}{item.brand ? ` · ${item.brand}` : ""}{item.model_name ? ` · ${item.model_name}` : ""}
                    </span>
                  </span>
                  {item.score != null ? <span className="shrink-0 rounded-md bg-pine/10 px-2 py-1 text-xs font-black text-pine">{item.score}점</span> : null}
                </button>
              ))}
              <button className="focus-ring mt-1 w-full rounded-md border-t border-line px-3 py-2 text-left text-xs font-black text-pine hover:bg-mist" onMouseDown={(event) => event.preventDefault()} onClick={goToSearch} type="button">
                “{query.trim()}” 검색 결과 전체 보기
              </button>
            </div>
          ) : (
            <p className="px-4 py-4 text-sm font-semibold leading-6 text-steel">일치하는 공개 상품이 없습니다. 카테고리나 다른 모델명으로 검색해 보세요.</p>
          )}
        </div>
      ) : null}
    </form>
  );
}
