import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import CompareDock from "@/components/CompareDock";
import { getSiteUrl } from "@/lib/siteUrl";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "ReturnPick | 리턴픽",
    template: "%s | ReturnPick"
  },
  description: "반품 노트북, 디지털, 소형가전 딜을 자동 수집하고 검수해 보여주는 리턴픽",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "ReturnPick | 리턴픽",
    description: "반품 디지털 딜을 자동 수집하고 검수해 보여주는 리턴픽",
    type: "website",
    locale: "ko_KR",
    siteName: "ReturnPick",
    url: "/"
  },
  twitter: {
    card: "summary_large_image",
    title: "ReturnPick | 리턴픽",
    description: "반품 디지털 딜을 자동 수집하고 검수해 보여주는 리턴픽"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="border-b border-line bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col items-stretch gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-pine text-lg font-black text-white">
                R
              </span>
              <span>
                <span className="block text-lg font-black tracking-tight">ReturnPick</span>
                <span className="block text-xs font-semibold text-steel">리턴픽</span>
              </span>
            </Link>
            <form className="order-2 flex w-full min-w-0 max-w-xl items-center gap-1 rounded-lg border border-line bg-mist p-1 sm:order-none sm:mx-5 sm:flex-1" action="/deals" role="search">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">상품 검색</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel" size={17} aria-hidden />
                <input
                  className="focus-ring h-9 w-full rounded-md bg-transparent pl-9 pr-2 text-sm font-bold text-ink placeholder:text-steel"
                  name="search"
                  placeholder="상품명·브랜드·모델명 검색"
                />
              </label>
              <button className="focus-ring flex size-9 shrink-0 items-center justify-center rounded-md bg-ink text-white hover:bg-pine" type="submit" aria-label="상품 검색" title="상품 검색">
                <Search size={17} aria-hidden />
              </button>
            </form>
            <nav className="order-3 hide-scrollbar -mx-4 flex items-center gap-1 overflow-x-auto whitespace-nowrap px-4 pb-1 text-sm font-semibold text-steel sm:order-none sm:mx-0 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:px-0 sm:pb-0">
              <Link className="rounded-md px-3 py-2 hover:bg-mist hover:text-ink" href="/deals">
                딜 보기
              </Link>
              <Link className="rounded-md px-3 py-2 hover:bg-mist hover:text-ink" href="/picks">
                검수 추천
              </Link>
              <Link className="rounded-md px-3 py-2 hover:bg-mist hover:text-ink" href="/compare">
                비교함
              </Link>
              <Link className="rounded-md px-3 py-2 hover:bg-mist hover:text-ink" href="/saved">
                찜함
              </Link>
              <Link className="rounded-md px-3 py-2 hover:bg-mist hover:text-ink" href="/guide/return-checklist">
                수령 체크
              </Link>
              <Link className="rounded-md px-3 py-2 hover:bg-mist hover:text-ink" href="/guide/safe-categories">
                안전 카테고리
              </Link>
              <Link className="rounded-md px-3 py-2 hover:bg-mist hover:text-ink" href="/disclosure">
                제휴 안내
              </Link>
              <Link className="rounded-md px-3 py-2 hover:bg-mist hover:text-ink" href="/admin">
                관리자
              </Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="border-t border-line bg-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm font-semibold leading-6 text-steel sm:px-6 md:flex-row md:items-center md:justify-between">
            <p>이 포스팅은 쿠팡 파트너스 활동의 일환으로 일정액의 수수료를 제공받을 수 있습니다.</p>
            <div className="flex flex-wrap gap-3 font-black">
              <Link className="text-pine hover:text-ink" href="/disclosure">
                제휴 안내
              </Link>
              <Link className="text-pine hover:text-ink" href="/products/approval-sample">
                파트너스 심사 페이지
              </Link>
              <Link className="text-pine hover:text-ink" href="/saved">
                찜한 딜
              </Link>
              <Link className="text-pine hover:text-ink" href="/picks/novatech-s1-window-cleaner">
                직접 검수 추천 상품
              </Link>
            </div>
          </div>
        </footer>
        <CompareDock />
      </body>
    </html>
  );
}
