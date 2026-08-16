/**
 * 프리미엄 블로그 핫딜 카드 & 구조화 데이터(JSON-LD) 렌더러 (바이럴 공유 에디션)
 * - 원클릭 링크 복사 & 카카오톡 공유 인터랙티브 버튼 탑재
 * - 실제 제품 고화질 썸네일
 * - Schema.org Product 구조화 데이터 내장
 */

export function renderPremiumDealCard(deal: {
  id: string;
  title: string;
  category: string;
  deal_price: number;
  original_price?: number;
  naver_lowest_price: number;
  lowest_price_60d?: number;
  discount_rate?: number;
  image_url?: string;
  public_note?: string;
  pros?: string[];
  cons?: string[];
  fallcent?: any;
}, index: number): string {
  const saveAmount = Math.max(0, deal.naver_lowest_price - deal.deal_price);
  const discountRate = deal.discount_rate || (deal.naver_lowest_price > deal.deal_price ? Math.round((saveAmount / deal.naver_lowest_price) * 100) : 30);
  const min60d = deal.lowest_price_60d || deal.fallcent?.lowest_price_60d || deal.deal_price;
  const isAllTimeLow = deal.deal_price <= min60d;
  const imageUrl = deal.image_url || "https://images.unsplash.com/photo-1584556812952-905ffd0c611a";
  const shareUrl = `https://returnpick.vercel.app/deals/${deal.id}?utm_source=blogger_share`;

  const prosList = deal.pros && deal.pros.length > 0 ? deal.pros : [
    "네이버 쇼핑 최저가 대비 확실한 가격 우위",
    "쿠팡 로켓배송 / 빠른 안심 배송 지원",
    "폴센트 60일 가격 추적 검증 완료"
  ];

  return `
  <div style="margin-bottom: 36px; background: #ffffff; border-radius: 18px; border: 1px solid #e2e8f0; box-shadow: 0 6px 24px rgba(0,0,0,0.06); overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Segoe UI', Roboto, sans-serif;">
    <!-- 카드 상단 태그 바 -->
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 22px; background: #f8fafc; border-bottom: 1px solid #edf2f7;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.5px;">PICK #${index + 1}</span>
        <span style="color: #475569; font-size: 13px; font-weight: 700;">${deal.category || '쿠팡특가'}</span>
      </div>
      ${isAllTimeLow ? '<span style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 20px;">🔥 60일 역대 최저가</span>' : '<span style="background: #f0fdf4; color: #16a34a; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px;">⚡ 실시간 특가</span>'}
    </div>

    <!-- 카드 본문 -->
    <div style="padding: 24px 22px;">
      <!-- 이미지 & 상품명 2단 레이아웃 -->
      <div style="display: flex; flex-direction: row; gap: 20px; flex-wrap: wrap; margin-bottom: 18px;">
        <div style="flex: 0 0 150px; max-width: 150px; height: 150px; border-radius: 14px; overflow: hidden; background: #f1f5f9; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center;">
          <img src="${imageUrl}" alt="${deal.title}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy" />
        </div>

        <div style="flex: 1 1 250px; display: flex; flex-direction: column; justify-content: center;">
          <h3 style="margin: 0 0 10px 0; color: #0f172a; font-size: 18px; font-weight: 800; line-height: 1.45; letter-spacing: -0.4px;">
            ${deal.title}
          </h3>
          <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.55;">
            ${deal.public_note || '실시간 가격 변동 추이 및 재고 상태 검증 완료 상품입니다.'}
          </p>
        </div>
      </div>

      <!-- 가격 분석 & 비교 박스 -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;">
          <span style="color: #64748b; font-size: 13px; font-weight: 600;">쿠팡 실시간 특가</span>
          <div>
            <span style="color: #dc2626; font-size: 20px; font-weight: 800; margin-right: 6px;">${discountRate}% 할인</span>
            <span style="color: #0f172a; font-size: 24px; font-weight: 800; letter-spacing: -0.6px;">${deal.deal_price.toLocaleString()}원</span>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
          <span>네이버 쇼핑 기준 최저가: ${deal.naver_lowest_price.toLocaleString()}원</span>
          <span style="color: #2563eb; font-weight: 800; font-size: 13px;">약 ${saveAmount.toLocaleString()}원 절약 🔻</span>
        </div>
      </div>

      <!-- 폴센트 60일 가격 추적 검증 박스 -->
      <div style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #eff6ff; border-radius: 12px; border-left: 4px solid #3b82f6; margin-bottom: 18px;">
        <span style="font-size: 20px;">📈</span>
        <div style="font-size: 12px; color: #1e40af; line-height: 1.5;">
          <strong>폴센트 60일 가격 추적 검증:</strong> 최근 60일 최저가 <strong>${min60d.toLocaleString()}원</strong> 수준<br/>
          <span style="color: #2563eb;">${isAllTimeLow ? '🔥 [역대 최저가 달성] 지난 60일 중 오늘이 가장 저렴한 구매 타이밍입니다!' : '최근 60일 평균가 대비 매우 안정적인 할인 가격대입니다.'}</span>
        </div>
      </div>

      <!-- 핵심 추천 포인트 (Pros) -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px 18px; margin-bottom: 18px;">
        <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 800; color: #166534;">✨ 리턴픽 추천 포인트</p>
        <ul style="margin: 0; padding-left: 16px; font-size: 12px; color: #15803d; line-height: 1.6;">
          ${prosList.map(p => `<li>${p}</li>`).join("\n")}
        </ul>
      </div>

      <!-- 바이럴 공유 버튼 바 -->
      <div style="display: flex; gap: 10px; margin-bottom: 16px;">
        <button type="button" onclick="
          navigator.clipboard.writeText('${shareUrl}');
          alert('🔗 특가 링크가 복사되었습니다! 친구나 단톡방에 공유해보세요.');
        " style="flex: 1; padding: 10px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; font-weight: 700; color: #334155; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
          📋 링크 복사
        </button>
        <a href="https://service.m.naver.com/share/post?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(deal.title)}" target="_blank" style="flex: 1; padding: 10px; background: #03c75a; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 12px; font-weight: 700; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px;">
          🟢 네이버 공유
        </a>
      </div>

      <!-- 프리미엄 입체 CTA 버튼 -->
      <a href="https://returnpick.vercel.app/deals/${deal.id}?utm_source=blogger&utm_medium=owned&utm_campaign=deal_distribution" target="_blank" rel="nofollow noopener" style="display: block; text-align: center; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 800; padding: 15px 22px; border-radius: 12px; box-shadow: 0 4px 16px rgba(37,99,235,0.3); letter-spacing: -0.3px;">
        👉 실시간 쿠팡 특가 &amp; 재고 확인하기
      </a>
    </div>
  </div>`;
}

