import type { Metadata } from "next";
import CompareBoard from "@/components/CompareBoard";

export const metadata: Metadata = {
  title: "비교함 | ReturnPick 리턴픽",
  description: "리턴픽에서 저장한 반품 노트북, 모니터, 소형가전 딜을 비교하고 공개 상품만 포함한 비교 링크를 공유합니다.",
  robots: { index: false, follow: false }
};

export default function ComparePage() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <p className="text-sm font-black text-pine">리턴픽 비교함</p>
        <h1 className="text-3xl font-black tracking-tight">비교함</h1>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-steel">
          마음에 드는 후보를 모아두고, 실제 구매 전에 가격 차이와 반품 리스크를 나란히 확인하세요. 공개 상품은 비교 링크로 공유할 수도 있습니다.
        </p>
      </div>
      <CompareBoard />
    </main>
  );
}
