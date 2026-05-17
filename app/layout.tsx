import type { Metadata } from "next";
import Link from "next/link";
import CompareDock from "@/components/CompareDock";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReturnPick | 리턴픽",
  description: "반품 노트북, 디지털, 소형가전 딜을 자동 수집하고 검수해 보여주는 리턴픽"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="border-b border-line bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-pine text-lg font-black text-white">
                R
              </span>
              <span>
                <span className="block text-lg font-black tracking-tight">ReturnPick</span>
                <span className="block text-xs font-semibold text-steel">리턴픽</span>
              </span>
            </Link>
            <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-steel">
              <Link className="rounded-md px-3 py-2 hover:bg-mist hover:text-ink" href="/deals">
                딜 보기
              </Link>
              <Link className="rounded-md px-3 py-2 hover:bg-mist hover:text-ink" href="/compare">
                비교함
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
        <CompareDock />
      </body>
    </html>
  );
}
