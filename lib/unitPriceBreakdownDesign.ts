/**
 * 🔥 1+1 & 대용량 묶음구매 "개당 단가 파괴 가성비관" 전용 렌더러
 * - 캔당 500원, 개당 800원 등 개당 단가(Unit Price) 시각적 하이라이트
 * - 편의점/마트 낱개 정가 대비 파격 절약율 (60~70% OFF)
 * - 5개 전용관 퀵 네비게이션 탭 바 공통 내장
 */

export const globalNavTabsHtml = `
<!-- 🌟 블로그 5대 기획관 퀵 네비게이션 탭 바 -->
<nav style="margin-bottom: 24px; padding: 10px 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 4px 14px rgba(0,0,0,0.04); display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif;">
  <a href="https://returnpick-deals.blogspot.com/2026/08/490ml-x-24-991.html" style="padding: 6px 12px; background: #1e3a8a; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 12px; font-weight: 800;">👑 VIP 가전관</a>
  <a href="https://returnpick-deals.blogspot.com/2026/08/18.html" style="padding: 6px 12px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 12px; font-weight: 800;">🏆 종합 핫딜관</a>
  <a href="https://returnpick-deals.blogspot.com/2026/08/17900.html" style="padding: 6px 12px; background: #0f172a; color: #38bdf8; text-decoration: none; border-radius: 8px; font-size: 12px; font-weight: 800;">💎 반품 특가관</a>
  <a href="https://returnpick-deals.blogspot.com/2026/08/40-967.html" style="padding: 6px 12px; background: #059669; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 12px; font-weight: 800;">🌙 새벽 배송관</a>
  <a href="https://returnpick-deals.blogspot.com/2026/08/355ml-x-24-535.html" style="padding: 6px 12px; background: #ea580c; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 12px; font-weight: 800;">🔥 단가 파괴관</a>
</nav>`;

export function renderUnitPriceBreakdownCard(deal: {
  id: string;
  title: string;
  category: string;
  unit_badge: string;
  deal_price: number;
  market_single_price: number;
  total_units: number;
  naver_lowest_price: number;
  lowest_price_60d: number;
  discount_rate: number;
  image_url: string;
  public_note: string;
  pros: string[];
}, index: number): string {
  const calculatedUnitPrice = Math.round(deal.deal_price / deal.total_units);
  const savePerUnit = deal.market_single_price - calculatedUnitPrice;
  const totalSave = savePerUnit * deal.total_units;

  return `
  <div style="margin-bottom: 32px; background: #ffffff; border-radius: 18px; border: 2px solid #fdba74; box-shadow: 0 6px 22px rgba(234,88,12,0.1); overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif;">
    <!-- 카드 상단 (개당 단가 뱃지) -->
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: linear-gradient(90deg, #ea580c 0%, #f97316 100%); color: #ffffff;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="background: rgba(255,255,255,0.25); font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 4px;">VALUE #${index + 1}</span>
        <span style="font-size: 13px; font-weight: 800;">🔥 ${deal.unit_badge}</span>
      </div>
      <span style="background: #ffffff; color: #ea580c; font-size: 11px; font-weight: 900; padding: 3px 10px; border-radius: 20px;">
        개당 ${calculatedUnitPrice.toLocaleString()}원꼴
      </span>
    </div>

    <!-- 카드 본문 -->
    <div style="padding: 24px 20px;">
      <!-- 이미지 & 상품명 -->
      <div style="display: flex; flex-direction: row; gap: 18px; flex-wrap: wrap; margin-bottom: 16px;">
        <div style="flex: 0 0 140px; max-width: 140px; height: 140px; border-radius: 14px; overflow: hidden; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center;">
          <img src="${deal.image_url}" alt="${deal.title}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy" />
        </div>

        <div style="flex: 1 1 240px; display: flex; flex-direction: column; justify-content: center;">
          <span style="color: #ea580c; font-size: 12px; font-weight: 800; margin-bottom: 4px;">대용량 묶음 특가</span>
          <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 17px; font-weight: 800; line-height: 1.45;">
            ${deal.title}
          </h3>
          <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.5;">
            ${deal.public_note}
          </p>
        </div>
      </div>

      <!-- 단가 분석 박스 -->
      <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
          <span style="color: #9a3412; font-size: 13px; font-weight: 800;">쿠팡 묶음 특가</span>
          <div>
            <span style="color: #dc2626; font-size: 18px; font-weight: 900; margin-right: 6px;">${deal.discount_rate}%</span>
            <span style="color: #0f172a; font-size: 24px; font-weight: 900;">${deal.deal_price.toLocaleString()}원</span>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #c2410c; border-top: 1px dashed #fdba74; padding-top: 8px;">
          <span>편의점/마트 낱개 구매 시: ${(deal.market_single_price * deal.total_units).toLocaleString()}원</span>
          <span style="color: #ea580c; font-weight: 900; font-size: 13px;">총 ${totalSave.toLocaleString()}원 절약 🔻</span>
        </div>
      </div>

      <!-- 폴센트 60일 최저가 검증 -->
      <div style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #eff6ff; border-radius: 10px; border-left: 4px solid #3b82f6; margin-bottom: 16px;">
        <span style="font-size: 16px;">📈</span>
        <div style="font-size: 12px; color: #1e40af; line-height: 1.45;">
          <strong>폴센트 60일 가격 검증:</strong> 60일 최저가 <strong>${deal.lowest_price_60d.toLocaleString()}원</strong> 구간으로 대량 쟁여두기 가장 좋은 적기입니다.
        </div>
      </div>

      <!-- CTA 버튼 -->
      <a href="https://returnpick.vercel.app/deals/${deal.id}?utm_source=blogger&utm_medium=owned&utm_campaign=unit_price_breakdown" target="_blank" rel="nofollow noopener" style="display: block; text-align: center; background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 800; padding: 14px 20px; border-radius: 10px; box-shadow: 0 4px 14px rgba(234,88,12,0.3); letter-spacing: -0.2px;">
        🔥 대용량 묶음 특가 담기 (무료배송)
      </a>
    </div>
  </div>`;
}

