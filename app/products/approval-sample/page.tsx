import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Droplets,
  Gauge,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Truck
} from "lucide-react";
import ApprovalCoupangButton from "@/components/ApprovalCoupangButton";
import { approvalSampleProduct } from "@/lib/approvalSample";
import { getSiteUrl } from "@/lib/siteUrl";

const affiliateNotice = "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";
const productName = approvalSampleProduct.name;
const productSubtitle = approvalSampleProduct.subtitle;
const canonicalUrl = `${getSiteUrl()}/products/approval-sample`;
const editorialImageUrl = `${getSiteUrl()}${approvalSampleProduct.imageSrc}`;

const specCards = [
  { icon: Gauge, label: "흡입 고정", value: "5800Pa", body: "창문에 붙어 이동하는 제품 특성상 흡입 고정력을 우선 확인합니다." },
  { icon: Droplets, label: "물 분사", value: "자동 물 분사", body: "유리면을 닦을 때 물 분사 방식과 사용 환경의 궁합을 확인해야 합니다." },
  { icon: Sparkles, label: "사용처", value: "유리창 청소", body: "높은 창문이나 넓은 유리면을 자주 관리해야 하는 경우에 적합합니다." }
];

const recommendationReasons = [
  "창문 청소를 직접 하기 어려운 가정이나 사무실에서 확인할 만한 자동 청소기입니다.",
  "5800Pa 흡입 고정, 자동 분수, 초슬림 구조를 함께 보는 사용자에게 적합합니다.",
  "구매 전 쿠팡 페이지에서 가격, 재고, 배송 조건을 바로 확인할 수 있습니다."
];

const prePurchaseChecks = [
  "최종 가격, 재고, 배송 예정일은 쿠팡 상품 페이지 기준으로 확인해야 합니다.",
  "유리 두께, 창문 형태, 안전줄 구성품, 물 분사 방식이 사용 환경과 맞는지 확인하세요.",
  "제품 사양과 판매자 안내가 표시된 상품 페이지 정보를 우선 기준으로 판단하세요."
];

const reviewChecklist = [
  "ReturnPick 사이트 주소가 보이는 공개 페이지",
  "상품명과 상품 요약 설명",
  "쿠팡에서 가격 확인 버튼",
  "쿠팡 파트너스 제휴 고지 문구"
];

export const metadata: Metadata = {
  title: "Novatech S1 창문 로봇청소기 | ReturnPick 승인용 추천 상품",
  description: "ReturnPick 쿠팡 파트너스 최종승인 심사용 Novatech S1 창문 로봇청소기 추천 상품 상세 페이지",
  robots: {
    index: false,
    follow: false,
    nocache: true
  },
  alternates: {
    canonical: canonicalUrl
  },
  openGraph: {
    title: "Novatech S1 창문 로봇청소기 | ReturnPick",
    description: "쿠팡 파트너스 최종승인 심사용 ReturnPick 추천 상품 상세 페이지",
    url: canonicalUrl,
    siteName: "ReturnPick",
    type: "website",
    images: [{ url: editorialImageUrl, width: 1400, height: 933, alt: approvalSampleProduct.imageAlt }]
  }
};

