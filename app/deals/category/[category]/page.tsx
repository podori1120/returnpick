import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, Search, ShieldCheck } from "lucide-react";
import AffiliateNotice from "@/components/AffiliateNotice";
import { ProductImpressionTracker } from "@/components/AffiliateEventTracker";
import DealCard from "@/components/DealCard";
import { categoryOptions, getCategoryLabel, isKnownCategory } from "@/lib/category";
import { getCategoryLandingContent } from "@/lib/categoryLanding";
import { listProducts } from "@/lib/dataStore";
import { isPublicDealReady } from "@/lib/publicDeal";
import { getSiteUrl } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";
export const dynamicParams = false;

export function generateStaticParams() {
  return categoryOptions.map((category) => ({ category: category.value }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  if (!isKnownCategory(category)) {
    return {
      title: "카테고리를 찾을 수 없습니다",
      robots: { index: false, follow: false }
    };
  }

  const content = getCategoryLandingContent(category);
  const canonicalUrl = `${getSiteUrl()}/deals/category/${category}`;
  return {
    title: content.seoTitle,
    description: content.seoDescription,
    keywords: content.keywords,
    alternates: { canonical: canonicalUrl },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${content.seoTitle} | ReturnPick`,
      description: content.seoDescription,
      url: canonicalUrl,
      type: "website",
      locale: "ko_KR",
      siteName: "ReturnPick",
      images: [{ url: `${getSiteUrl()}/opengraph-image` }]
    },
    twitter: {
      card: "summary_large_image",
      title: `${content.seoTitle} | ReturnPick`,
      description: content.seoDescription,
      images: [`${getSiteUrl()}/twitter-image`]
    }
  };
}

export default async function CategoryDealPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!isKnownCategory(category)) notFound();

  const label = getCategoryLabel(category);
  const content = getCategoryLandingContent(category);
  const categoryProducts = (await listProducts({ published: true, category }))
    .filter(isPublicDealReady)
    .filter((product) => product.category === category)
    .sort((a, b) => (b.latest_score?.total_score ?? 0) - (a.latest_score?.total_score ?? 0));
  const products = categoryProducts.slice(0, 12);
  const otherCategories = categoryOptions.filter((item) => item.value !== category);
  const faqItems = [
    {
      question: `반품 ${label}은 무엇을 먼저 비교해야 하나요?`,
      answer: `${content.dealChecks.map((item) => item.title).join(", ")}를 먼저 확인하세요. 리턴픽은 네이버 최저가, 새상품가, 수집 가격 순으로 기준가를 정하고 반품등급과 위험 요소를 함께 봅니다.`
    },
    {
      question: "반품등급이나 반품가가 확인되지 않은 상품도 추천하나요?",
      answer: "확인되지 않은 값은 임의로 만들지 않습니다. 공개 딜 목록에는 가격, 상태, 이미지와 상품별 쿠팡 파트너스 링크 등 고객공개 품질 기준을 통과한 상품만 표시합니다."
    },
    {
      question: `반품 ${label}을 받은 뒤 언제 확인해야 하나요?`,
      answer: `개봉 직후 구성품과 외관을 기록하고 ${content.receiptChecks.map((item) => item.title).join(", ")}를 반품 가능 기간 안에 확인하는 것이 좋습니다.`
    }
  ];
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer }
    }))
  };

  return (
    <main>
      <ProductImpressionTracker productIds={products.map((product) => product.id)} channel={`web_category_${category}`} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }} />

      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
          <nav className="flex flex-wrap items-center gap-2 text-xs font-bold text-steel" aria-label="경로">
            <Link className="hover:text-pine" href="/">홈</Link>
            <span aria-hidden>/</span>
            <Link className="hover:text-pine" href="/deals">딜</Link>
            <span aria-hidden>/</span>
            <span className="text-ink">{label}</span>
          </nav>
          <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_330px] lg:items-end">
            <div>
              <p className="text-sm font-black text-pine">RETURN DEAL GUIDE</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">반품 {label}, 근거부터 비교하세요</h1>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-steel sm:text-base">{content.intro}</p>
              <form action="/deals" className="mt-6 flex max-w-2xl gap-2" role="search">
                <input type="hidden" name="category" value={category} />
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">{label} 상품 검색</span>
                  <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-steel" size={19} aria-hidden />
                  <input
                    className="focus-ring h-12 w-full rounded-lg border border-line bg-white pl-11 pr-3 text-sm font-bold placeholder:text-steel"
                    name="search"
                    placeholder={`${label} 브랜드·모델명 검색`}
                  />
                </label>
                <button className="focus-ring inline-flex h-12 shrink-0 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-black text-white hover:bg-pine" type="submit">
                  딜 찾기 <ArrowRight size={16} aria-hidden />
                </button>
              </form>
            </div>
            <aside className="border-t border-line pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0" aria-label={`${label} 공개 기준`}>
              <p className="text-xs font-black text-pine">현재 공개 상태</p>
              <p className="mt-1 text-3xl font-black">검수 딜 {categoryProducts.length.toLocaleString("ko-KR")}개</p>
              <div className="mt-4 space-y-2 text-xs font-bold leading-5 text-steel">
                <p className="flex gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-pine" size={14} aria-hidden /> 고객공개 품질을 통과한 상품만 집계</p>
                <p className="flex gap-2"><ShieldCheck className="mt-0.5 shrink-0 text-pine" size={14} aria-hidden /> 확인되지 않은 반품 정보는 임의 생성하지 않음</p>
                <p className="flex gap-2"><AlertTriangle className="mt-0.5 shrink-0 text-coral" size={14} aria-hidden /> 가격·재고는 쿠팡 페이지에서 최종 확인</p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-black text-pine">PUBLISHED DEALS</p>
            <h2 className="mt-1 text-2xl font-black">검수 완료 {label} 딜</h2>
          </div>
          <Link className="focus-ring inline-flex items-center gap-2 text-sm font-black text-pine hover:text-ink" href={`/deals?category=${category}`}>
            상세 필터 열기 <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
        {products.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => <DealCard key={product.id} product={product} />)}
          </div>
        ) : (
          <div className="mt-5 flex flex-col justify-between gap-5 border-y border-line py-6 sm:flex-row sm:items-center">
            <div className="flex gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-pine/10 text-pine"><ClipboardCheck size={21} aria-hidden /></span>
              <div>
                <h3 className="font-black">공개 검수를 통과한 {label} 딜을 준비 중입니다</h3>
                <p className="mt-1 text-sm font-semibold leading-6 text-steel">가격과 반품 근거가 확인되기 전에는 상품 수를 채우기 위해 임의 게시하지 않습니다.</p>
              </div>
            </div>
            <Link className="focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-pine px-4 py-3 text-sm font-black text-pine hover:bg-pine hover:text-white" href="/guide/safe-categories">
              반품 안전 기준 보기 <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        )}
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:py-10">
          <div>
            <p className="text-sm font-black text-pine">BUYING CRITERIA</p>
            <h2 className="mt-1 text-2xl font-black">구매 전 비교 기준</h2>
            <div className="mt-5 grid gap-3">
              {content.dealChecks.map((item) => (
                <article key={item.title} className="rounded-lg border border-line p-4">
                  <h3 className="font-black">{item.title}</h3>
                  <p className="mt-1 text-sm font-semibold leading-6 text-steel">{item.detail}</p>
                </article>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-black text-coral">FIRST 24 HOURS</p>
            <h2 className="mt-1 text-2xl font-black">수령 직후 확인</h2>
            <div className="mt-5 grid gap-3">
              {content.receiptChecks.map((item) => (
                <article key={item.title} className="rounded-lg border border-line p-4">
                  <h3 className="font-black">{item.title}</h3>
                  <p className="mt-1 text-sm font-semibold leading-6 text-steel">{item.detail}</p>
                </article>
              ))}
            </div>
            <Link className="focus-ring mt-4 inline-flex items-center gap-2 text-sm font-black text-pine hover:text-ink" href="/guide/return-checklist">
              전체 수령 체크리스트 <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <p className="text-sm font-black text-pine">FAQ</p>
        <h2 className="mt-1 text-2xl font-black">반품 {label} 자주 묻는 질문</h2>
        <div className="mt-4 divide-y divide-line border-y border-line">
          {faqItems.map((item) => (
            <details key={item.question} className="group py-4">
              <summary className="focus-ring cursor-pointer list-none pr-8 font-black marker:hidden">{item.question}</summary>
              <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-steel">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <h2 className="text-xl font-black">다른 카테고리 비교</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {otherCategories.map((item) => (
              <Link key={item.value} className="focus-ring flex items-center justify-between rounded-lg border border-line px-4 py-3 text-sm font-black hover:border-pine hover:bg-mist" href={`/deals/category/${item.value}`}>
                {item.label} <ArrowRight size={15} aria-hidden />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <AffiliateNotice />
      </section>
    </main>
  );
}