export function renderUnitPriceMagazineHtml(title: string, subtitle: string, deals: any[]): string {
  const cardsHtml = deals.map((d, i) => renderUnitPriceBreakdownCard(d, i)).join("\n");

  return `
  <article style="max-width: 740px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif; color: #1e293b; line-height: 1.6;">
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; font-size: 12px; color: #64748b; text-align: center;">
      📢 본 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
    </div>

    ${globalNavTabsHtml}

    <div style="background: linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #f97316 100%); border-radius: 18px; padding: 28px 24px; text-align: center; color: #ffffff; margin-bottom: 32px; box-shadow: 0 8px 24px rgba(234,88,12,0.25);">
      <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 900; margin-bottom: 12px; letter-spacing: 0.5px;">
        💥 UNIT PRICE BREAKTHROUGH
      </div>
      <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0 0 10px 0; line-height: 1.35; letter-spacing: -0.5px;">
        ${title}
      </h1>
      <p style="color: #ffedd5; font-size: 14px; margin: 0 0 16px 0; line-height: 1.5;">
        ${subtitle}
      </p>
      <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.2); padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 800; color: #fed7aa;">
        <span>📦 쟁여두면 무조건 이득인 <strong>캔당 500원대 / 개당 800원대</strong> 라인업</span>
      </div>
    </div>

    <section>
      ${cardsHtml}
    </section>

    <footer style="margin-top: 40px; padding: 22px; background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.65;">
      <p style="margin: 0 0 8px 0; font-weight: 800; color: #334155; font-size: 13px;">📌 대용량 묶음 구매 팁</p>
      <ul style="margin: 0; padding-left: 18px;">
        <li>음료, 라면, 햇반, 화장지 등 유통기한이 길고 매일 쓰는 생필품은 묶음으로 구매 시 편의점 대비 최대 60% 이상 절약됩니다.</li>
        <li>로켓와우 회원은 전 상품 무료배송 혜택이 적용됩니다.</li>
        <li>본 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</li>
      </ul>
    </footer>
  </article>`;
}