export default function ApprovalSampleProductPage() {
  const approvalUrl = process.env.NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL?.trim() ?? "";
  const captureUrl = canonicalUrl;
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: productName,
    brand: approvalSampleProduct.brand,
    category: approvalSampleProduct.category,
    description: `${productName} ${productSubtitle}`,
    url: captureUrl,
    image: editorialImageUrl,
    sku: approvalSampleProduct.coupangProductNumber
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-8 sm:px-6 lg:pb-10 lg:pt-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />

      <section className="mb-5 rounded-lg border border-line bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-pine">ReturnPick 승인용 추천 상품 · Coupang Partners Review Page</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">{productName}</h1>
            <p className="mt-1 text-sm font-black leading-6 text-steel">{productSubtitle}</p>
            <p className="mt-1 break-all text-xs font-semibold leading-5 text-steel">공개 페이지: {captureUrl}</p>
          </div>
          <Link className="focus-ring rounded-lg border border-line px-4 py-2 text-sm font-black hover:bg-mist" href="/disclosure">
            제휴 안내
          </Link>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_390px]">
        <div className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
          <figure>
            <div className="relative aspect-[3/2] overflow-hidden bg-mist">
              <Image
                alt={approvalSampleProduct.imageAlt}
                className="object-cover"
                fill
                priority
                sizes="(min-width: 1024px) 730px, 100vw"
                src={approvalSampleProduct.imageSrc}
              />
              <div className="absolute inset-x-3 top-3 flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-md bg-white/95 px-3 py-1 text-xs font-black text-ink shadow-soft">제품 사용 연출 이미지</span>
                <span className="rounded-md bg-white/95 px-3 py-1 text-xs font-bold text-steel shadow-soft">실제 외관·구성은 쿠팡에서 확인</span>
              </div>
            </div>
            <figcaption className="border-b border-line bg-mist px-5 py-3 text-xs font-semibold leading-5 text-steel">
              {approvalSampleProduct.imageNotice}
            </figcaption>
          </figure>

          <div className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md bg-pine/10 px-2.5 py-1 text-xs font-black text-pine">ReturnPick 추천 상품</span>
              <span className="rounded-md bg-mist px-2.5 py-1 text-xs font-bold text-steel">쿠팡 파트너스 승인용</span>
              <span className="rounded-md bg-mist px-2.5 py-1 text-xs font-bold text-steel">소형가전</span>
            </div>

            <div>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{productName}</h2>
              <p className="mt-2 text-sm font-black text-pine">{productSubtitle}</p>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-steel">
                제공된 쿠팡 파트너스 링크가 이동하는 실제 상품 기준으로 구성한 승인용 추천 페이지입니다. ReturnPick은 가격, 재고,
                배송 조건이 바뀔 수 있다는 점을 전제로 쿠팡 상품 페이지에서 최종 정보를 다시 확인하도록 안내합니다.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {specCards.map((item) => (
                <section key={item.label} className="rounded-lg border border-line p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-pine">
                    <item.icon size={16} aria-hidden /> {item.label}
                  </div>
                  <p className="mt-2 text-xl font-black">{item.value}</p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-steel">{item.body}</p>
                </section>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <section className="rounded-lg border border-line p-4">
                <div className="flex items-center gap-2 text-sm font-black text-pine">
                  <CheckCircle2 size={16} aria-hidden /> 추천 이유
                </div>
                <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-ink">
                  {recommendationReasons.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section className="rounded-lg border border-line p-4">
                <div className="flex items-center gap-2 text-sm font-black text-coral">
                  <AlertTriangle size={16} aria-hidden /> 구매 전 확인할 점
                </div>
                <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-ink">
                  {prePurchaseChecks.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="rounded-lg border border-line bg-mist p-4">
              <div className="flex items-center gap-2 text-sm font-black text-ink">
                <ShieldCheck size={16} className="text-pine" aria-hidden /> 제휴 고지
              </div>
              <p className="mt-2 text-sm font-black leading-6 text-ink">{affiliateNotice}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-steel">
                ReturnPick은 사용자가 직접 누른 명확한 버튼을 통해서만 쿠팡으로 이동하게 하며, 숨은 리다이렉트나 자동 이동을 사용하지 않습니다.
              </p>
              <Link className="mt-3 inline-flex text-sm font-black text-pine hover:text-ink" href="/disclosure">
                제휴 안내 자세히 보기
              </Link>
            </section>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <p className="text-xs font-black text-pine">Coupang Partners</p>
            <h2 className="mt-2 text-xl font-black">쿠팡에서 가격 확인</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-steel">
              버튼을 누르면 쿠팡 파트너스 링크가 새 탭으로 열립니다. 구매 전 쿠팡 페이지에서 가격, 재고, 배송 정보를 최종 확인하세요.
            </p>

            {approvalUrl ? (
              <ApprovalCoupangButton href={approvalUrl} />
            ) : (
              <button
                className="mt-5 inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-line px-4 py-3 text-sm font-black text-steel"
                disabled
                type="button"
              >
                쿠팡 파트너스 링크 설정 필요
              </button>
            )}

            <p className="mt-3 rounded-lg bg-mist p-3 text-xs font-black leading-5 text-ink">{affiliateNotice}</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="font-bold text-steel">심사용 페이지</dt>
                <dd className="break-all text-right font-black text-ink">{captureUrl}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-bold text-steel">링크 상태</dt>
                <dd className={approvalUrl ? "font-black text-pine" : "font-black text-coral"}>
                  {approvalUrl ? "설정됨" : "환경변수 필요"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <h2 className="text-lg font-black">심사 캡처 체크</h2>
            <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-ink">
              {reviewChecklist.map((item) => (
                <li key={item} className="flex gap-2">
                  <ClipboardCheck className="mt-0.5 shrink-0 text-pine" size={16} aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <h2 className="text-lg font-black">ReturnPick 기준</h2>
            <div className="mt-3 grid gap-3 text-sm font-semibold leading-6 text-steel">
              <p className="flex gap-2">
                <PackageCheck className="mt-1 shrink-0 text-pine" size={16} aria-hidden />
                상품 정보와 구매 버튼을 분리하지 않고 한 페이지에서 보여줍니다.
              </p>
              <p className="flex gap-2">
                <Truck className="mt-1 shrink-0 text-pine" size={16} aria-hidden />
                가격, 재고, 배송 정보는 쿠팡 페이지에서 최종 확인하도록 안내합니다.
              </p>
              <p className="flex gap-2">
                <TimerReset className="mt-1 shrink-0 text-pine" size={16} aria-hidden />
                자동 이동이나 숨은 클릭 없이 사용자가 직접 누른 버튼만 외부로 이동합니다.
              </p>
            </div>
          </div>
        </aside>
      </section>

      {approvalUrl ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 p-3 shadow-soft backdrop-blur lg:hidden">
          <div className="mx-auto max-w-6xl">
            <ApprovalCoupangButton
              href={approvalUrl}
              className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-lg bg-pine px-4 py-3 text-sm font-black text-white hover:bg-ink"
            />
            <p className="mt-1 text-center text-[11px] font-semibold text-steel">쿠팡 파트너스 활동의 일환으로 일정액의 수수료를 제공받습니다.</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
