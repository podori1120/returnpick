import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { golden50Deals } from "./bulk-golden-deals-catalog.mjs";
import { refurbishedTech8Deals } from "./publish-refurbished-tech-post.mjs";
import { rocketFresh7Deals } from "./publish-rocket-fresh-night-deals.mjs";

function generateNaverBlogCopyPasteTemplate() {
  console.log("=================================================");
  console.log("   📝 [네이버 블로그 전용] 원클릭 복사-붙여넣기 템플릿 생성");
  console.log("=================================================\n");

  const allDeals = [
    golden50Deals[0], // 코카콜라
    golden50Deals[1], // 썬키스트
    refurbishedTech8Deals[0], // HP 노트북
    refurbishedTech8Deals[1], // 삼성 제습기
    rocketFresh7Deals[0], // 하림 통닭
    rocketFresh7Deals[1], // 사미헌 갈비탕
    golden50Deals[2], // 햇반
    golden50Deals[3], // 신라면
  ];

  const cardsHtml = allDeals.map((d, i) => {
    const cardDiscountPrice = Math.round(d.deal_price * 0.93); // 카드 7% 할인 가정
    const unitPriceText = d.title.includes("24캔") ? `(캔당 약 ${Math.round(d.deal_price / 24).toLocaleString()}원)` :
                          d.title.includes("36개") ? `(개당 약 ${Math.round(d.deal_price / 36).toLocaleString()}원)` :
                          d.title.includes("20봉") ? `(봉당 약 ${Math.round(d.deal_price / 20).toLocaleString()}원)` :
                          d.title.includes("2팩") ? `(팩당 약 ${Math.round(d.deal_price / 2).toLocaleString()}원)` : "";

    return `
    <div style="margin: 25px 0; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #fafafa; font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;">
      <div style="font-size: 13px; font-weight: bold; color: #03c75a; margin-bottom: 6px;">
        🔥 핫딜 #${i + 1} | [${d.category}]
      </div>
      <h3 style="margin: 0 0 10px 0; font-size: 18px; color: #111111; line-height: 1.4;">
        ${d.title}
      </h3>
      <div style="margin-bottom: 12px; font-size: 14px; color: #444444;">
        • <strong>쿠팡 특가: ${d.deal_price.toLocaleString()}원</strong> <span style="color: #e53e3e; font-weight: bold;">${unitPriceText}</span><br/>
        • <strong>네이버 기준가: ${d.naver_lowest_price.toLocaleString()}원</strong> (약 ${(d.naver_lowest_price - d.deal_price).toLocaleString()}원 절약 🔻)<br/>
        • 💳 <strong>카드사 추가 7% 할인 적용 시: 약 ${cardDiscountPrice.toLocaleString()}원</strong>
      </div>
      <div style="background-color: #e8f5e9; padding: 10px 14px; border-radius: 8px; font-size: 13px; color: #2e7d32; margin-bottom: 14px;">
        💡 <strong>핵심 요약:</strong> ${d.public_note}
      </div>
      <div style="text-align: center;">
        <a href="https://returnpick.vercel.app/deals/${d.id}?utm_source=naver_blog" target="_blank" style="display: inline-block; background-color: #03c75a; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 15px; padding: 12px 24px; border-radius: 8px;">
          👉 네이버 최저가 비교 &amp; 쿠팡 실시간 재고 확인
        </a>
      </div>
    </div>`;
  }).join("\n");

  const fullNaverHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>네이버 블로그 스마트에디터 원클릭 복사용 서식</title>
  <style>
    body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 720px; margin: 30px auto; padding: 20px; background: #ffffff; color: #333333; line-height: 1.7; }
    .guide-box { background: #f0fdf4; border: 2px dashed #03c75a; padding: 16px; border-radius: 10px; margin-bottom: 30px; text-align: center; }
  </style>
</head>
<body>
  <div class="guide-box">
    <h2 style="margin: 0 0 8px 0; color: #03c75a;">📋 네이버 블로그 복사-붙여넣기 가이드</h2>
    <p style="margin: 0; font-size: 14px; color: #4b5563;">아래 내용을 마우스로 드래그(또는 Ctrl+A)하여 복사한 뒤, <strong>네이버 블로그 글쓰기 창에 붙여넣기(Ctrl+V)</strong>하시면 서식과 버튼이 그대로 들어갑니다!</p>
  </div>

  <hr/>

  <!-- 여기서부터 네이버 블로그 본문 -->
  <p style="font-size: 13px; color: #888888; background: #f5f5f5; padding: 8px 12px; border-radius: 4px;">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>

  <h1 style="color: #111111; font-size: 24px; font-weight: bold;">[쿠팡 핫딜 총정리] 실시간 인기 특가 &amp; 60일 가격 추적 검증 BEST 8</h1>

  <p style="font-size: 15px; color: #555555;">
    안녕하세요! 오늘은 폴센트(Fallcent) 실시간 가격 변동 추적 엔진으로 최근 60일간의 가격 변동 내역과 역대 최저가를 꼼꼼하게 검증한 <strong>진짜 쿠팡 핫딜 BEST 8</strong>을 엄선하여 소개해 드립니다.<br/>
    가전제품부터 식품, 생필품까지 네이버 쇼핑 최저가와 비교하여 확실하게 저렴한 상품들만 모았습니다.
  </p>

  <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 24px 0;"/>

  ${cardsHtml}

  <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 24px 0;"/>

  <p style="font-size: 13px; color: #888888;">
    * 상품 가격 및 로켓배송 조건, 카드사 할인 혜택은 실시간으로 변동될 수 있습니다. 최종 구매 전 쿠팡 상품 페이지를 확인해 주세요.<br/>
    * 본 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
  </p>
</body>
</html>`;

  writeFileSync(resolve(process.cwd(), "public/naver_blog_copy_paste.html"), fullNaverHtml, "utf-8");
  console.log("✅ 네이버 블로그 원클릭 복사 서식 생성 완료: public/naver_blog_copy_paste.html");
}

generateNaverBlogCopyPasteTemplate();
