import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import AffiliateNotice from "@/components/AffiliateNotice";
import ApprovalSampleCard from "@/components/ApprovalSampleCard";
import DealCard from "@/components/DealCard";
import DemoModeNotice from "@/components/DemoModeNotice";
import { ProductImpressionTracker } from "@/components/AffiliateEventTracker";
import { approvalSampleProduct } from "@/lib/approvalSample";
import { categoryOptions } from "@/lib/category";
import { listProducts } from "@/lib/dataStore";
import { homeCategoryDetails } from "@/lib/homeDiscovery";
import { isDemoProduct, isPublicDealVisible } from "@/lib/publicDeal";
import { getSiteUrl } from "@/lib/siteUrl";
import type { ProductWithScore } from "@/lib/types";

export const dynamic = "force-dynamic";

const siteUrl = getSiteUrl();
const canonicalUrl = `${siteUrl}/picks`;
const pageTitle = "반품 상품 검수 추천 모음";
const pageDescription = "ReturnPick이 구매 전 가격, 사양, 반품 위험과 쿠팡 확인 항목을 정리한 추천 콘텐츠 모음입니다.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: { canonical: canonicalUrl },
  robots: { index: true, follow: true },
  openGraph: {
    title: `${pageTitle} | ReturnPick`,
    description: pageDescription,
    url: canonicalUrl,
    type: "website",
    locale: "ko_KR",
    siteName: "ReturnPick",
    images: [{ url: `${siteUrl}/opengraph-image` }]
  },
  twitter: {
    card: "summary_large_image",
    title: `${pageTitle} | ReturnPick`,
    description: pageDescription,
    images: [`${siteUrl}/twitter-image`]
  }
};

function buildJsonLd(products: ProductWithScore[]) {
  const items = products.slice(0, 12).map((product, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: `${siteUrl}/deals/${product.id}`,
    name: product.title
  }));

  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: pageTitle,
    description: pageDescription,
    url: canonicalUrl,
    isPartOf: { "@type": "WebSite", name: "ReturnPick", url: siteUrl },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items
    }
  }).replace(/</g, "\\u003c");
}

function sortProducts(products: ProductWithScore[]) {
  return [...products].sort((a, b) => {
    const scoreGap = (b.latest_score?.total_score ?? 0) - (a.latest_score?.total_score ?? 0);
    if (scoreGap) return scoreGap;
    return (b.last_observed_at ?? b.updated_at).localeCompare(a.last_observed_at ?? a.updated_at);
  });
}

