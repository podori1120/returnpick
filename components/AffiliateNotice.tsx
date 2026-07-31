import Link from "next/link";

export default function AffiliateNotice() {
  return (
    <div className="rounded-lg border border-line bg-white p-4 text-sm font-semibold leading-6 text-steel">
      <p className="font-black text-ink">
        이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      </p>
      <p className="mt-2">
        가격과 재고, 반품등급은 수시로 변동될 수 있으므로 구매 전 쿠팡 상품 페이지에서 최신 정보를 확인해 주세요.
      </p>
      <Link className="focus-ring mt-3 inline-flex rounded-md font-black text-pine underline decoration-pine/30 underline-offset-4 hover:text-ink" href="/disclosure">
        쿠팡 파트너스 안내 자세히 보기
      </Link>
    </div>
  );
}
