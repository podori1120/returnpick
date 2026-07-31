import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import DealRadar from "@/components/DealRadar";
import DealCard from "@/components/DealCard";
import AffiliateNotice from "@/components/AffiliateNotice";
import ApprovalSampleCard from "@/components/ApprovalSampleCard";
import { ProductImpressionTracker } from "@/components/AffiliateEventTracker";
import RecentDealsRail from "@/components/RecentDealsRail";
import SavedFilterBar from "@/components/SavedFilterBar";
import { categoryOptions } from "@/lib/category";
import {
  getDealPrice,
  getDiscountRate,
  isPriceBand,
  isUseCase,
  matchesPriceBand,
  matchesUseCase,
  priceBandOptions,
  useCaseOptions,
  type UseCaseId
} from "@/lib/dealIntelligence";
import { formatPercent, formatPrice } from "@/lib/format";
import { listProducts } from "@/lib/dataStore";
import { approvalSampleProduct } from "@/lib/approvalSample";
import { isPublicDealReady } from "@/lib/publicDeal";
import { getDealQuality, type DealQualityStatus } from "@/lib/quality";
import { getSiteUrl } from "@/lib/siteUrl";
import type { Category, ConditionGrade, ProductWithScore } from "@/lib/types";

export const dynamic = "force-dynamic";

const canonicalUrl = `${getSiteUrl()}/deals`;
const pageTitle = "검수된 반품·리퍼 딜 비교";
const pageDescription = "반품·리퍼 상품의 가격, 상태, 반품 근거와 상품별 쿠팡 파트너스 링크를 한곳에서 비교하세요.";

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
    images: [{ url: `${getSiteUrl()}/opengraph-image` }]
  },
  twitter: {
    card: "summary_large_image",
    title: `${pageTitle} | ReturnPick`,
    description: pageDescription,
    images: [`${getSiteUrl()}/twitter-image`]
  }
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isCategory(value: string | undefined): value is Category {
  return Boolean(value && categoryOptions.some((category) => category.value === value));
}

function numberParam(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isCondition(value: string | undefined): value is ConditionGrade {
  return Boolean(value && ["미개봉", "최상", "상", "중", "알수없음", "확인필요"].includes(value));
}

function isQuality(value: string | undefined): value is DealQualityStatus {
  return Boolean(value && ["ready", "manual_check", "watch_price", "hold"].includes(value));
}

function sortProducts(products: ProductWithScore[], sort: string | undefined, useCase?: UseCaseId) {
  return [...products].sort((a, b) => {
    if (sort === "fit" && useCase) {
      const aFit = matchesUseCase(a, useCase) ? 1 : 0;
      const bFit = matchesUseCase(b, useCase) ? 1 : 0;
      return bFit - aFit || (b.latest_score?.total_score ?? 0) - (a.latest_score?.total_score ?? 0);
    }
    if (sort === "discount") {
      const ad = getDiscountRate(a) ?? -1;
      const bd = getDiscountRate(b) ?? -1;
      return bd - ad;
    }
    if (sort === "price") return (getDealPrice(b) ?? 0) - (getDealPrice(a) ?? 0);
    if (sort === "low_price") return (getDealPrice(a) ?? 0) - (getDealPrice(b) ?? 0);
    if (sort === "confidence") return getDealQuality(b).confidence - getDealQuality(a).confidence;
    if (sort === "latest") return b.created_at.localeCompare(a.created_at);
    return (b.latest_score?.total_score ?? 0) - (a.latest_score?.total_score ?? 0);
  });
}

function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function buildDealListJsonLd(products: ProductWithScore[]) {
  const items = products.slice(0, 60).map((product, index) => {
    const url = `${canonicalUrl}/${product.id}`;
    return {
      "@type": "ListItem",
      position: index + 1,
      url,
      item: {
        "@type": "Product",
        name: product.title,
        url
      }
    };
  });

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${canonicalUrl}#deal-list`,
    name: pageTitle,
    url: canonicalUrl,
    numberOfItems: items.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: items
  };
}

function compactPageRange(current: number, total: number) {
  const pages = new Set([1, total, current - 1, current, current + 1].filter((page) => page >= 1 && page <= total));
  return Array.from(pages).sort((a, b) => a - b);
}

