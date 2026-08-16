/**
 * 💰 초고단가(100~200만원대) 프리미엄 가전 & 애플/게이밍 특별 기획관 렌더러
 * - 단 1~2건 결제로 15만원 파트너스 실적 달성 견인
 * - 실시간 품절 임박(FOMO) 잔여수량 배지 탑재
 * - 카드사 무이자 24개월 및 와우회원 전용 추가할인 강조
 */

export function renderUltraHighValueCard(deal: {
  id: string;
  title: string;
  category: string;
  deal_price: number;
  origin_price: number;
  naver_lowest_price: number;
  lowest_price_60d: number;
  discount_rate: number;
  image_url: string;
  public_note: string;
  stock_remain: number;
  card_benefit: string;
  pros: string[];
}, index: number): string {
  const saveAmount = Math.max(0, deal.naver_lowest_price - deal.deal_price);

  return `
  <div style="margin-bottom: 36px; background: #ffffff; border-radius: 20px; border: 2px solid #3b82f6; box-shadow: 0 8px 30px rgba(59,130,246,0.15); overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif;">
    <!-- 카드 헤더 (초고단가 프리미엄 뱃지) -->
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 22px; background: linear-gradient(90deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="background: #fbbf24; color: #0f172a; font-size: 11px; font-weight: 900; padding: 3px 8px; border-radius: 4px;">VIP PICK #${index + 1}</span>
        <span style="font-size: 13px; font-weight: 800; color: #93c5fd;">👑 ${deal.category}</span>
      </div>
      <span style="background: #ef4444; color: #ffffff; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 20px; animation: pulse 2s infinite;">
        🔥 잔여 ${deal.stock_remain}개 한정 (품절 임박)
      </span>
    </div>

    <!-- 카드 본문 -->
    <div style="padding: 26px 22px;">
      <!-- 이미지 & 상품명 -->
      <div style="display: flex; flex-direction: row; gap: 20px; flex-wrap: wrap; margin-bottom: 18px;">
        <div style="flex: 0 0 150px; max-width: 150px; height: 150px; border-radius: 16px; overflow: hidden; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center;">
          <img src="${deal.image_url}" alt="${deal.title}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy" />
        </div>

        <div style="flex: 1 1 250px; display: flex; flex-direction: column; justify-content: center;">
          <span style="color: #2563eb; font-size: 12px; font-weight: 800; margin-bottom: 4px;">프리미엄 빅세일</span>
          <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 18px; font-weight: 800; line-height: 1.45;">
            ${deal.title}
          </h3>
          <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.55;">
            ${deal.public_note}
          </p>
        </div>
      </div>

      <!-- 대형 가격 비교 박스 -->
      <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 14px; padding: 18px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
          <span style="color: #166534; font-size: 13px; font-weight: 800;">쿠팡 최종 혜택가</span>
          <div>
            <span style="color: #dc2626; font-size: 20px; font-weight: 900; margin-right: 6px;">${deal.discount_rate}%</span>
            <span style="color: #0f172a; font-size: 26px; font-weight: 900; letter-spacing: -0.6px;">${deal.deal_price.toLocaleString()}원</span>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #15803d; border-top: 1px dashed #86efac; padding-top: 10px;">
          <span>네이버 기준 최저가: ${deal.naver_lowest_price.toLocaleString()}원</span>
          <span style="color: #dc2626; font-weight: 900; font-size: 14px;">약 ${saveAmount.toLocaleString()}원 절약 🔻</span>
        </div>
      </div>

      <!-- 카드사 혜택 & 할부 안내 -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; font-size: 12px; color: #334155; display: flex; justify-content: space-between; align-items: center;">
        <span>💳 <strong>카드사 혜택:</strong> ${deal.card_benefit}</span>
        <span style="color: #2563eb; font-weight: 800;">최대 24개월 무이자</span>
      </div>

      <!-- 폴센트 60일 가격 추적 검증 -->
      <div style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: #eff6ff; border-radius: 12px; border-left: 4px solid #3b82f6; margin-bottom: 18px;">
        <span style="font-size: 18px;">📈</span>
        <div style="font-size: 12px; color: #1e40af; line-height: 1.45;">
          <strong>폴센트 60일 가격 검증:</strong> 최근 60일 최저가 <strong>${deal.lowest_price_60d.toLocaleString()}원</strong> 수준 (역대급 할인 구간)
        </div>
      </div>

      <!-- CTA 버튼 -->
      <a href="https://returnpick.vercel.app/deals/${deal.id}?utm_source=blogger&utm_medium=owned&utm_campaign=vip_high_value" target="_blank" rel="nofollow noopener" style="display: block; text-align: center; background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 900; padding: 16px 22px; border-radius: 12px; box-shadow: 0 6px 18px rgba(29,78,216,0.35); letter-spacing: -0.3px;">
        🔥 쿠팡 VIP 특가 &amp; 카드 무이자 혜택 받기
      </a>
    </div>
  </div>`;
}

export function renderUltraHighValueMagazineHtml(title: string, subtitle: string, deals: any[]): string {
  const cardsHtml = deals.map((d, i) => renderUltraHighValueCard(d, i)).join("\n");

  return `
  <article style="max-width: 740px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif; color: #1e293b; line-height: 1.6;">
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 24px; font-size: 12px; color: #64748b; text-align: center;">
      📢 본 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
    </div>

    <!-- VIP 골드 배너 -->
    <div style="background: linear-gradient(135deg, #1e1b4b 0%, #1e3a8a 50%, #1e40af 100%); border-radius: 20px; padding: 30px 24px; text-align: center; color: #ffffff; margin-bottom: 34px; box-shadow: 0 10px 30px rgba(30,27,75,0.3);">
      <div style="display: inline-block; background: #fbbf24; color: #0f172a; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 900; margin-bottom: 12px; letter-spacing: 0.5px;">
        👑 VIP HIGH-VALUE EXCLUSIVE
      </div>
      <h1 style="color: #ffffff; font-size: 24px; font-weight: 900; margin: 0 0 10px 0; line-height: 1.35; letter-spacing: -0.5px;">
        ${title}
      </h1>
      <p style="color: #93c5fd; font-size: 14px; margin: 0 0 16px 0; line-height: 1.5;">
        ${subtitle}
      </p>
      <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.3); padding: 8px 18px; border-radius: 10px; font-size: 13px; font-weight: 800; color: #fde047;">
        <span>💳 주요 카드사 <strong>최대 24개월 무이자 할부</strong> 지원</span>
      </div>
    </div>

    <section>
      ${cardsHtml}
    </section>

    <footer style="margin-top: 40px; padding: 22px; background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.65;">
      <p style="margin: 0 0 8px 0; font-weight: 800; color: #334155; font-size: 13px;">📌 프리미엄 가전 구매 안내</p>
      <ul style="margin: 0; padding-left: 18px;">
        <li>고단가 가전은 카드사 무이자 혜택(국민/삼성/신한/현대 등)과 로켓설치 무료 서비스를 반드시 확인하세요.</li>
        <li>한정 수량 타임딜 특성상 조기 품절될 수 있습니다.</li>
        <li>본 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</li>
      </ul>
    </footer>
  </article>`;
}
