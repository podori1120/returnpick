import AffiliateNotice from "@/components/AffiliateNotice";

export default function SafeCategoriesPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-7 px-4 py-8 sm:px-6">
      <div>
        <p className="text-sm font-black text-pine">Guide</p>
        <h1 className="text-3xl font-black tracking-tight">반품으로 사도 비교적 안전한 카테고리</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-steel">
          쿠팡 반품 노트북, 반품 모니터, 반품 소형가전은 새상품 최저가 대비 충분히 저렴하고 반품등급·구성품 근거가 있을 때만 좋은 딜이 됩니다.
          리턴픽은 구매 버튼보다 가격 기준, 위험 플래그, 수령 후 확인 포인트를 먼저 보여주는 신뢰형 제휴 추천을 지향합니다.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        {[
          ["상대적으로 안전", "미개봉·최상 등급 노트북, 브랜드 공기청정기, 구성품이 명확한 제습기, 패널 리스크가 없는 모니터"],
          ["초기 제외 권장", "고가 게이밍 노트북 중 등급이 낮은 상품, 패널 이슈가 적힌 모니터, 배터리 상태를 모르는 무선청소기"],
          ["노트북 주의사항", "RAM 8GB 이하, FreeDOS, 고가 반품-중 조합은 점수와 무관하게 보수적으로 봅니다."],
          ["모니터 주의사항", "불량화소, 빛샘, 멍, 스탠드 누락은 가격 차이가 작으면 피하는 편이 낫습니다."],
          ["소형가전 주의사항", "필터, 배터리, 물걸레 패드, 도킹스테이션 같은 소모품과 구성품 비용을 반영합니다."],
          ["가격 비교 기준", "네이버 최저가가 있으면 우선 기준선으로 쓰고, 없으면 새상품가와 수집가를 순서대로 참고합니다."]
        ].map(([title, body]) => (
          <article key={title} className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <h2 className="text-lg font-black">{title}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-steel">{body}</p>
          </article>
        ))}
      </section>

      <AffiliateNotice />
    </main>
  );
}
