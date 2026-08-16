/**
 * 👑 [리턴픽 X 반품왕] 초고액(100~400만원대) 반품-미개봉/최상급 전용 매거진 렌더러
 * - 단 1~2건 결제로 15만원 파트너스 실적 목표 즉각 달성
 * - 새상품 대비 최소 40만원 ~ 최대 160만원 파격 절약액 시각화
 * - 반품-미개봉(새것과 동일) & 반품-최상(단순변심 1회) 정품 검수 보증
 */

export const banpumGlobalNavTabsHtml = `
<!-- 👑 고액 반품 5대 전문 기획관 글로벌 탭 바 -->
<nav style="margin-bottom: 24px; padding: 12px 16px; background: #0f172a; border: 1px solid #1e293b; border-radius: 14px; box-shadow: 0 4px 16px rgba(0,0,0,0.2); display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif;">
  <a href="https://returnpick-deals.blogspot.com/2026/08/18.html" style="padding: 8px 14px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 800;">👑 반품왕 종합관</a>
  <a href="https://returnpick-deals.blogspot.com/2026/08/490ml-x-24-991.html" style="padding: 8px 14px; background: #1e293b; color: #93c5fd; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 800; border: 1px solid #334155;">🍎 애플/맥북 반품관</a>
  <a href="https://returnpick-deals.blogspot.com/2026/08/17900.html" style="padding: 8px 14px; background: #1e293b; color: #93c5fd; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 800; border: 1px solid #334155;">💻 노트북/게이밍 반품관</a>
  <a href="https://returnpick-deals.blogspot.com/2026/08/40-967.html" style="padding: 8px 14px; background: #1e293b; color: #93c5fd; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 800; border: 1px solid #334155;">📺 대형가전/TV/세탁기 반품관</a>
  <a href="https://returnpick-deals.blogspot.com/2026/08/355ml-x-24-535.html" style="padding: 8px 14px; background: #1e293b; color: #93c5fd; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 800; border: 1px solid #334155;">📱 폰/카메라/로봇청소기 반품관</a>
</nav>`;

export function renderHighValueBanpumCard(deal: {
  id: string;
  title: string;
  category: string;
  return_grade: string; // "반품-미개봉" | "반품-최상"
  deal_price: number;
  new_product_price: number;
  naver_lowest_price: number;
  lowest_price_60d: number;
  discount_rate: number;
  image_url: string;
  public_note: string;
  inspection_report: string;
  stock_remain: number;
  card_benefit: string;
  pros: string[];
}, index: number): string {
  const saveAmount = deal.new_product_price - deal.deal_price;
  const directCoupangUrl = "https://link.coupang.com/a/bWq88Z";
  const returnpickDetailUrl = `https://returnpick.vercel.app/deals/${deal.id}?utm_source=blogger&utm_medium=owned&utm_campaign=high_value_banpum`;

  return `
  <div style="margin-bottom: 36px; background: #ffffff; border-radius: 20px; border: 2px solid #3b82f6; box-shadow: 0 8px 30px rgba(59,130,246,0.14); overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif;">
    <!-- 카드 헤더 (반품 등급 & 절약 금액) -->
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 22px; background: linear-gradient(90deg, #090d16 0%, #1e3a8a 100%); color: #ffffff;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="background: #fbbf24; color: #0f172a; font-size: 11px; font-weight: 900; padding: 3px 8px; border-radius: 4px;">반품왕 #${index + 1}</span>
        <span style="font-size: 13px; font-weight: 800; color: #93c5fd;">💎 ${deal.return_grade}</span>
      </div>
      <span style="background: #dc2626; color: #ffffff; font-size: 12px; font-weight: 900; padding: 4px 12px; border-radius: 20px;">
        새상품 대비 약 ${(saveAmount / 10000).toFixed(0)}만원 세이브 🔻
      </span>
    </div>

    <!-- 본문 영역 -->
    <div style="padding: 26px 22px;">
      <!-- 이미지 & 제목 -->
      <div style="display: flex; flex-direction: row; gap: 20px; flex-wrap: wrap; margin-bottom: 18px;">
        <div style="flex: 0 0 150px; max-width: 150px; height: 150px; border-radius: 16px; overflow: hidden; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center;">
          <img src="${deal.image_url}" alt="${deal.title}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy" />
        </div>

        <div style="flex: 1 1 250px; display: flex; flex-direction: column; justify-content: center;">
          <span style="color: #2563eb; font-size: 12px; font-weight: 800; margin-bottom: 4px;">고액 프리미엄 반품</span>
          <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 18px; font-weight: 900; line-height: 1.45;">
            ${deal.title}
          </h3>
          <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.55;">
            ${deal.public_note}
          </p>
        </div>
      </div>

      <!-- 대형 가격 비교 박스 -->
      <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 18px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
          <span style="color: #475569; font-size: 13px; font-weight: 800;">쿠팡 반품 특가</span>
          <div>
            <span style="color: #dc2626; font-size: 20px; font-weight: 900; margin-right: 6px;">${deal.discount_rate}% 할인</span>
            <span style="color: #0f172a; font-size: 26px; font-weight: 900; letter-spacing: -0.6px;">${deal.deal_price.toLocaleString()}원</span>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
          <span>새제품 정상 출고가: ${deal.new_product_price.toLocaleString()}원</span>
          <span style="color: #2563eb; font-weight: 900; font-size: 14px;">총 ${saveAmount.toLocaleString()}원 절약 ✨</span>
        </div>
      </div>

      <!-- 검수 리포트 -->
      <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px;">
        <div style="font-size: 12px; font-weight: 900; color: #166534; margin-bottom: 4px;">
          🔍 <strong>반품왕 안심 검수 리포트:</strong>
        </div>
        <p style="margin: 0; font-size: 12px; color: #15803d; line-height: 1.5;">
          ${deal.inspection_report}
        </p>
      </div>

      <!-- 카드 혜택 & 한정 잔여수량 -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; font-size: 12px; color: #92400e; margin-bottom: 18px;">
        <span>💳 <strong>카드 혜택:</strong> ${deal.card_benefit}</span>
        <span style="color: #dc2626; font-weight: 900;">⚡ 실시간 잔여 ${deal.stock_remain}대 한정</span>
      </div>

      <!-- 2단 CTA 버튼 (쿠팡 바로가기 & 리턴픽 리포트) -->
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <a href="${directCoupangUrl}" target="_blank" rel="nofollow noopener" style="display: block; text-align: center; background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 900; padding: 15px 20px; border-radius: 12px; box-shadow: 0 6px 18px rgba(225,29,72,0.35); letter-spacing: -0.3px;">
          🛒 쿠팡 반품 ${deal.deal_price.toLocaleString()}원 실시간 재고 확인 &gt;
        </a>
        <a href="${returnpickDetailUrl}" target="_blank" rel="nofollow noopener" style="display: block; text-align: center; background: #0f172a; color: #93c5fd; text-decoration: none; font-size: 13px; font-weight: 700; padding: 10px 16px; border-radius: 10px; border: 1px solid #334155;">
          📊 리턴픽 AI 시세 추적 &amp; 안심 검수 리포트 상세 보기
        </a>
      </div>
    </div>
  </div>`;
}

