import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Droplets,
  Gauge,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  TimerReset
} from "lucide-react";
import ApprovalCoupangButton from "@/components/ApprovalCoupangButton";
import { EditorialPickViewTracker } from "@/components/AffiliateEventTracker";
import EditorialShareBar from "@/components/EditorialShareBar";
import { approvalSampleProduct } from "@/lib/approvalSample";
import { isCoupangPartnersLink } from "@/lib/coupangLink";
import { getSiteUrl } from "@/lib/siteUrl";

const affiliateNotice = "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";
const canonicalUrl = `${getSiteUrl()}${approvalSampleProduct.detailPath}`;
const editorialImageUrl = `${getSiteUrl()}${approvalSampleProduct.imageSrc}`;
const socialImageUrl = `${canonicalUrl}/opengraph-image`;
const twitterImageUrl = `${canonicalUrl}/twitter-image`;

const fitReasons = [
  "고층이나 넓은 유리창을 손으로 반복 청소하는 부담을 줄이고 싶은 경우",
  "흡입력과 물 분사 기능을 함께 갖춘 창문청소 로봇을 비교 중인 경우",
  "구매 전에 안전줄, 창문 크기, 구성품을 꼼꼼히 확인할 수 있는 경우"
];

const purchaseChecks = [
  {
    title: "창문 적합성",
    body: "사용하려는 유리창의 크기와 프레임 형태가 제품 사용 조건에 맞는지 확인하세요."
  },
  {
    title: "안전 구성",
    body: "안전줄과 전원선, 리모컨 등 실제 포함 구성품을 쿠팡 상품 페이지에서 확인하세요."
  },
  {
    title: "최종 거래 조건",
    body: "가격, 재고, 배송 일정, 판매자와 반품 조건은 구매 직전 쿠팡 표시를 기준으로 판단하세요."
  }
];

const facts = [
  { label: "확인된 상품", value: approvalSampleProduct.name },
  { label: "쿠팡 상품번호", value: approvalSampleProduct.coupangProductNumber },
  { label: "제목 기반 사양", value: "5800Pa · 자동 물 분사" },
  { label: "가격·재고", value: "쿠팡에서 실시간 확인" }
];

const faqs = [
  {
    question: "Novatech S1은 어떤 사람에게 맞나요?",
    answer: "넓은 유리창을 자주 관리하거나 손이 닿기 어려운 창문 청소 부담을 줄이고 싶은 사용자에게 검토할 만합니다. 실제 창문 규격과 사용 환경은 구매 전에 확인해야 합니다."
  },
  {
    question: "현재 가격과 재고는 왜 표시하지 않나요?",
    answer: "쿠팡의 가격과 재고는 수시로 바뀔 수 있습니다. ReturnPick은 확인되지 않은 숫자를 고정해서 보여주지 않고 구매 직전 쿠팡 상품 페이지에서 최종 확인하도록 안내합니다."
  },
  {
    question: "이미지는 실제 상품 사진인가요?",
    answer: "제품 사용 장면의 이해를 돕기 위한 연출 이미지입니다. 실제 외관, 색상과 구성품은 쿠팡 상품 페이지의 최신 정보를 확인하세요."
  },
  {
    question: "구매 링크는 제휴 링크인가요?",
    answer: "네. 사용자가 쿠팡에서 가격 확인 버튼을 눌러 구매하면 ReturnPick이 일정액의 수수료를 받을 수 있으며, 구매자에게 추가 비용이 붙지는 않습니다."
  }
];

