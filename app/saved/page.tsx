import type { Metadata } from "next";
import SavedDealsBoard from "@/components/SavedDealsBoard";

export const metadata: Metadata = {
  title: "찜한 딜 | ReturnPick 리턴픽",
  description: "ReturnPick에서 저장한 반품 노트북, 모니터, 소형가전 딜을 다시 확인하고 구매 조건을 비교합니다.",
  robots: { index: false, follow: false }
};

export default function SavedDealsPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <p className="text-sm font-black text-pine">ReturnPick Saved Deals</p>
        <h1 className="text-3xl font-black tracking-tight">찜한 딜</h1>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-steel">로그인 없이 이 브라우저에만 저장합니다. 다시 방문해 가격, 반품 상태와 구매 전 확인사항을 이어서 볼 수 있습니다.</p>
      </div>
      <SavedDealsBoard />
    </main>
  );
}