export default async function PicksPage() {
  const products = sortProducts((await listProducts({ published: true })).filter(isPublicDealVisible));
  const featuredProducts = products.slice(0, 6);
  const demoCount = products.filter(isDemoProduct).length;

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: buildJsonLd(featuredProducts) }} />
      <ProductImpressionTracker productIds={featuredProducts.map((product) => product.id)} channel="web_editorial_index" />

      <header className="border-b border-line pb-7">
        <div className="flex flex-wrap items-center gap-2 text-sm font-black text-pine">
          <BookOpenCheck size={18} aria-hidden />
          <span>ReturnPick 검수 추천</span>
        </div>
        <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-tight sm:text-4xl">구매 전에 확인할 추천 콘텐츠</h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-steel">
          상품을 바로 사라고 밀기보다, 가격 기준·핵심 사양·반품 확인 항목을 먼저 정리합니다. 최종 가격과 재고, 배송 조건은 쿠팡 상품 페이지에서 직접 확인하세요.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-5 py-3 text-sm font-black text-white hover:bg-ink" href="/deals">
            공개 딜 둘러보기 <ArrowRight size={16} aria-hidden />
          </Link>
          <Link className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-5 py-3 text-sm font-black text-ink hover:border-pine hover:text-pine" href="/guide/return-checklist">
            수령 체크리스트 <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </header>
      {demoCount ? <DemoModeNotice count={demoCount} /> : null}

      <section className="grid gap-4 lg:grid-cols-3" aria-label="검수 기준">
        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <Sparkles className="text-pine" size={22} aria-hidden />
          <h2 className="mt-3 text-lg font-black">가격 기준</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-steel">네이버 최저가, 새상품가, 판매가 중 확인 가능한 기준을 비교하고 수집 시점을 함께 표시합니다.</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <CheckCircle2 className="text-pine" size={22} aria-hidden />
          <h2 className="mt-3 text-lg font-black">사양 적합성</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-steel">상품명에서 읽은 모델·사양을 용도별로 정리해 사무, 게이밍, 휴대, 청소 같은 선택 기준을 제공합니다.</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <ShieldCheck className="text-pine" size={22} aria-hidden />
          <h2 className="mt-3 text-lg font-black">반품 확인</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-steel">공식 API나 허용된 공개 근거가 없는 반품 등급·반품가는 추정하지 않고 확인필요로 남깁니다.</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]" aria-labelledby="editorial-pick-heading">
        <div>
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
            <div>
              <p className="text-sm font-black text-pine">EDITORIAL PICK</p>
              <h2 id="editorial-pick-heading" className="mt-1 text-2xl font-black">직접 확인한 추천 콘텐츠</h2>
              <p className="mt-1 text-sm font-semibold text-steel">현재 {featuredProducts.length.toLocaleString("ko-KR")}개의 공개 딜이 이 모음에 연결되어 있습니다.</p>
            </div>
            <Link className="focus-ring inline-flex items-center gap-1 text-sm font-black text-pine hover:text-ink" href="/deals">
              전체 딜 보기 <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
          {featuredProducts.length ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {featuredProducts.map((product) => <DealCard key={product.id} product={product} />)}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-line bg-mist p-5">
              <p className="text-sm font-black text-ink">자동 수집 딜은 관리자 검수 후 이곳에 추가됩니다.</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-steel">현재는 아래의 직접 검수 콘텐츠에서 구매 전 확인 순서와 쿠팡 가격 확인 흐름을 먼저 살펴볼 수 있습니다.</p>
            </div>
          )}
        </div>
        <ApprovalSampleCard placement="picks" />
      </section>

      <section className="border-t border-line pt-7" aria-labelledby="category-pick-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-black text-pine">CATEGORY CHECK</p>
            <h2 id="category-pick-heading" className="mt-1 text-2xl font-black">카테고리별 구매 기준</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-steel">딜이 적은 카테고리도 구매 전 확인할 기준부터 볼 수 있습니다.</p>
          </div>
          <Link className="focus-ring inline-flex items-center gap-1 text-sm font-black text-pine hover:text-ink" href="/guide/safe-categories">
            안전 카테고리 안내 <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categoryOptions.map((category) => (
            <Link key={category.value} className="focus-ring rounded-lg border border-line bg-white p-4 hover:border-pine hover:bg-mist" href={`/deals/category/${category.value}`}>
              <p className="text-sm font-black text-ink">{category.label}</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-steel">{homeCategoryDetails[category.value].description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-black text-pine">기준 보기 <ArrowRight size={13} aria-hidden /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-mist p-5 sm:p-6" aria-labelledby="picks-faq-heading">
        <h2 id="picks-faq-heading" className="text-xl font-black">자주 확인하는 내용</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <h3 className="text-sm font-black">반품 등급이 없으면 어떻게 하나요?</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-steel">가격 비교와 사양 분석은 진행하되, 등급과 반품가는 확인필요로 표시하고 구매 전 쿠팡에서 다시 확인합니다.</p>
          </div>
          <div>
            <h3 className="text-sm font-black">가격은 언제 기준인가요?</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-steel">페이지에 표시된 가격은 수집 시점 기준입니다. 결제 전 쿠팡의 현재 가격·재고·배송 조건이 우선합니다.</p>
          </div>
          <div>
            <h3 className="text-sm font-black">구매 링크는 어디로 가나요?</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-steel">사용자가 직접 누른 구매 버튼만 새 탭의 쿠팡 파트너스 상품 페이지로 연결됩니다. 자동 이동은 사용하지 않습니다.</p>
          </div>
        </div>
      </section>

      <AffiliateNotice />
      <p className="text-xs font-semibold leading-5 text-steel">직접 검수 콘텐츠: <Link className="text-pine underline" href={approvalSampleProduct.detailPath}>{approvalSampleProduct.name}</Link></p>
    </main>
  );
}