function EmptyDealsCatalog() {
  const checks = [
    { icon: CheckCircle2, title: "상품 연결 확인", body: "파트너스 링크와 쿠팡 상품번호가 연결된 추천만 보여드립니다." },
    { icon: RefreshCw, title: "거래 조건 실시간 확인", body: "가격, 재고와 배송 조건은 쿠팡의 현재 표시를 기준으로 확인합니다." },
    { icon: ShieldCheck, title: "제휴 관계 공개", body: "구매 이동 전에 파트너스 수수료 안내와 주의사항을 명확히 표시합니다." }
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6">
      <header className="border-b border-line pb-6">
        <p className="text-sm font-black text-pine">ReturnPick Direct Review</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">지금 확인할 수 있는 직접 검수 추천</h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-steel">
          상품별 근거와 파트너스 링크 검수를 마친 자동 딜은 아직 공개 전입니다. 빈 통계와 검색 결과 대신 실제 구매 경로가 확인된 추천부터 보여드립니다.
        </p>
      </header>

      <section className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center" aria-labelledby="direct-review-title">
        <div>
          <p className="text-xs font-black text-pine">현재 공개 추천 1건</p>
          <h2 id="direct-review-title" className="mt-2 text-2xl font-black leading-tight">빈 목록 대신, 확인된 한 건을 먼저 보여드립니다</h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-steel">
            {approvalSampleProduct.name}의 핵심 사양과 구매 전 확인할 점을 정리했습니다. 확인되지 않은 가격이나 재고를 만들어 넣지 않고 마지막 거래 조건은 쿠팡에서 직접 확인합니다.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {checks.map((check) => (
              <div key={check.title} className="border-t border-line pt-3">
                <check.icon className="text-pine" size={20} aria-hidden />
                <h3 className="mt-2 text-sm font-black text-ink">{check.title}</h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-steel">{check.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-5 py-3 text-sm font-black text-white hover:bg-ink" href={approvalSampleProduct.detailPath}>
              구매 전 체크 보기 <ArrowRight size={16} aria-hidden />
            </Link>
            <Link className="focus-ring rounded-lg border border-line bg-white px-5 py-3 text-sm font-black text-ink hover:border-pine hover:text-pine" href="/guide/return-checklist">
              수령 체크리스트
            </Link>
          </div>
        </div>
        <ApprovalSampleCard placement="deals" />
      </section>

      <AffiliateNotice />
    </main>
  );
}

export default async function DealsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const categoryParam = getParam(resolvedSearchParams.category);
  const search = getParam(resolvedSearchParams.search);
  const sort = getParam(resolvedSearchParams.sort);
  const condition = getParam(resolvedSearchParams.condition);
  const quality = getParam(resolvedSearchParams.quality);
  const stock = getParam(resolvedSearchParams.stock);
  const useCaseParam = getParam(resolvedSearchParams.useCase);
  const priceBandParam = getParam(resolvedSearchParams.priceBand);
  const minScore = numberParam(getParam(resolvedSearchParams.minScore), 0);
  const minDiscount = numberParam(getParam(resolvedSearchParams.minDiscount), 0) / 100;
  const minPrice = numberParam(getParam(resolvedSearchParams.minPrice), 0);
  const maxPrice = numberParam(getParam(resolvedSearchParams.maxPrice), Number.POSITIVE_INFINITY);
  const pageSize = Math.min(60, Math.max(12, numberParam(getParam(resolvedSearchParams.pageSize), 24)));
  const requestedPage = Math.max(1, numberParam(getParam(resolvedSearchParams.page), 1));
  const category = isCategory(categoryParam) ? categoryParam : undefined;
  const selectedCondition = isCondition(condition) ? condition : undefined;
  const selectedQuality = isQuality(quality) ? quality : undefined;
  const selectedUseCase = isUseCase(useCaseParam) ? useCaseParam : undefined;
  const selectedPriceBand = isPriceBand(priceBandParam) ? priceBandParam : undefined;
  const allPublished = (await listProducts({ published: true })).filter(isPublicDealReady);
  if (!allPublished.length) return <EmptyDealsCatalog />;
  const dealListJsonLd = buildDealListJsonLd(sortProducts(allPublished, "score"));

  const filteredProducts = sortProducts(
    allPublished
      .filter((product) => (category ? product.category === category : true))
      .filter((product) => (search ? product.title.toLowerCase().includes(search.toLowerCase()) : true))
      .filter((product) => (selectedCondition ? product.condition_grade === selectedCondition : true))
      .filter((product) => (selectedQuality ? getDealQuality(product).status === selectedQuality : true))
      .filter((product) => (selectedUseCase ? matchesUseCase(product, selectedUseCase) : true))
      .filter((product) => (selectedPriceBand ? matchesPriceBand(product, selectedPriceBand) : true))
      .filter((product) => (stock === "one" ? product.stock_count === 1 : true))
      .filter((product) => (stock === "in_stock" ? (product.stock_count ?? 0) > 0 : true))
      .filter((product) => (stock === "unknown" ? product.stock_count == null : true))
      .filter((product) => (product.latest_score?.total_score ?? 0) >= minScore)
      .filter((product) => (getDiscountRate(product) ?? -1) >= minDiscount)
      .filter((product) => {
        const price = getDealPrice(product) ?? 0;
        return price >= minPrice && price <= maxPrice;
      }),
    sort,
    selectedUseCase
  );
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const products = filteredProducts.slice((page - 1) * pageSize, page * pageSize);
  const counts = categoryOptions.map((option) => ({
    ...option,
    count: allPublished.filter((product) => product.category === option.value).length
  }));
  const verifiedCount = filteredProducts.filter((product) => product.return_price && !["확인필요", "알수없음"].includes(product.condition_grade)).length;
  const manualCheckCount = filteredProducts.filter((product) => getDealQuality(product).status === "manual_check" || getDealQuality(product).status === "hold").length;
  const qualityBuckets: Array<{ status: DealQualityStatus; label: string; description: string }> = [
    { status: "ready", label: "게시 적합", description: "가격과 반품 근거가 모두 좋은 편" },
    { status: "manual_check", label: "수동 확인", description: "반품가나 등급 보완 필요" },
    { status: "watch_price", label: "가격 관찰", description: "조건은 무난하지만 할인폭 확인" },
    { status: "hold", label: "보류 우선", description: "위험 플래그가 많은 후보" }
  ];
  const qualityCounts = qualityBuckets.map((bucket) => ({
    ...bucket,
    count: allPublished.filter((product) => getDealQuality(product).status === bucket.status).length
  }));
  const averageScore = filteredProducts.length
    ? Math.round(filteredProducts.reduce((sum, product) => sum + (product.latest_score?.total_score ?? 0), 0) / filteredProducts.length)
    : 0;
  const bestDiscount = filteredProducts.reduce((best, product) => Math.max(best, getDiscountRate(product) ?? 0), 0);
  const cheapest = filteredProducts.reduce<number | null>((best, product) => {
    const price = getDealPrice(product);
    if (!price) return best;
    return best == null ? price : Math.min(best, price);
  }, null);
  const baseParams = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    const param = getParam(value);
    if (param) baseParams.set(key, param);
  }
  function hrefWith(overrides: Record<string, string | number | null | undefined>) {
    const params = new URLSearchParams(baseParams);
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null || value === undefined || value === "") params.delete(key);
      else params.set(key, String(value));
    }
    const query = params.toString();
    return query ? `/deals?${query}` : "/deals";
  }
  const pageRange = compactPageRange(page, totalPages);
  const quickFilters = [
    { label: "80점 이상", description: "강력추천급 먼저 보기", href: hrefWith({ minScore: 80, page: 1 }) },
    { label: "20% 이상", description: "할인폭 큰 상품만", href: hrefWith({ minDiscount: 20, page: 1 }) },
    { label: "게시 적합", description: "반품 근거가 안정적인 딜", href: hrefWith({ quality: "ready", page: 1 }) },
    { label: "확인필요", description: "관리자 보완 대상", href: hrefWith({ condition: "확인필요", page: 1 }) },
    { label: "재고 1개", description: "빠르게 확인할 상품", href: hrefWith({ stock: "one", page: 1 }) }
  ];
  const useCaseLinks = useCaseOptions.map((option) => ({
    ...option,
    href: hrefWith({ useCase: option.id, sort: "fit", page: 1 }),
    count: allPublished.filter((product) => matchesUseCase(product, option.id)).length
  }));
  const priceBandLinks = priceBandOptions.map((option) => ({
    ...option,
    href: hrefWith({ priceBand: option.id, page: 1 }),
    count: allPublished.filter((product) => matchesPriceBand(product, option.id)).length
  }));

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(dealListJsonLd) }} />
      <ProductImpressionTracker productIds={products.map((product) => product.id)} />
      <div>
        <p className="text-sm font-black text-pine">ReturnPick Deals</p>
        <h1 className="text-3xl font-black tracking-tight">검수 완료 딜</h1>
        <p className="mt-2 text-sm font-semibold text-steel">
          조건에 맞는 공개 상품 {filteredProducts.length.toLocaleString("ko-KR")}개 중 {products.length.toLocaleString("ko-KR")}개를 보여주고 있습니다.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["결과", `${filteredProducts.length.toLocaleString("ko-KR")}개`],
          ["평균 점수", `${averageScore}점`],
          ["최대 할인", formatPercent(bestDiscount)],
          ["최저 판매가", formatPrice(cheapest)],
          ["반품 확인", `${verifiedCount.toLocaleString("ko-KR")}개`]
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-white p-4 shadow-soft">
            <p className="text-xs font-black text-steel">{label}</p>
            <p className="mt-1 text-2xl font-black">{value}</p>
          </div>
        ))}
      </section>

      <form className="grid gap-2 rounded-lg border border-line bg-white p-4 shadow-soft lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <input type="hidden" name="page" value="1" />
        <input className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" name="search" defaultValue={search} placeholder="상품 검색" />
        <select className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" name="category" defaultValue={category ?? ""}>
          <option value="">전체 카테고리</option>
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" name="sort" defaultValue={sort ?? "score"}>
          <option value="score">점수 높은 순</option>
          <option value="fit">용도 적합 순</option>
          <option value="discount">할인율 높은 순</option>
          <option value="confidence">검수 신뢰도 순</option>
          <option value="latest">최신 게시순</option>
          <option value="price">가격 높은 순</option>
          <option value="low_price">가격 낮은 순</option>
        </select>
        <select className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" name="condition" defaultValue={selectedCondition ?? ""}>
          <option value="">전체 상태</option>
          {["미개봉", "최상", "상", "중", "알수없음", "확인필요"].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" name="quality" defaultValue={selectedQuality ?? ""}>
          <option value="">전체 검수</option>
          <option value="ready">게시 적합</option>
          <option value="manual_check">수동 확인</option>
          <option value="watch_price">가격 관찰</option>
          <option value="hold">보류 우선</option>
        </select>
        <select className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" name="useCase" defaultValue={selectedUseCase ?? ""}>
          <option value="">전체 용도</option>
          {useCaseOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <select className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" name="priceBand" defaultValue={selectedPriceBand ?? ""}>
          <option value="">전체 가격대</option>
          {priceBandOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <select className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" name="stock" defaultValue={stock ?? ""}>
          <option value="">전체 재고</option>
          <option value="one">재고 1개</option>
          <option value="in_stock">재고 있음</option>
          <option value="unknown">재고 확인필요</option>
        </select>
        <input className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" name="minScore" defaultValue={minScore || ""} placeholder="최소 점수" inputMode="numeric" />
        <input className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" name="minDiscount" defaultValue={minDiscount ? Math.round(minDiscount * 100) : ""} placeholder="최소 할인율 %" inputMode="numeric" />
        <input className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" name="minPrice" defaultValue={minPrice || ""} placeholder="최소 가격" inputMode="numeric" />
        <input className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" name="maxPrice" defaultValue={Number.isFinite(maxPrice) ? maxPrice : ""} placeholder="최대 가격" inputMode="numeric" />
        <select className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" name="pageSize" defaultValue={pageSize}>
          <option value="24">24개씩</option>
          <option value="36">36개씩</option>
          <option value="48">48개씩</option>
          <option value="60">60개씩</option>
        </select>
        <button className="focus-ring rounded-lg bg-ink px-4 py-2 text-sm font-black text-white hover:bg-pine">필터 적용</button>
        <Link className="focus-ring rounded-lg border border-line px-4 py-2 text-center text-sm font-black hover:bg-mist" href="/deals">
          초기화
        </Link>
      </form>

      <SavedFilterBar />
      <RecentDealsRail />

      <section className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black text-pine">Quick Filters</p>
              <h2 className="text-lg font-black">바로 걸러보기</h2>
            </div>
            <Link className="text-xs font-black text-steel hover:text-pine" href="/deals">
              전체 보기
            </Link>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {quickFilters.map((filter) => (
              <Link key={filter.label} className="rounded-lg border border-line p-3 text-sm hover:border-pine hover:bg-mist" href={filter.href}>
                <span className="block font-black text-ink">{filter.label}</span>
                <span className="mt-1 block text-xs font-bold leading-5 text-steel">{filter.description}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
          <p className="text-xs font-black text-pine">Review Mix</p>
          <h2 className="text-lg font-black">검수 분포</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {qualityCounts.map((bucket) => (
              <Link
                key={bucket.status}
                className="rounded-lg border border-line p-3 text-sm hover:border-pine hover:bg-mist"
                href={hrefWith({ quality: bucket.status, page: 1 })}
              >
                <span className="block text-xs font-bold text-steel">{bucket.label}</span>
                <span className="mt-1 block text-xl font-black text-ink">{bucket.count.toLocaleString("ko-KR")}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <DealRadar products={filteredProducts} useCaseLinks={useCaseLinks} priceBandLinks={priceBandLinks} />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <Link
          className="rounded-lg border border-line bg-white p-3 text-sm font-black hover:border-pine hover:bg-mist"
          href={hrefWith({ category: null, page: 1 })}
        >
          <span className="block text-steel">전체</span>
          <span className="mt-1 block text-xl text-ink">{allPublished.length}</span>
        </Link>
        {counts.map((item) => (
          <Link
            key={item.value}
            className="rounded-lg border border-line bg-white p-3 text-sm font-black hover:border-pine hover:bg-mist"
            href={hrefWith({ category: item.value, page: 1 })}
          >
            <span className="block text-steel">{item.label}</span>
            <span className="mt-1 block text-xl text-ink">{item.count}</span>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white p-4 text-sm font-bold text-steel">
        <span>
          {filteredProducts.length ? `${(page - 1) * pageSize + 1}~${Math.min(page * pageSize, filteredProducts.length)}번째` : "0개"} 표시
        </span>
        <span>수동 확인 필요 {manualCheckCount.toLocaleString("ko-KR")}개</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <DealCard key={product.id} product={product} />
        ))}
      </div>
      {!products.length ? (
        <section className="grid gap-6 border-y border-line py-6 lg:grid-cols-[1fr_420px] lg:items-center">
          <div className="px-1 py-3 lg:pr-8">
            <p className="text-sm font-black text-pine">직접 검수 추천</p>
            <h2 className="mt-2 text-2xl font-black">구매 페이지가 확인된 상품을 먼저 보세요</h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-steel">
              자동 수집 딜은 가격과 반품 근거를 검수 중입니다. 지금은 상품 정보와 쿠팡 이동 경로를 직접 확인한 추천 상품을 먼저 볼 수 있습니다.
            </p>
            <p className="mt-3 text-xs font-semibold leading-5 text-steel">가격과 재고는 표시 시점에 따라 달라질 수 있어 쿠팡 상품 페이지에서 최종 확인하도록 안내합니다.</p>
          </div>
          <ApprovalSampleCard placement="deals" />
        </section>
      ) : null}

      {totalPages > 1 ? (
        <nav className="flex flex-wrap items-center justify-center gap-2">
          <Link
            className="focus-ring rounded-lg border border-line bg-white px-4 py-2 text-sm font-black hover:bg-mist aria-disabled:pointer-events-none aria-disabled:opacity-50"
            href={hrefWith({ page: Math.max(1, page - 1) })}
            aria-disabled={page === 1}
          >
            이전
          </Link>
          {pageRange.map((pageNumber) => (
            <Link
              key={pageNumber}
              className={`focus-ring rounded-lg border px-4 py-2 text-sm font-black ${
                pageNumber === page ? "border-pine bg-pine text-white" : "border-line bg-white hover:bg-mist"
              }`}
              href={hrefWith({ page: pageNumber })}
            >
              {pageNumber}
            </Link>
          ))}
          <Link
            className="focus-ring rounded-lg border border-line bg-white px-4 py-2 text-sm font-black hover:bg-mist aria-disabled:pointer-events-none aria-disabled:opacity-50"
            href={hrefWith({ page: Math.min(totalPages, page + 1) })}
            aria-disabled={page === totalPages}
          >
            다음
          </Link>
        </nav>
      ) : null}

      <AffiliateNotice />
    </main>
  );
}