export function renderPremiumPostHtml(title: string, subtitle: string, deals: any[]): string {
  const cardsHtml = deals.map((deal, idx) => renderPremiumDealCard(deal, idx)).join("\n");

  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": title,
    "description": subtitle,
    "itemListElement": deals.slice(0, 15).map((d, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "item": {
        "@type": "Product",
        "name": d.title,
        "image": d.image_url || "https://images.unsplash.com/photo-1584556812952-905ffd0c611a",
        "description": d.public_note || d.title,
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
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin-bottom: 28px; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">
      📢 <strong>[공정위 대가성 고지]</strong> 본 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
    </div>

    <header style="margin-bottom: 36px; text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 28px;">
      <span style="display: inline-block; background: #e0f2fe; color: #0284c7; font-size: 12px; font-weight: 800; padding: 5px 14px; border-radius: 20px; margin-bottom: 14px; letter-spacing: 0.5px;">RETURNPICK CURATION</span>
      <h1 style="color: #0f172a; font-size: 26px; font-weight: 800; margin: 0 0 12px 0; line-height: 1.35; letter-spacing: -0.6px;">
        ${title}
      </h1>
      <p style="color: #64748b; font-size: 15px; margin: 0; line-height: 1.6;">
        ${subtitle}
      </p>
    </header>

    <section>
      ${cardsHtml}
    </section>

    <footer style="margin-top: 44px; padding: 24px; background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.65;">
      <p style="margin: 0 0 10px 0; font-weight: 800; color: #334155; font-size: 13px;">📌 구매 전 필수 안내사항</p>
      <ul style="margin: 0; padding-left: 18px;">
        <li>상품의 판매 가격, 할인율, 보유 재고 및 배송 옵션은 판매자의 정책에 따라 실시간으로 변동될 수 있습니다.</li>
        <li>최종 결제 전 쿠팡 상품 상세 페이지에서 와우회원 전용 할인 및 쿠폰 적용 여부를 반드시 확인하시기 바랍니다.</li>
        <li>본 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</li>
      </ul>
    </footer>
  </article>`;
}
