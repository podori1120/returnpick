import type { Metadata } from "next";
import Link from "next/link";
import CompareDock from "@/components/CompareDock";
import MobileNav from "@/components/MobileNav";
import SearchSuggest from "@/components/SearchSuggest";
import { getSiteUrl } from "@/lib/siteUrl";
import "./globals.css";

const siteUrl = getSiteUrl();
const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
const naverSiteVerification = process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION?.trim();

const siteIdentityJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "ReturnPick",
      alternateName: "리턴픽",
      url: siteUrl,
      inLanguage: "ko-KR",
      publisher: { "@id": `${siteUrl}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${siteUrl}/deals?search={search_term_string}`
        },
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "ReturnPick",
      alternateName: "리턴픽",
      url: siteUrl,
      description: "반품 노트북, 모니터, 소형가전의 가격과 구매 전 확인사항을 비교하는 검수형 추천 서비스입니다.",
      image: `${siteUrl}/opengraph-image`
    }
  ]
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
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
  },
  ...(googleSiteVerification || naverSiteVerification
    ? {
        verification: {
          ...(googleSiteVerification ? { google: googleSiteVerification } : {}),
          ...(naverSiteVerification ? { other: { "naver-site-verification": naverSiteVerification } } : {})
        }
      }
    : {})
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <script
          id="returnpick-site-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteIdentityJsonLd).replace(/</g, "\\u003c") }}
        />
        <header className="border-b border-line bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col items-stretch gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
            <div className="flex flex-wrap items-center justify-between gap-3 sm:contents">
              <Link href="/" className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-pine text-lg font-black text-white">
                  R
                </span>
                <span>
                  <span className="block text-lg font-black tracking-tight">ReturnPick</span>
                  <span className="block text-xs font-semibold text-steel">리턴픽</span>
                </span>
              </Link>
              <MobileNav />
            </div>
            <SearchSuggest />
            <nav aria-label="주요 메뉴" className="hidden text-xs font-semibold text-steel sm:order-none sm:flex sm:flex-wrap sm:gap-2 sm:text-sm">
              <Link className="whitespace-nowrap rounded-md px-2 py-2 text-center hover:bg-mist hover:text-ink sm:px-3" href="/deals">
                딜 보기
              </Link>
              <Link className="whitespace-nowrap rounded-md px-2 py-2 text-center hover:bg-mist hover:text-ink sm:px-3" href="/recommend">
                맞춤 추천
              </Link>
              <Link className="whitespace-nowrap rounded-md px-2 py-2 text-center hover:bg-mist hover:text-ink sm:px-3" href="/picks">
                검수 추천
              </Link>
              <Link className="whitespace-nowrap rounded-md px-2 py-2 text-center hover:bg-mist hover:text-ink sm:px-3" href="/compare">
                비교함
              </Link>
              <Link className="whitespace-nowrap rounded-md px-2 py-2 text-center hover:bg-mist hover:text-ink sm:px-3" href="/saved">
                찜함
              </Link>
              <Link className="whitespace-nowrap rounded-md px-2 py-2 text-center hover:bg-mist hover:text-ink sm:px-3" href="/watchlist">
                가격 기준
              </Link>
              <Link className="whitespace-nowrap rounded-md px-2 py-2 text-center hover:bg-mist hover:text-ink sm:px-3" href="/guide/return-checklist">
                수령 체크
              </Link>
              <Link className="whitespace-nowrap rounded-md px-2 py-2 text-center hover:bg-mist hover:text-ink sm:px-3" href="/guide/safe-categories">
                안전 카테고리
              </Link>
              <Link className="whitespace-nowrap rounded-md px-2 py-2 text-center hover:bg-mist hover:text-ink sm:px-3" href="/disclosure">
                제휴 안내
              </Link>
              <Link className="whitespace-nowrap rounded-md px-2 py-2 text-center hover:bg-mist hover:text-ink sm:px-3" href="/admin">
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
              <Link className="text-pine hover:text-ink" href="/watchlist">
                가격 기준함
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
