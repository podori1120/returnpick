/**
 * 💎 쿠팡 반품-미개봉/최상급 전자기기 & 가전 전용 매거진 렌더러
 * - 반품 등급(박스 미개봉, 최상급 반품) 정품 인증 뱃지
 * - 새상품 정가 대비 실질 절약액 (10~25만원 세이브)
 * - 리턴픽 검수 기준 및 안심 반품 보증 안내
 */

export function renderRefurbishedTechCard(deal: {
  id: string;
  title: string;
  category: string;
  return_grade: string;
  deal_price: number;
  new_product_price: number;
  naver_lowest_price: number;
  lowest_price_60d: number;
  discount_rate: number;
  image_url: string;
  public_note: string;
  inspection_point: string;
  pros: string[];
}, index: number): string {
  const saveAmount = Math.max(0, deal.new_product_price - deal.deal_price);

  return `
  <div style="margin-bottom: 32px; background: #ffffff; border-radius: 18px; border: 1px solid #e2e8f0; box-shadow: 0 6px 22px rgba(0,0,0,0.06); overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Segoe UI', Roboto, sans-serif;">
    <!-- 카드 헤더 (반품 등급 뱃지) -->
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: linear-gradient(90deg, #1e293b 0%, #334155 100%); color: #ffffff;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="background: #3b82f6; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 4px;">TECH #${index + 1}</span>
        <span style="font-size: 13px; font-weight: 700; color: #38bdf8;">💎 ${deal.return_grade}</span>
      </div>
      <span style="background: #ef4444; color: #ffffff; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 20px;">
        새상품 대비 약 ${(saveAmount / 10000).toFixed(1)}만원 절약 🔻
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
          <span style="color: #2563eb; font-size: 12px; font-weight: 700; margin-bottom: 4px;">${deal.category}</span>
          <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 17px; font-weight: 800; line-height: 1.45;">
            ${deal.title}
          </h3>
          <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.5;">
            ${deal.public_note}
          </p>
        </div>
      </div>

      <!-- 가격 비교 박스 -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
          <span style="color: #64748b; font-size: 13px; font-weight: 700;">쿠팡 반품 특가</span>
          <div>
            <span style="color: #dc2626; font-size: 18px; font-weight: 800; margin-right: 6px;">${deal.discount_rate}% 할인</span>
            <span style="color: #0f172a; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">${deal.deal_price.toLocaleString()}원</span>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
          <span>새제품 정상 출고가: ${deal.new_product_price.toLocaleString()}원</span>
          <span style="color: #2563eb; font-weight: 800; font-size: 13px;">${saveAmount.toLocaleString()}원 세이브 ✨</span>
        </div>
      </div>

      <!-- 검수 포인트 박스 -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; font-size: 12px; color: #166534; line-height: 1.5;">
        🔍 <strong>리턴픽 상태 검수:</strong> ${deal.inspection_point}
      </div>

      <!-- 폴센트 가격 검증 -->
      <div style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #eff6ff; border-radius: 10px; border-left: 4px solid #3b82f6; margin-bottom: 18px;">
        <span style="font-size: 16px;">📈</span>
        <div style="font-size: 12px; color: #1e40af; line-height: 1.45;">
          <strong>폴센트 60일 가격 검증:</strong> 새제품 60일 최저가(${deal.naver_lowest_price.toLocaleString()}원) 대비 압도적 가성비 구간입니다.
        </div>
      </div>

      <!-- CTA 버튼 -->
      <a href="https://returnpick.vercel.app/deals/${deal.id}?utm_source=blogger&utm_medium=owned&utm_campaign=refurbished_tech" target="_blank" rel="nofollow noopener" style="display: block; text-align: center; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 800; padding: 14px 20px; border-radius: 10px; box-shadow: 0 4px 14px rgba(15,23,42,0.3); letter-spacing: -0.2px;">
        💎 쿠팡 반품 재고 &amp; 상태 확인하기 (수량 한정)
      </a>
    </div>
  </div>`;
}

export function renderRefurbishedTechMagazineHtml(title: string, subtitle: string, deals: any[]): string {
  const cardsHtml = deals.map((d, i) => renderRefurbishedTechCard(d, i)).join("\n");

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
        "itemCondition": "https://schema.org/RefurbishedCondition",
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

    <!-- 히어로 배너 -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%); border-radius: 18px; padding: 28px 24px; text-align: center; color: #ffffff; margin-bottom: 32px; box-shadow: 0 8px 24px rgba(15,23,42,0.3);">
      <div style="display: inline-block; background: rgba(59,130,246,0.25); border: 1px solid rgba(59,130,246,0.5); padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 800; color: #93c5fd; margin-bottom: 12px; letter-spacing: 0.5px;">
        💎 쿠팡 정품 인증 반품-미개봉/최상급 전용관
      </div>
      <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0 0 10px 0; line-height: 1.35; letter-spacing: -0.5px;">
        ${title}
      </h1>
      <p style="color: #cbd5e1; font-size: 14px; margin: 0 0 16px 0; line-height: 1.5;">
        ${subtitle}
      </p>
      <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.3); padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; color: #38bdf8;">
        <span>🛡️ 쿠팡 공식 30일 무료 교환/반품 보증 지원</span>
      </div>
    </div>

    <!-- 핫딜 카드 리스트 -->
    <section>
      ${cardsHtml}
    </section>

    <!-- 하단 푸터 -->
    <footer style="margin-top: 40px; padding: 22px; background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.65;">
      <p style="margin: 0 0 8px 0; font-weight: 800; color: #334155; font-size: 13px;">📌 쿠팡 반품 상품 구매 팁</p>
      <ul style="margin: 0; padding-left: 18px;">
        <li>'반품-미개봉'은 단순 박스 라벨만 훼손되거나 비닐 미개봉 상태로 내용물은 100% 새것과 동일합니다.</li>
        <li>'반품-최상'은 단순 변심으로 단 1~2회 개봉 후 바로 반품된 특A급 컨디션 상품입니다.</li>
        <li>수령 후 마음에 들지 않을 경우 쿠팡 와우회원은 30일간 무료 반품이 가능하므로 안심하고 구매하실 수 있습니다.</li>
      </ul>
    </footer>
  </article>`;
}
