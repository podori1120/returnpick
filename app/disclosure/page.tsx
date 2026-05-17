import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "제휴 안내 | ReturnPick",
  description: "ReturnPick의 쿠팡 파트너스 제휴 링크 및 경제적 이해관계 안내"
};

export default function DisclosurePage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div className="space-y-2">
        <p className="text-sm font-black text-pine">Affiliate Disclosure</p>
        <h1 className="text-3xl font-black tracking-tight">제휴 안내</h1>
        <p className="text-sm font-semibold leading-6 text-steel">
          ReturnPick은 반품·리퍼 상품 후보를 비교하고, 구매 전 확인해야 할 가격·재고·상태 정보를 정리해 보여주는 서비스입니다.
        </p>
      </div>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h2 className="text-lg font-black">쿠팡 파트너스 고지</h2>
        <p className="mt-3 rounded-lg bg-mist p-4 text-sm font-black leading-6 text-ink">
          이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
        </p>
        <p className="mt-3 text-sm font-semibold leading-6 text-steel">
          사이트 내 일부 상품 버튼은 쿠팡 파트너스 제휴 링크로 연결됩니다. 사용자가 해당 링크를 통해 쿠팡에 방문하거나 구매하는 경우,
          ReturnPick 운영자는 일정액의 수수료를 제공받을 수 있습니다.
        </p>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h2 className="text-lg font-black">가격·재고 안내</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-steel">
          ReturnPick에 표시된 가격, 재고, 반품등급, 할인율은 확인 시점에 따라 달라질 수 있습니다. 최종 구매 전에는 반드시 쿠팡 상품 페이지에서
          최신 가격, 배송 조건, 판매자, 반품 가능 여부를 직접 확인해 주세요.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link className="focus-ring rounded-lg bg-pine px-4 py-3 text-sm font-black text-white hover:bg-ink" href="/deals">
          딜 보러가기
        </Link>
        <Link className="focus-ring rounded-lg border border-line bg-white px-4 py-3 text-sm font-black text-ink hover:bg-mist" href="/">
          홈으로
        </Link>
      </div>
    </main>
  );
}