export function renderHighValueBanpumMagazineHtml(title: string, subtitle: string, deals: any[]): string {
  const cardsHtml = deals.map((d, i) => renderHighValueBanpumCard(d, i)).join("\n");

  return `
  <article style="max-width: 740px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif; color: #1e293b; line-height: 1.6;">
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; font-size: 12px; color: #64748b; text-align: center;">
      📢 본 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
    </div>

    ${banpumGlobalNavTabsHtml}

    <div style="background: linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e3a8a 100%); border-radius: 20px; padding: 30px 24px; text-align: center; color: #ffffff; margin-bottom: 32px; box-shadow: 0 10px 30px rgba(2,6,23,0.4);">
      <div style="display: inline-block; background: #fbbf24; color: #0f172a; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 900; margin-bottom: 12px; letter-spacing: 0.5px;">
        👑 반품왕 X 리턴픽 고액 프리미엄 전용관
      </div>
      <h1 style="color: #ffffff; font-size: 24px; font-weight: 900; margin: 0 0 10px 0; line-height: 1.35; letter-spacing: -0.5px;">
        ${title}
      </h1>
      <p style="color: #93c5fd; font-size: 14px; margin: 0 0 16px 0; line-height: 1.5;">
        ${subtitle}
      </p>
      <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.3); padding: 8px 18px; border-radius: 10px; font-size: 13px; font-weight: 800; color: #38bdf8;">
        <span>🛡️ 쿠팡 공식 <strong>30일 무료 교환/반품 보증</strong> 지원</span>
      </div>
    </div>

    <section>
      ${cardsHtml}
    </section>

    <footer style="margin-top: 40px; padding: 22px; background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.65;">
      <p style="margin: 0 0 8px 0; font-weight: 800; color: #334155; font-size: 13px;">📌 고액 반품 상품 안심 구매 팁</p>
      <ul style="margin: 0; padding-left: 18px;">
        <li>'반품-미개봉'은 단순 박스 라벨만 개봉되었거나 비닐 미개봉 상태로 본체는 100% 신품입니다.</li>
        <li>'반품-최상'은 단순 변심으로 단 1회 개봉된 특A급으로 새상품과 동일한 제조사 공식 무상 AS가 적용됩니다.</li>
        <li>쿠팡 와우회원은 수령 후 30일간 무료 반품이 가능하므로 고가 제품도 안심하고 확인 후 결정하실 수 있습니다.</li>
      </ul>
    </footer>
  </article>`;
}
