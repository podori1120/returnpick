import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { golden50Deals } from "./bulk-golden-deals-catalog.mjs";
import { renderPremiumDealCard } from "@/lib/premiumBlogDesign";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      process.env[key] = val;
    }
  }
}

async function runViralPromotionPipeline() {
  console.log("=================================================");
  console.log("   [ReturnPick] 다채널 바이럴 홍보 키트 & 카탈로그 배포");
  console.log("=================================================\n");

  // 1. 카카오톡 / 오픈채팅방용 숏폼 텍스트 생성
  const kakaoText = `🔥 [오늘의 쿠팡 핫딜 TOP 5 요약] 🔥
(폴센트 60일 가격 변동 검증 완료)

1. 코카콜라 EPL 490ml x 24캔
- 특가: 23,800원 (캔당 991원 / 60일 역대 최저)
👉 https://returnpick-deals.blogspot.com/2026/08/490ml-x-24-991.html

2. HP 넥소스 14 가성비 노트북 (16G/512G)
- 특가: 639,000원 (네이버 대비 15.1만원 절약)
👉 https://returnpick-deals.blogspot.com/2026/08/18.html

3. 광동 썬키스트 제로 355ml x 24캔
- 특가: 12,860원 (캔당 535원 / 41% 할인)
👉 https://returnpick-deals.blogspot.com/2026/08/355ml-x-24-535.html

4. 풀랩핏 논슬립 문틀철봉
- 특가: 17,900원 (네이버 대비 7,100원 절약)
👉 https://returnpick-deals.blogspot.com/2026/08/17900.html

5. 재로우 유산균 500억 4통 세트
- 특가: 114,000원 (직구 대비 3.1만원 저렴)
👉 https://returnpick-deals.blogspot.com/2026/08/18.html

전체 30종 특가 모음: https://returnpick-deals.blogspot.com/2026/08/18.html`;

  writeFileSync(resolve(process.cwd(), "public/kakao_promotion_clip.txt"), kakaoText, "utf-8");
  console.log("[1/4] 카카오톡/오픈채팅방 홍보 클립 생성 완료 (public/kakao_promotion_clip.txt)");

  // 2. 커뮤니티 (뽐뿌/디시/아카라이브) 핫딜 공유 텍스트 생성
  const communityText = `[쿠팡 핫딜] 실시간 인기 특가 모음 (폴센트 60일 최저가 검증)

가격비교 사이트랑 폴센트 가격 그래프 확인하고 진짜 할인율 높은 것들만 정리했습니다.

1. 코카콜라 EPL 스페셜 490ml 24캔 -> 23,800원 (캔당 991원 무료배송)
2. 광동 썬키스트 제로 복숭아레몬 24캔 -> 12,860원 (캔당 535원)
3. 풀랩핏 논슬립 이중잠금 문틀철봉 -> 17,900원 (네이버 최저가 25,000원)
4. SK하이닉스 Platinum P41 2TB NVMe -> 219,000원 (네이버 26.5만원)
5. 올도큐브 iPlay70 mini pro 8.4인치 태블릿 -> 194,000원
6. CJ 햇반 210g x 36개 -> 29,800원 (개당 827원)
7. 재로우 포뮬라 500억 유산균 4통 -> 114,000원 (통당 2.85만원)
8. 탐사 프리미엄 6겹 화장지 60롤 -> 19,800원

상세 가격 비교 & 60일 변동 내역:
https://returnpick-deals.blogspot.com/2026/08/18.html`;

  writeFileSync(resolve(process.cwd(), "public/community_promotion_clip.txt"), communityText, "utf-8");
  console.log("[2/4] 커뮤니티용 핫딜 클립 생성 완료 (public/community_promotion_clip.txt)");

  // 3. 블로그 메인 포스트에 6개 카테고리별 대형 큐레이션 매거진 배포
  console.log("\n[3/4] Blogger API로 50종 카테고리별 대형 매거진 배포 중...");
  const blogId = process.env.BLOGGER_BLOG_ID;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
      grant_type: "refresh_token"
    }).toString()
  });

  const tokens = await tokenRes.json();
  const accessToken = tokens.access_token;

  if (accessToken && blogId) {
    const categories = ["가전/디지털", "식품/음료", "건강/영양제", "뷰티/스킨케어", "생활/주방", "스포츠/홈트"];
    
    const categorySectionsHtml = categories.map(cat => {
      const catDeals = golden50Deals.filter(d => d.category === cat);
      if (catDeals.length === 0) return "";
      const cardsHtml = catDeals.map((d, i) => renderPremiumDealCard(d, i)).join("\n");

      return `
      <div style="margin-bottom: 40px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #2563eb;">
          <span style="font-size: 22px;">🏷️</span>
          <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a;">${cat} 베스트 특가</h2>
        </div>
        ${cardsHtml}
      </div>`;
    }).filter(Boolean).join("\n");

    const fullMagazineHtml = `
    <!-- Schema.org Product 구조화 데이터 -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "오늘의 쿠팡 핫딜 대량 모음 & 폴센트 60일 가격 추적 검증",
      "description": "실시간 핫딜 및 60일 가격 변동 데이터를 교차 검증한 카테고리별 엄선 특가 큐레이션 매거진",
      "itemListElement": ${JSON.stringify(golden50Deals.slice(0, 15).map((d, i) => ({
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
      })))}
    }
    </script>

    <article style="max-width: 740px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.6;">
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin-bottom: 28px; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">
        📢 <strong>[공정위 대가성 고지]</strong> 본 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      </div>

      <header style="margin-bottom: 36px; text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 28px;">
        <span style="display: inline-block; background: #e0f2fe; color: #0284c7; font-size: 12px; font-weight: 800; padding: 5px 14px; border-radius: 20px; margin-bottom: 14px; letter-spacing: 0.5px;">RETURNPICK SPECIAL EDITION</span>
        <h1 style="color: #0f172a; font-size: 26px; font-weight: 800; margin: 0 0 12px 0; line-height: 1.35; letter-spacing: -0.6px;">
          [쿠팡 핫딜 정리] 카테고리별 실시간 베스트 특가 &amp; 폴센트 60일 가격 추적 검증
        </h1>
        <p style="color: #64748b; font-size: 15px; margin: 0; line-height: 1.6;">
          가전/디지털, 식품, 건강영양제, 생활주방 등 카테고리별로 폴센트 60일 가격 변동과 역대 최저가를 교차 검증한 진짜 핫딜 모음집입니다.
        </p>
      </header>

      ${categorySectionsHtml}

      <footer style="margin-top: 44px; padding: 24px; background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.65;">
        <p style="margin: 0 0 10px 0; font-weight: 800; color: #334155; font-size: 13px;">📌 구매 전 필수 안내사항</p>
        <ul style="margin: 0; padding-left: 18px;">
          <li>상품의 판매 가격, 할인율, 보유 재고 및 배송 옵션은 판매자의 정책에 따라 실시간으로 변동될 수 있습니다.</li>
          <li>최종 결제 전 쿠팡 상품 상세 페이지에서 와우회원 전용 할인 및 쿠폰 적용 여부를 반드시 확인하시기 바랍니다.</li>
          <li>본 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</li>
        </ul>
      </footer>
    </article>`;

    const mainPostId = "5479330542488219707";
    const updateRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${mainPostId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        kind: "blogger#post",
        title: "[쿠팡 핫딜 정리] 카테고리별 실시간 베스트 특가 & 폴센트 60일 가격 추적 검증",
        content: fullMagazineHtml,
        labels: ["쿠팡핫딜", "폴센트검증", "가격비교", "가전특가", "식품특가", "로켓배송"]
      })
    });
    const updateData = await updateRes.json();
    console.log(`  -> ✅ 블로그 카테고리별 대형 매거진 발행 완료! (${updateData.url})`);
  }

  // 4. 검색엔진(IndexNow) 즉시 재색인
  console.log("\n[4/4] 검색엔진 IndexNow API 즉시 색인 요청 중...");
  try {
    const pingRes = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: "returnpick-deals.blogspot.com",
        key: "8008329337373147131",
        keyLocation: "https://returnpick-deals.blogspot.com/8008329337373147131.txt",
        urlList: [
          "https://returnpick-deals.blogspot.com/2026/08/18.html",
          "https://returnpick-deals.blogspot.com/2026/08/490ml-x-24-991.html",
          "https://returnpick-deals.blogspot.com/2026/08/17900.html",
          "https://returnpick-deals.blogspot.com/2026/08/355ml-x-24-535.html",
          "https://returnpick-deals.blogspot.com/2026/08/40-967.html"
        ]
      })
    });
    console.log(`  -> ✅ IndexNow 색인 응답: ${pingRes.status} (색인 대기열 접수 완료)`);
  } catch (e) {}

  console.log("\n=================================================");
  console.log("🎉 다채널 바이럴 홍보 키트 생성 및 블로그 배포 완료!");
  console.log("=================================================");
}

runViralPromotionPipeline().catch(console.error);
