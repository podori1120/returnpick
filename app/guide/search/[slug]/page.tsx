import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, Search, ShieldCheck } from "lucide-react";
import AffiliateNotice from "@/components/AffiliateNotice";
import { ProductImpressionTracker } from "@/components/AffiliateEventTracker";
import DealCard from "@/components/DealCard";
import DemoModeNotice from "@/components/DemoModeNotice";
import { getCategoryLabel } from "@/lib/category";
import { getCategoryLandingContent } from "@/lib/categoryLanding";
import { listProducts } from "@/lib/dataStore";
import { isDemoProduct, isPublicDealVisible } from "@/lib/publicDeal";
import { matchesSearchIntent } from "@/lib/searchIntentMatcher";
import { getSearchIntentLanding, searchIntentLandings } from "@/lib/searchLandings";
import { getSiteUrl } from "@/lib/siteUrl";
import type { ProductWithScore } from "@/lib/types";

export const dynamic = "force-dynamic";
export const dynamicParams = false;

export function generateStaticParams() {
  return searchIntentLandings.map((landing) => ({ slug: landing.slug }));
}

function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function buildJsonLd(landing: ReturnType<typeof getSearchIntentLanding>, products: ProductWithScore[], canonicalUrl: string) {
  if (!landing) return null;
  const itemList = products.slice(0, 24).map((product, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: `${getSiteUrl()}/deals/${product.id}`,
    name: product.title
  }));
  const categoryLabel = getCategoryLabel(landing.category);

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${canonicalUrl}#page`,
    name: landing.seoTitle,
    description: landing.seoDescription,
    url: canonicalUrl,
    isPartOf: { "@type": "WebSite", name: "ReturnPick", url: getSiteUrl() },
    about: { "@type": "Thing", name: `${landing.label} ${categoryLabel} 구매 기준` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: itemList.length,
      itemListElement: itemList
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "홈", item: getSiteUrl() },
        { "@type": "ListItem", position: 2, name: "구매 가이드", item: `${getSiteUrl()}/guide/safe-categories` },
        { "@type": "ListItem", position: 3, name: landing.label, item: canonicalUrl }
      ]
    },
    ...(landing.faqs.length
      ? {
          hasPart: {
            "@type": "FAQPage",
            mainEntity: landing.faqs.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: { "@type": "Answer", text: faq.answer }
            }))
          }
        }
      : {})
  };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const landing = getSearchIntentLanding(slug);
  if (!landing) {
    return { title: "가이드를 찾을 수 없습니다", robots: { index: false, follow: false } };
  }

  const canonicalUrl = `${getSiteUrl()}/guide/search/${landing.slug}`;
  return {
    title: landing.seoTitle,
    description: landing.seoDescription,
    keywords: [landing.label, ...landing.searchQueries, "반품 상품", "ReturnPick"],
    alternates: { canonical: canonicalUrl },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${landing.seoTitle} | ReturnPick`,
      description: landing.seoDescription,
      url: canonicalUrl,
      type: "article",
      locale: "ko_KR",
      siteName: "ReturnPick",
      images: [{ url: `${getSiteUrl()}/opengraph-image` }]
    },
    twitter: {
      card: "summary_large_image",
      title: `${landing.seoTitle} | ReturnPick`,
      description: landing.seoDescription,
      images: [`${getSiteUrl()}/twitter-image`]
    }
  };
}

export default async function SearchIntentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const landing = getSearchIntentLanding(slug);
  if (!landing) notFound();

  const categoryContent = getCategoryLandingContent(landing.category);
  const products = (await listProducts({ published: true, category: landing.category }))
    .filter(isPublicDealVisible)
    .filter((product) => matchesSearchIntent(product, landing))
    .sort((a, b) => (b.latest_score?.total_score ?? 0) - (a.latest_score?.total_score ?? 0))
    .slice(0, 24);
  const demoCount = products.filter(isDemoProduct).length;
  const canonicalUrl = `${getSiteUrl()}/guide/search/${landing.slug}`;
  const jsonLd = buildJsonLd(landing, products, canonicalUrl);
  const relatedLandings = searchIntentLandings.filter((item) => item.category === landing.category && item.slug !== landing.slug).slice(0, 4);

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} /> : null}
      {products.length ? <ProductImpressionTracker productIds={products.map((product) => product.id)} channel="web_search_landing" context={landing.slug} /> : null}

      <header className="border-b border-line pb-7">
        <div className="flex flex-wrap items-center gap-2 text-sm font-black text-pine">
          <Search size={18} aria-hidden />
          <span>ReturnPick 검색 가이드</span>
        </div>
        <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-tight sm:text-4xl">{landing.seoTitle}</h1>
        <p className="mt-4 max-w-4xl text-sm font-semibold leading-7 text-steel">{landing.intro}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-mist p-4">
            <p className="text-xs font-black text-steel">검색 조건</p>
            <p className="mt-1 text-sm font-black text-ink">{landing.searchLabel}</p>
          </div>
          <div className="rounded-lg border border-line bg-mist p-4">
            <p className="text-xs font-black text-steel">카테고리</p>
            <p className="mt-1 text-sm font-black text-ink">{getCategoryLabel(landing.category)}</p>
          </div>
          <div className="rounded-lg border border-line bg-mist p-4">
            <p className="text-xs font-black text-steel">공개 기준</p>
            <p className="mt-1 text-sm font-black text-ink">검수·구매 링크 확인 후 공개</p>
          </div>
        </div>
      </header>

      {demoCount ? <DemoModeNotice count={demoCount} /> : null}

      {products.length ? (
        <section aria-labelledby="search-results-heading">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
            <div>
              <p className="text-sm font-black text-pine">{demoCount ? "로컬에서 확인 가능한 샘플" : "현재 공개된 검수 딜"}</p>
              <h2 id="search-results-heading" className="mt-1 text-2xl font-black">{landing.label} 조건에 맞는 상품</h2>
              <p className="mt-1 text-sm font-semibold text-steel">{demoCount ? "화면·검색 흐름 확인용 샘플을" : "검수 완료 상품"} {products.length.toLocaleString("ko-KR")}개를 점수순으로 보여드립니다.</p>
            </div>
            <Link className="focus-ring inline-flex items-center gap-2 text-sm font-black text-pine hover:text-ink" href={`/deals?category=${landing.category}`}>
              카테고리 전체 보기 <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => <DealCard key={product.id} product={product} />)}
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-line bg-mist p-6 sm:p-8" aria-labelledby="search-empty-heading">
          <div className="flex size-11 items-center justify-center rounded-md bg-white text-pine">
            <ShieldCheck size={23} aria-hidden />
          </div>
          <h2 id="search-empty-heading" className="mt-4 text-2xl font-black">현재 공개된 검수 딜은 아직 없습니다</h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-steel">
            가격·상품 식별·구매 경로를 확인한 상품만 공개하고 검색 결과를 숫자로 채우지 않습니다. 반품등급·반품가·재고처럼 공개 근거가 부족한 항목은 확인필요로 남깁니다. 조건을 통과한 상품이 들어오면 같은 페이지에서 바로 비교할 수 있습니다.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-4 py-2.5 text-sm font-black text-white hover:bg-ink" href={`/deals/category/${landing.category}`}>
              {getCategoryLabel(landing.category)} 구매 기준 <ArrowRight size={16} aria-hidden />
            </Link>
            <Link className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-black text-ink hover:border-pine hover:text-pine" href="/deals">
              전체 공개 딜 <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" aria-labelledby="search-checks-heading">
        <div>
          <div className="flex items-center gap-2 text-pine">
            <CheckCircle2 size={19} aria-hidden />
            <p className="text-sm font-black">구매 전 비교 기준</p>
          </div>
          <h2 id="search-checks-heading" className="mt-2 text-2xl font-black">{landing.label}에서 먼저 볼 것</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {landing.comparePoints.map((point) => (
              <article key={point.title} className="rounded-lg border border-line bg-white p-4">
                <h3 className="text-sm font-black text-ink">{point.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-steel">{point.detail}</p>
              </article>
            ))}
          </div>
        </div>
        <aside className="rounded-lg border border-line bg-mist p-5">
          <p className="text-xs font-black text-pine">공개 데이터 원칙</p>
          <h2 className="mt-2 text-lg font-black">확인된 정보만 표시</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-steel">{categoryContent.intro}</p>
          <div className="mt-4 flex items-start gap-2 text-xs font-bold leading-5 text-steel">
            <ShieldCheck className="mt-0.5 shrink-0 text-pine" size={15} aria-hidden />
            <span>반품 근거가 없으면 확인필요로 남기고, 최종 가격·재고·배송은 구매처에서 다시 확인합니다.</span>
          </div>
        </aside>
      </section>

      <section aria-labelledby="search-faq-heading">
        <p className="text-sm font-black text-pine">FAQ</p>
        <h2 id="search-faq-heading" className="mt-1 text-2xl font-black">{landing.label} 자주 묻는 질문</h2>
        <div className="mt-4 divide-y divide-line border-y border-line">
          {landing.faqs.map((faq) => (
            <details key={faq.question} className="group py-4">
              <summary className="focus-ring cursor-pointer list-none pr-8 font-black marker:hidden">{faq.question}</summary>
              <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-steel">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {relatedLandings.length ? (
        <section className="border-t border-line pt-7" aria-labelledby="related-search-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-black text-pine">같은 카테고리 가이드</p>
              <h2 id="related-search-heading" className="mt-1 text-2xl font-black">비슷한 조건도 비교해 보세요</h2>
            </div>
            <Link className="focus-ring inline-flex items-center gap-2 text-sm font-black text-pine hover:text-ink" href="/guide/safe-categories">
              전체 구매 가이드 <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {relatedLandings.map((item) => (
              <Link key={item.slug} className="focus-ring rounded-lg border border-line bg-white p-4 hover:border-pine hover:bg-mist" href={`/guide/search/${item.slug}`}>
                <p className="text-sm font-black text-ink">{item.label}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-steel">{item.searchLabel}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-pine">가이드 보기 <ArrowRight size={13} aria-hidden /></span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <AffiliateNotice />
    </main>
  );
}
