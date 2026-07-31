import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, TimerReset } from "lucide-react";
import AffiliateNotice from "@/components/AffiliateNotice";
import ApprovalSampleCard from "@/components/ApprovalSampleCard";
import DealCard from "@/components/DealCard";
import RecentDealsRail from "@/components/RecentDealsRail";
import { categoryOptions } from "@/lib/category";
import { listProducts } from "@/lib/dataStore";
import { isPublicDealReady } from "@/lib/publicDeal";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = (await listProducts({ published: true }))
    .filter(isPublicDealReady)
    .sort((a, b) => (b.latest_score?.total_score ?? 0) - (a.latest_score?.total_score ?? 0));
  const featured = products.slice(0, 6);
  const counts = categoryOptions.map((category) => ({
    ...category,
    count: products.filter((product) => product.category === category.value).length
  }));

  return (
    <main>
      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_420px] lg:py-14">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-black text-pine">리턴픽</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">반품 디지털 딜, 사기 전에 한 번 더 걸러드립니다</h1>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-steel">
              공식 API, 네이버 최저가, 공개 웹 문구, 상품명 스펙을 함께 확인합니다. 반품등급과 반품가는 근거가 있을 때만 반영하고, 애매한 값은 확인필요로 남깁니다.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-5 py-3 text-sm font-black text-white hover:bg-ink" href="/deals">
                검수 완료 딜 보기 <ArrowRight size={16} aria-hidden />
              </Link>
              <Link className="focus-ring rounded-lg border border-pine bg-white px-5 py-3 text-sm font-black text-pine hover:bg-pine hover:text-white" href="/products/approval-sample">
                직접 검수 추천 상품
              </Link>
              <Link className="focus-ring rounded-lg border border-line px-5 py-3 text-sm font-black hover:bg-mist" href="/guide/return-checklist">
                수령 체크리스트
              </Link>
            </div>
          </div>
          <div className="lg:self-start">
            {featured[0] ? (
              <DealCard product={featured[0]} />
            ) : (
              <ApprovalSampleCard />
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6">
        <RecentDealsRail />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-black text-pine">Today</p>
            <h2 className="text-2xl font-black">오늘 볼 만한 딜</h2>
            <p className="mt-1 text-sm font-semibold text-steel">현재 공개 상품 {products.length.toLocaleString("ko-KR")}개</p>
          </div>
          <Link className="text-sm font-black text-pine hover:text-ink" href="/deals">
            더 보기
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featured.map((product) => (
            <DealCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <h2 className="text-2xl font-black">카테고리별 추천</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {counts.map((category) => (
              <Link
                key={category.value}
                className="rounded-lg border border-line p-4 font-black hover:border-pine hover:bg-mist"
                href={`/deals?category=${category.value}`}
              >
                <span className="block text-sm text-steel">{category.label}</span>
                <span className="mt-1 block text-2xl text-ink">{category.count}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:px-6 lg:grid-cols-3">
        {[
          { icon: Sparkles, title: "가격 차이", body: "네이버 최저가와 새상품가를 기준으로 실제로 싸게 살 만한지 먼저 봅니다." },
          { icon: ShieldCheck, title: "반품 상태", body: "등급과 반품가는 확인된 근거가 있을 때만 반영하고, 모호하면 보수적으로 낮춥니다." },
          { icon: TimerReset, title: "변동 체크", body: "가격과 재고는 자주 바뀌기 때문에 수집 시점과 변동 기록을 함께 보여줍니다." }
        ].map((item) => (
          <div key={item.title} className="rounded-lg border border-line bg-white p-5">
            <item.icon className="text-pine" size={24} aria-hidden />
            <h3 className="mt-3 text-lg font-black">{item.title}</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-steel">{item.body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        <AffiliateNotice />
      </section>
    </main>
  );
}
