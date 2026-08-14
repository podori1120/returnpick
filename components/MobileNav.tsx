"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

const navigationGroups = [
  {
    label: "둘러보기",
    links: [
      { href: "/deals", label: "딜 보기" },
      { href: "/recommend", label: "맞춤 추천" },
      { href: "/picks", label: "검수 추천" },
      { href: "/compare", label: "비교함" }
    ]
  },
  {
    label: "내 목록",
    links: [
      { href: "/saved", label: "찜함" },
      { href: "/watchlist", label: "가격 기준" }
    ]
  },
  {
    label: "안내",
    links: [
      { href: "/guide/return-checklist", label: "수령 체크" },
      { href: "/guide/safe-categories", label: "안전 카테고리" },
      { href: "/guide/high-value", label: "고가 가이드" },
      { href: "/disclosure", label: "제휴 안내" },
      { href: "/admin", label: "관리자" }
    ]
  }
] as const;

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <div className="contents sm:hidden">
      <button
        aria-controls="mobile-nav-panel"
        aria-expanded={open}
        aria-label={open ? "모바일 메뉴 닫기" : "모바일 메뉴 열기"}
        className="focus-ring shrink-0 rounded-lg border border-line bg-white p-2 text-ink hover:bg-mist"
        onClick={() => setOpen((value) => !value)}
        title={open ? "모바일 메뉴 닫기" : "모바일 메뉴 열기"}
        type="button"
      >
        {open ? <X aria-hidden size={20} /> : <Menu aria-hidden size={20} />}
      </button>
      {open ? (
        <nav
          aria-label="모바일 메뉴"
          className="basis-full min-w-0 max-h-[calc(100dvh-9rem)] overflow-y-auto rounded-xl border border-line bg-white p-3 shadow-soft"
          id="mobile-nav-panel"
        >
          <div className="grid min-w-0 gap-4">
            {navigationGroups.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-black uppercase tracking-wide text-steel">{group.label}</p>
                <div className="mt-2 grid min-w-0 grid-cols-2 gap-1">
                  {group.links.map((link) => (
                    <Link
                      className="focus-ring min-w-0 rounded-lg px-3 py-2.5 text-sm font-bold text-ink hover:bg-mist hover:text-pine"
                      href={link.href}
                      key={link.href}
                      onClick={closeMenu}
                    >
                      <span className="block truncate">{link.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
