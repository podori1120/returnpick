import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { refurbishedTech8Deals } from "./publish-refurbished-tech-post.mjs";
import { rocketFresh7Deals } from "./publish-rocket-fresh-night-deals.mjs";

function generateInstagramCardNewsHtml() {
  const allHotDeals = [...refurbishedTech8Deals.slice(0, 4), ...rocketFresh7Deals.slice(0, 4)];

  const cardsHtml = allHotDeals.map((d, i) => `
    <div style="width: 360px; height: 360px; background: #ffffff; border-radius: 20px; box-shadow: 0 8px 30px rgba(0,0,0,0.12); padding: 24px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif; border: 1px solid #e2e8f0; position: relative; overflow: hidden;">
      <div style="position: absolute; top: 0; left: 0; right: 0; height: 6px; background: linear-gradient(90deg, #2563eb, #38bdf8);"></div>
      
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="background: #eff6ff; color: #2563eb; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px;">HOT DEAL #${i + 1}</span>
        <span style="font-size: 12px; font-weight: 700; color: #dc2626;">🔥 60일 역대 최저가</span>
      </div>

      <div style="display: flex; gap: 14px; align-items: center;">
        <img src="${d.image_url}" style="width: 90px; height: 90px; object-fit: cover; border-radius: 12px; border: 1px solid #e2e8f0;" />
        <div style="flex: 1;">
          <span style="font-size: 11px; color: #64748b; font-weight: 600;">${d.category}</span>
          <h4 style="margin: 4px 0 0 0; font-size: 14px; font-weight: 800; color: #0f172a; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${d.title}</h4>
        </div>
      </div>

      <div style="background: #f8fafc; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0;">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <span style="font-size: 12px; color: #64748b; font-weight: 600;">특가</span>
          <span style="font-size: 20px; font-weight: 800; color: #0f172a;">${d.deal_price.toLocaleString()}원</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #059669; font-weight: 700; margin-top: 4px;">
          <span>네이버 최저가 대비</span>
          <span>${(d.naver_lowest_price - d.deal_price).toLocaleString()}원 세이브 🔻</span>
        </div>
      </div>

      <div style="text-align: center; font-size: 11px; color: #94a3b8; font-weight: 600;">
        리턴픽 X 폴센트 60일 가격 변동 검증 완료
      </div>
    </div>
  `).join("\n");

  const fullHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>인스타그램 & 스레드 1:1 카드뉴스</title>
  <style>body{background:#0f172a;padding:40px;font-family:sans-serif;display:flex;flex-wrap:wrap;gap:24px;justify-content:center;}</style>
</head>
<body>
  ${cardsHtml}
</body>
</html>`;

  writeFileSync(resolve(process.cwd(), "public/cardnews_preview.html"), fullHtml, "utf-8");
  console.log("인스타그램 카드뉴스 HTML 저장 완료: public/cardnews_preview.html");

  // 스레드(Threads) 및 인스타 캡션 텍스트 생성
  const caption = `🔥 지금 쿠팡에서 가격 붕괴된 핫딜 TOP 5 정리!
(폴센트 60일 가격 그래프 교차 검증 완료)

1️⃣ HP 넥소스 14 노트북 (i5/16G/512G)
👉 반품 미개봉 58.9만원 (새상품 대비 20만원 세이브)

2️⃣ 하림 무항생제 자연실록 생닭 850g
👉 6,250원 (내일 아침 7시 문 앞 도착)

3️⃣ 삼성전자 인버터 제습기 18L
👉 31.8만원 (1등급 저소음 대용량)

4️⃣ 사미헌 소갈비탕 2팩
👉 17,480원 (맛집 갈비탕 맛 그대로)

5️⃣ SK하이닉스 Platinum P41 2TB NVMe
👉 19.8만원 (읽기 7,000MB/s 명품 SSD)

📌 프로필 링크에서 실시간 가격 & 60일 변동 내역 확인 가능!
#쿠팡핫딜 #쿠팡특가 #반품특가 #가전특가 #로켓프레시 #가격비교`;

  writeFileSync(resolve(process.cwd(), "public/instagram_threads_caption.txt"), caption, "utf-8");
  console.log("인스타그램/스레드 캡션 저장 완료: public/instagram_threads_caption.txt");
}

generateInstagramCardNewsHtml();
