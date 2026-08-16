/**
 * 🌙 로켓프레시 자정 마감 카운트다운 전용 프리미엄 매거진 렌더러
 * - 자정 24:00 마감 카운트다운 비주얼 배너
 * - 내일 아침 7시 문 앞 도착 보장 뱃지
 * - 폴센트 60일 최저가 검증 및 신선도 보증 가이드
 */

export function renderRocketFreshCard(deal: {
  id: string;
  title: string;
  category: string;
  deal_price: number;
  naver_lowest_price: number;
  lowest_price_60d: number;
  discount_rate: number;
  image_url: string;
  fresh_badge: string;
  public_note: string;
  cooking_tip?: string;
  pros: string[];
}, index: number): string {
  const saveAmount = Math.max(0, deal.naver_lowest_price - deal.deal_price);
  const min60d = deal.lowest_price_60d || deal.deal_price;
  const isAllTimeLow = deal.deal_price <= min60d;

  return `
  <div style="margin-bottom: 32px; background: #ffffff; border-radius: 18px; border: 1px solid #e2e8f0; box-shadow: 0 6px 20px rgba(0,0,0,0.05); overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Segoe UI', Roboto, sans-serif;">
    <!-- 카드 헤더 (로켓프레시 전용 뱃지) -->
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: linear-gradient(90deg, #059669 0%, #10b981 100%); color: #ffffff;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="background: rgba(255,255,255,0.25); font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 4px;">FRESH #${index + 1}</span>
        <span style="font-size: 13px; font-weight: 700;">🚀 ${deal.fresh_badge || '내일 아침 7시 도착 보장'}</span>
      </div>
      <span style="background: #ffffff; color: #059669; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 20px;">
        ${isAllTimeLow ? '🔥 60일 역대 최저가' : '⚡ 마감 임박 특가'}
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
          <span style="color: #059669; font-size: 12px; font-weight: 700; margin-bottom: 4px;">${deal.category}</span>
          <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 17px; font-weight: 800; line-height: 1.45;">
            ${deal.title}
          </h3>
          <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.5;">
            ${deal.public_note}
          </p>
        </div>
      </div>

      <!-- 가격 비교 박스 -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
          <span style="color: #166534; font-size: 13px; font-weight: 700;">로켓프레시 마감 할인가</span>
          <div>
            <span style="color: #dc2626; font-size: 18px; font-weight: 800; margin-right: 6px;">${deal.discount_rate}%</span>
            <span style="color: #0f172a; font-size: 22px; font-weight: 800;">${deal.deal_price.toLocaleString()}원</span>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #15803d; border-top: 1px dashed #86efac; padding-top: 8px;">
          <span>네이버 쇼핑 기준 최저가: ${deal.naver_lowest_price.toLocaleString()}원</span>
          <span style="color: #059669; font-weight: 800;">약 ${saveAmount.toLocaleString()}원 절약 🔻</span>
        </div>
      </div>

      <!-- 폴센트 가격 검증 배지 -->
      <div style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #eff6ff; border-radius: 10px; border-left: 4px solid #3b82f6; margin-bottom: 16px;">
        <span style="font-size: 16px;">📈</span>
        <div style="font-size: 12px; color: #1e40af; line-height: 1.45;">
          <strong>폴센트 60일 가격 추적 검증:</strong> 최근 60일 최저가 <strong>${min60d.toLocaleString()}원</strong> 수준<br/>
          <span style="color: #2563eb;">오늘 밤 자정 주문 시 내일 아침 가장 신선한 상태로 배송됩니다.</span>
        </div>
      </div>

      ${deal.cooking_tip ? `
      <!-- 요리/보관 꿀팁 -->
      <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px; color: #92400e; line-height: 1.5;">
        💡 <strong>내일 아침 간편 팁:</strong> ${deal.cooking_tip}
      </div>` : ''}

      <!-- CTA 버튼 -->
      <a href="https://returnpick.vercel.app/deals/${deal.id}?utm_source=blogger&utm_medium=owned&utm_campaign=rocket_fresh_night" target="_blank" rel="nofollow noopener" style="display: block; text-align: center; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 800; padding: 14px 20px; border-radius: 10px; box-shadow: 0 4px 14px rgba(5,150,105,0.3); letter-spacing: -0.2px;">
        🚀 로켓프레시 실시간 재고 담기 (내일 아침 7시 도착)
      </a>
    </div>
  </div>`;
}

export function renderRocketFreshMagazineHtml(title: string, subtitle: string, deals: any[]): string {
  const cardsHtml = deals.map((d, i) => renderRocketFreshCard(d, i)).join("\n");

  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": title,
    "description": subtitle,
    "itemListElement": deals.map((d, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "item": {
        "@type": "Product",
        "name": d.title,
        "image": d.image_url,
        "offers": {
          "@type": "Offer",
          "price": d.deal_price,
          "priceCurrency": "KRW",
          "availability": "https://schema.org/InStock",
          "url": `https://returnpick.vercel.app/deals/${d.id}`
        }
      }
    }))
  };

  return `
  <!-- Schema.org 구조화 데이터 -->
  <script type="application/ld+json">
  ${JSON.stringify(jsonLdData, null, 2)}
  </script>

  <article style="max-width: 740px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.6;">
    <!-- 상단 대가성 고지 -->
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 24px; font-size: 12px; color: #64748b; text-align: center;">
      📢 본 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
    </div>

    <!-- 🌙 자정 마감 카운트다운 히어로 배너 -->
    <div style="background: linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%); border-radius: 18px; padding: 28px 24px; text-align: center; color: #ffffff; margin-bottom: 32px; box-shadow: 0 8px 24px rgba(6,78,59,0.25);">
      <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 800; margin-bottom: 12px; letter-spacing: 0.5px;">
        ⏰ TONIGHT ONLY | 오늘 밤 24:00 주문 마감
      </div>
      <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0 0 10px 0; line-height: 1.35; letter-spacing: -0.5px;">
        ${title}
      </h1>
      <p style="color: #a7f3d0; font-size: 14px; margin: 0 0 16px 0; line-height: 1.5;">
        ${subtitle}
      </p>
      <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.2); padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; color: #6ee7b7;">
        <span>🚚 주문 시 <strong>내일 아침 7시 문 앞 도착</strong></span>
      </div>
    </div>

    <!-- 핫딜 카드 리스트 -->
    <section>
      ${cardsHtml}
    </section>

    <!-- 하단 푸터 -->
    <footer style="margin-top: 40px; padding: 22px; background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.65;">
      <p style="margin: 0 0 8px 0; font-weight: 800; color: #334155; font-size: 13px;">📌 로켓프레시 이용 팁</p>
      <ul style="margin: 0; padding-left: 18px;">
        <li>로켓프레시는 쿠팡 와우회원 전용 서비스이며, 15,000원 이상 주문 시 무료배송됩니다.</li>
        <li>밤 24시 이전에 결제 완료된 건에 한하여 내일 아침 7시 전까지 신선 보랭백에 안전 배송됩니다.</li>
        <li>본 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</li>
      </ul>
    </footer>
  </article>`;
}
