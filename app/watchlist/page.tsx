import type { Metadata } from "next";
import PriceWatchBoard from "@/components/PriceWatchBoard";

export const metadata: Metadata = {
  title: "가격 기준함 | ReturnPick 리턴픽",
  description: "ReturnPick에서 저장한 목표 구매가와 공개 상품의 최신 확인가를 다시 비교합니다.",
  robots: { index: false, follow: false }
};

export default function PriceWatchPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <p className="text-sm font-black text-pine">ReturnPick Price Watch</p>
        <h1 className="text-3xl font-black tracking-tight">가격 기준함</h1>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-steel">
          사고 싶은 상한가를 저장하고, 다시 방문했을 때 공개 상품의 현재 확인가와 비교하세요. 가격·재고·반품등급은 구매 직전 쿠팡 상품 페이지에서 최종 확인해야 합니다.
        </p>
      </div>
      <PriceWatchBoard />
    </main>
  );
}
