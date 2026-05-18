import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ExternalLink, ShieldCheck } from "lucide-react";

const affiliateNotice = "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";

export const metadata: Metadata = {
  title: "쿠팡 파트너스 승인용 추천 상품 | ReturnPick",
  description: "ReturnPick 쿠팡 파트너스 최종승인 심사용 추천 상품 상세 페이지"
};

export default function ApprovalSampleProductPage() {
  const approvalUrl = process.env.NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL?.trim() ?? "";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const captureUrl = siteUrl ? `${siteUrl}/products/approval-sample` : "/products/approval-sample";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <section className="grid gap-6 lg:grid-cols-[1fr_390px]">
        <div className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
          <div className="aspect-[16/9] bg-mist">
            <img
              className="h-full w-full object-cover"
              src="https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?q=80&w=1200&auto=format&fit=crop"
              alt="ReturnPick 추천 모니터 상품 이미지"
            />
          </div>
          <div className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md bg-pine/10 px-2.5 py-1 text-xs font-black text-pine">ReturnPick 추천 상품</span>
              <span className="rounded-md bg-mist px-2.5 py-1 text-xs font-bold text-steel">쿠팡 파트너스 승인용</span>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">LG 울트라기어 27인치 QHD 144Hz IPS 모니터</h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-steel">
                QHD 해상도와 144Hz 주사율을 함께 보는 사용자에게 맞는 디지털 상품입니다. ReturnPick은 가격, 재고, 배송 조건이 바뀔 수
                있다는 점을 전제로 쿠팡 상품 페이지에서 최종 정보를 다시 확인하도록 안내합니다.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <section className="rounded-lg border border-line p-4">
                <div className="flex items-center gap-2 text-sm font-black text-pine">
                  <CheckCircle2 size={16} aria-hidden /> 추천 이유
                </div>
                <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-ink">
                  <li>사무, 학습, 게임용으로 모두 확인할 만한 27인치 QHD 구성입니다.</li>
                  <li>144Hz 주사율과 IPS 패널 조합이라 일반 FHD 모니터보다 활용 범위가 넓습니다.</li>
                  <li>구매 전 쿠팡 페이지에서 가격, 재고, 배송 조건을 바로 확인할 수 있습니다.</li>
                </ul>
              </section>

              <section className="rounded-lg border border-line p-4">
                <div className="flex items-center gap-2 text-sm font-black text-coral">
                  <AlertTriangle size={16} aria-hidden /> 구매 전 확인할 점
                </div>
                <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-ink">
                  <li>최종 가격, 재고, 배송 예정일은 쿠팡 상품 페이지 기준으로 확인해야 합니다.</li>
                  <li>반품 또는 리퍼 상품을 구매하는 경우 구성품, 패널 상태, 교환 가능 조건을 확인하세요.</li>
                  <li>제품 사양과 판매자 안내가 표시된 상품 페이지 정보를 우선 기준으로 판단하세요.</li>
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
              <a
                className="focus-ring mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-pine px-4 py-3 text-sm font-black text-white hover:bg-ink"
                href={approvalUrl}
                target="_blank"
                rel="nofollow sponsored noopener noreferrer"
              >
                쿠팡에서 가격 확인 <ExternalLink size={16} aria-hidden />
              </a>
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
                <dd className="font-black text-ink">{captureUrl}</dd>
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
            <h2 className="text-lg font-black">ReturnPick 기준</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-steel">
              리턴픽은 반품 노트북, 모니터, 디지털·소형가전 상품을 가격과 구매 전 확인 항목 중심으로 정리하는 추천 사이트입니다.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