export const metadata: Metadata = {
  title: "Novatech S1 창문 로봇청소기 구매 전 체크",
  description: "Novatech S1 창문 로봇청소기의 5800Pa 흡입력, 자동 물 분사 사양과 구매 전 확인할 점을 정리했습니다. 가격과 재고는 쿠팡에서 실시간으로 확인하세요.",
  alternates: {
    canonical: canonicalUrl
  },
  robots: {
    index: true,
    follow: true
  },
  openGraph: {
    title: "Novatech S1 창문 로봇청소기 구매 전 체크 | ReturnPick",
    description: "창문청소 로봇의 안전·구성·가격 조건을 구매 전에 확인하세요. 쿠팡 파트너스 제휴 링크가 포함된 직접 검수 콘텐츠입니다.",
    url: canonicalUrl,
    siteName: "ReturnPick",
    type: "article",
    locale: "ko_KR",
    images: [{ url: socialImageUrl, width: 1200, height: 630, alt: "Novatech S1 창문 로봇청소기 구매 전 체크" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Novatech S1 창문 로봇청소기 구매 전 체크",
    description: "5800Pa, 자동 물 분사와 구매 전 확인할 안전 조건을 정리한 제휴 링크 포함 콘텐츠입니다.",
    images: [twitterImageUrl]
  }
};

export default function NovatechS1PickPage() {
  const affiliateUrl = process.env.NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL?.trim() ?? "";
  const affiliateUrlReady = isCoupangPartnersLink(affiliateUrl);
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: approvalSampleProduct.name,
    description: approvalSampleProduct.fullTitle,
    image: editorialImageUrl,
    url: canonicalUrl,
    sku: approvalSampleProduct.coupangProductNumber,
    category: approvalSampleProduct.category,
    brand: {
      "@type": "Brand",
      name: approvalSampleProduct.brand
    },
    additionalProperty: [
      { "@type": "PropertyValue", name: "흡입력", value: "5800Pa" },
      { "@type": "PropertyValue", name: "물 분사", value: "자동 물 분사" }
    ]
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
      }
    }))
  };

  return (
    <main className="pb-28 lg:pb-0">
      <EditorialPickViewTracker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <nav aria-label="현재 위치" className="flex flex-wrap items-center gap-1 text-xs font-bold text-steel">
            <Link className="hover:text-pine" href="/">홈</Link>
            <ChevronRight size={14} aria-hidden />
            <Link className="hover:text-pine" href="/deals">추천 상품</Link>
            <ChevronRight size={14} aria-hidden />
            <span className="text-ink">{approvalSampleProduct.name}</span>
          </nav>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)] lg:py-12">
          <figure className="min-w-0">
            <div className="relative aspect-[3/2] overflow-hidden rounded-lg bg-mist">
              <Image
                alt={approvalSampleProduct.imageAlt}
                className="object-cover"
                fill
                priority
                sizes="(min-width: 1024px) 760px, 100vw"
                src={approvalSampleProduct.imageSrc}
              />
              <span className="absolute left-3 top-3 rounded-md bg-white/95 px-3 py-1 text-xs font-black text-ink shadow-soft">제품 사용 연출 이미지</span>
            </div>
            <figcaption className="mt-2 text-xs font-semibold leading-5 text-steel">{approvalSampleProduct.imageNotice}</figcaption>
          </figure>

          <div className="flex min-w-0 flex-col justify-center">
            <div className="flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-md bg-pine/10 px-2.5 py-1 text-pine">리턴픽 직접 검수</span>
              <span className="rounded-md bg-mist px-2.5 py-1 text-steel">{approvalSampleProduct.categoryLabel}</span>
            </div>
            <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl">{approvalSampleProduct.name}</h1>
            <p className="mt-3 text-base font-bold leading-7 text-steel">{approvalSampleProduct.subtitle}</p>

            <div className="mt-5 border-y border-line py-4">
              <p className="text-xs font-black text-steel">리턴픽 한줄 판단</p>
              <p className="mt-1 text-lg font-black leading-7 text-ink">
                창문 청소 부담을 줄일 목적이라면 검토 가치가 있습니다. 구매 전 안전 구성과 창문 적합성을 먼저 확인하세요.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-between gap-4 rounded-lg bg-mist p-4">
              <div>
                <p className="text-xs font-black text-steel">현재 가격·재고</p>
                <p className="mt-1 text-lg font-black text-ink">쿠팡에서 실시간 확인</p>
              </div>
              <TimerReset className="shrink-0 text-pine" size={24} aria-hidden />
            </div>

            {affiliateUrlReady ? (
              <ApprovalCoupangButton
                href={affiliateUrl}
                channel="web_editorial_pick"
                telegramChannel="telegram_editorial_pick"
                context="editorial_pick"
              />
            ) : (
              <button className="mt-5 w-full cursor-not-allowed rounded-lg border border-line px-4 py-3 text-sm font-black text-steel" disabled type="button">
                {affiliateUrl ? "쿠팡 파트너스 링크 확인 필요" : "쿠팡 파트너스 링크 설정 필요"}
              </button>
            )}
            <p className="mt-3 rounded-lg border border-pine/20 bg-pine/5 p-2 text-xs font-black leading-5 text-ink sm:p-3">{affiliateNotice}</p>
            <Link className="mt-2 inline-flex text-sm font-black text-pine hover:text-ink sm:mt-3" href="/disclosure">
              제휴 안내 자세히 보기 <ChevronRight size={16} aria-hidden />
            </Link>
            <EditorialShareBar canonicalUrl={canonicalUrl} title={`${approvalSampleProduct.name} 구매 전 체크 | ReturnPick`} />
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-mist">
        <div className="mx-auto grid max-w-7xl gap-3 px-4 py-6 sm:grid-cols-3 sm:px-6">
          {[
            { icon: Gauge, label: "흡입력 표기", value: "5800Pa" },
            { icon: Droplets, label: "물 분사", value: "자동 물 분사" },
            { icon: ShieldCheck, label: "구매 전 핵심", value: "안전줄 확인" }
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 rounded-lg bg-white p-4">
              <item.icon className="shrink-0 text-pine" size={22} aria-hidden />
              <div>
                <p className="text-xs font-bold text-steel">{item.label}</p>
                <p className="mt-1 font-black text-ink">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:py-14">
        <div>
          <div className="flex items-center gap-2 text-pine">
            <Sparkles size={20} aria-hidden />
            <p className="text-sm font-black">추천 대상</p>
          </div>
          <h2 className="mt-2 text-2xl font-black">이런 경우에 먼저 살펴보세요</h2>
          <ul className="mt-5 space-y-3">
            {fitReasons.map((reason) => (
              <li key={reason} className="flex gap-3 text-sm font-semibold leading-6 text-ink">
                <CheckCircle2 className="mt-0.5 shrink-0 text-pine" size={18} aria-hidden />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-2 text-coral">
            <AlertTriangle size={20} aria-hidden />
            <p className="text-sm font-black">구매 전 확인</p>
          </div>
          <h2 className="mt-2 text-2xl font-black">결제 전에 이 세 가지를 보세요</h2>
          <div className="mt-5 divide-y divide-line border-y border-line">
            {purchaseChecks.map((item, index) => (
              <div key={item.title} className="grid grid-cols-[32px_1fr] gap-3 py-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-coral/10 text-sm font-black text-coral">{index + 1}</span>
                <div>
                  <h3 className="font-black text-ink">{item.title}</h3>
                  <p className="mt-1 text-sm font-semibold leading-6 text-steel">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-sm font-black text-pine">검수 범위</p>
            <h2 className="mt-2 text-2xl font-black">확인된 정보와 실시간 확인 정보</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-steel">
              제품명과 쿠팡 상품번호는 연결된 파트너스 링크를 기준으로 확인했습니다. 변동 가능한 거래 정보는 고정값으로 만들지 않습니다.
            </p>
          </div>
          <dl className="mt-6 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
            {facts.map((fact) => (
              <div key={fact.label} className="min-w-0 bg-mist p-4">
                <dt className="text-xs font-black text-steel">{fact.label}</dt>
                <dd className="mt-1 break-words text-sm font-black leading-6 text-ink">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="flex items-center gap-2 text-pine">
          <PackageCheck size={20} aria-hidden />
          <p className="text-sm font-black">자주 묻는 질문</p>
        </div>
        <h2 className="mt-2 text-2xl font-black">창문 로봇청소기 구매 전 FAQ</h2>
        <div className="mt-6 divide-y divide-line border-y border-line">
          {faqs.map((item) => (
            <details key={item.question} className="group py-4">
              <summary className="cursor-pointer list-none pr-8 font-black text-ink marker:content-none">{item.question}</summary>
              <p className="mt-3 text-sm font-semibold leading-6 text-steel">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-ink text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-white/70">최종 확인은 쿠팡에서</p>
            <h2 className="mt-1 text-2xl font-black">가격·재고·배송 조건을 확인하세요</h2>
            <p className="mt-2 max-w-2xl text-xs font-semibold leading-5 text-white/70">{affiliateNotice}</p>
          </div>
          {affiliateUrl ? (
            <ApprovalCoupangButton
              href={affiliateUrl}
              channel="web_editorial_pick"
              telegramChannel="telegram_editorial_pick"
              context="editorial_pick"
              className="focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-black text-ink hover:bg-mist"
            />
          ) : null}
        </div>
      </section>

      {affiliateUrl ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 p-3 shadow-soft backdrop-blur lg:hidden">
          <div className="mx-auto max-w-7xl">
            <ApprovalCoupangButton
              href={affiliateUrl}
              channel="web_editorial_pick"
              telegramChannel="telegram_editorial_pick"
              context="editorial_pick"
              className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-lg bg-pine px-4 py-3 text-sm font-black text-white hover:bg-ink"
            />
            <p className="mt-1 text-center text-[10px] font-semibold leading-4 text-steel">쿠팡 파트너스 활동으로 일정액의 수수료를 제공받습니다.</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
