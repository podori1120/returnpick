import AffiliateNotice from "@/components/AffiliateNotice";
import Checklist from "@/components/Checklist";
import GuideEditorialLink from "@/components/GuideEditorialLink";
import { categoryOptions, getCategoryLabel } from "@/lib/category";
import type { Category } from "@/lib/types";

export default function ReturnChecklistPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-7 px-4 py-8 sm:px-6">
      <div>
        <p className="text-sm font-black text-pine">Guide</p>
        <h1 className="text-3xl font-black tracking-tight">카테고리별 수령 후 체크리스트</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-steel">
          반품 노트북 추천, 반품 모니터 체크리스트, 로봇청소기 반품 구매처럼 가격 차이가 큰 상품은 수령 직후 확인이 중요합니다.
          리턴픽은 구매 전 가격과 반품등급을 보수적으로 보고, 구매 후에는 아래 항목을 먼저 확인하도록 안내합니다.
        </p>
      </div>

      {categoryOptions.map((category) => (
        <section key={category.value} className="space-y-3">
          <h2 className="text-xl font-black">{getCategoryLabel(category.value)}</h2>
          <Checklist category={category.value as Category} />
        </section>
      ))}

      <GuideEditorialLink />
      <AffiliateNotice />
    </main>
  );
}
