import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import AffiliateNotice from "@/components/AffiliateNotice";
import { getSearchIntentLanding } from "@/lib/searchLandings";
import { getSiteUrl } from "@/lib/siteUrl";

const highValueLandingSlugs = [
  "vivobook-laptop",
  "lg-gram-pro",
  "galaxy-book-pro",
  "macbook-m4",
  "odyssey-monitor",
  "oled-monitor",
  "qrevo-pro-robot-vacuum",
  "dreame-x50",
  "premium-robot-vacuum",
  "codezero-objet"
] as const;

const highValueLandings = highValueLandingSlugs
  .map((slug) => getSearchIntentLanding(slug))
  .filter((landing): landing is NonNullable<typeof landing> => landing !== null);

const canonicalUrl = `${getSiteUrl()}/guide/high-value`;

export const metadata: Metadata = {
  title: "고가 제품 구매 가이드",
  description: "비보북·그램 프로·맥북 M4·OLED 모니터·프리미엄 로봇청소기 등 고가 제품을 구매 전에 확인할 기준을 모아 봅니다.",
  alternates: { canonical: canonicalUrl },
  robots: { index: true, follow: true }
};

export default function HighValueGuidePage() {
  return (
    <main className="mx-auto max-w-5xl space-y-7 px-4 py-8 sm:px-6">
      <header className="border-b border-line pb-7">
        <p className="text-sm font-black text-pine">ReturnPick 고가 제품 가이드</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">고가 제품 구매 가이드</h1>
        <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-steel">
          노트북, 모니터, 로봇청소기처럼 구매 전 확인할 항목이 많은 제품군의 기준을 한곳에 모았습니다. 제품군별 가이드에서 모델 구성과 사용 조건을 차례로 확인해 보세요.
        </p>
      </header>

      <section aria-labelledby="high-value-guides-heading">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-black text-pine">제품군별 검색 가이드</p>
            <h2 id="high-value-guides-heading" className="mt-1 text-2xl font-black">찾는 제품군을 골라 보세요</h2>
          </div>
          <span className="text-xs font-black text-steel">{highValueLandings.length}개 가이드</span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {highValueLandings.map((landing) => (
            <Link
              key={landing.slug}
              className="focus-ring group rounded-lg border border-line bg-white p-5 hover:border-pine hover:bg-mist"
              href={`/guide/search/${landing.slug}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-ink">{landing.label}</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-steel">{landing.searchLabel}</p>
                </div>
                <ArrowRight className="mt-1 shrink-0 text-pine transition-transform group-hover:translate-x-0.5" size={18} aria-hidden />
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-black text-pine">구매 전 기준 보기</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-mist p-6" aria-labelledby="high-value-policy-heading">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-pine" size={21} aria-hidden />
          <div>
            <p className="text-sm font-black text-pine">공개 기준</p>
            <h2 id="high-value-policy-heading" className="mt-1 text-xl font-black">확인된 정보만 보수적으로 안내합니다</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-steel">
              공개되는 상품은 고객에게 보여 줄 준비가 확인된 상품만으로 제한합니다. 이 허브에서는 개별 거래 조건을 단정하지 않고, 확인되지 않은 정보는 확인필요로 남기는 구매 기준만 안내합니다.
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-black text-ink hover:border-pine hover:text-pine" href="/guide/safe-categories">
          안전 카테고리 가이드 <ArrowRight size={16} aria-hidden />
        </Link>
        <Link className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-black text-ink hover:border-pine hover:text-pine" href="/guide/return-checklist">
          수령 후 체크리스트 <ArrowRight size={16} aria-hidden />
        </Link>
      </div>

      <AffiliateNotice />
    </main>
  );
}
