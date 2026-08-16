import { readFileSync, existsSync } from "node:fs";
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

async function updateMainWithPersonaSelector() {
  console.log("=================================================");
  console.log("   🎯 [1초 취향 핫딜 추천기] 메인 블로그 전면 배포");
  console.log("=================================================\n");

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

  // 🎯 1초 맞춤형 취향 추천기 인터랙티브 위젯
  const personaSelectorHtml = `
  <div style="margin-bottom: 36px; background: #ffffff; border-radius: 18px; border: 2px solid #3b82f6; padding: 24px 20px; box-shadow: 0 6px 24px rgba(59,130,246,0.12); font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif;">
    <div style="text-align: center; margin-bottom: 18px;">
      <span style="background: #eff6ff; color: #2563eb; font-size: 12px; font-weight: 800; padding: 4px 12px; border-radius: 20px;">1-SECOND PERSONALIZED PICK</span>
      <h3 style="margin: 8px 0 4px 0; font-size: 20px; font-weight: 800; color: #0f172a;">🎯 나의 상황에 딱 맞는 꿀딜 찾기</h3>
      <p style="margin: 0; font-size: 13px; color: #64748b;">원하시는 버튼을 누르면 가장 할인율 높은 추천 특가를 즉시 보여드립니다.</p>
    </div>

    <!-- 버튼 그룹 -->
    <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-bottom: 16px;">
      <button type="button" onclick="
        document.getElementById('personaResultBox').innerHTML = '<div style=\\'background:#f8fafc;padding:16px;border-radius:12px;border:1px solid #e2e8f0;\\'><strong>🏠 자취생/1인가구 추천:</strong><br/>• CJ 햇반 36개 (개당 827원)<br/>• 곰곰 만능 한알육수 70알 (알당 139원)<br/>• 농심 신라면 20봉 (봉당 690원)<br/><a href=\\'https://returnpick-deals.blogspot.com/2026/08/18.html\\' style=\\'color:#2563eb;font-weight:bold;margin-top:8px;display:inline-block;\\'>👉 본문에서 가격 확인하기</a></div>';
      " style="padding: 10px 16px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 20px; font-size: 13px; font-weight: 700; color: #334155; cursor: pointer;">
        🏠 자취생 필수품
      </button>

      <button type="button" onclick="
        document.getElementById('personaResultBox').innerHTML = '<div style=\\'background:#f8fafc;padding:16px;border-radius:12px;border:1px solid #e2e8f0;\\'><strong>💻 학생/재택직장인 추천:</strong><br/>• HP 넥소스 14 노트북 (i5/16G/512G 50만원대)<br/>• ZEUSLAP 16인치 2.5K 포터블 모니터 (11만원대)<br/>• SK하이닉스 P41 2TB SSD (19만원대)<br/><a href=\\'https://returnpick-deals.blogspot.com/2026/08/17900.html\\' style=\\'color:#2563eb;font-weight:bold;margin-top:8px;display:inline-block;\\'>👉 반품특가관 보러가기</a></div>';
      " style="padding: 10px 16px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 20px; font-size: 13px; font-weight: 700; color: #334155; cursor: pointer;">
        💻 직장인/학생 가전
      </button>

      <button type="button" onclick="
        document.getElementById('personaResultBox').innerHTML = '<div style=\\'background:#f8fafc;padding:16px;border-radius:12px;border:1px solid #e2e8f0;\\'><strong>🏋️ 홈트/다이어트 추천:</strong><br/>• 광동 썬키스트 제로 24캔 (캔당 535원 0kcal)<br/>• 풀랩핏 논슬립 문틀철봉 (17,900원)<br/>• 풀무원다논 무설탕 그릭요거트 (단백질 2배)<br/><a href=\\'https://returnpick-deals.blogspot.com/2026/08/355ml-x-24-535.html\\' style=\\'color:#2563eb;font-weight:bold;margin-top:8px;display:inline-block;\\'>👉 제로음료 특가 확인</a></div>';
      " style="padding: 10px 16px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 20px; font-size: 13px; font-weight: 700; color: #334155; cursor: pointer;">
        🏋️ 다이어트/홈트
      </button>

      <button type="button" onclick="
        document.getElementById('personaResultBox').innerHTML = '<div style=\\'background:#f8fafc;padding:16px;border-radius:12px;border:1px solid #e2e8f0;\\'><strong>🍲 오늘 야식/내일 아침식사 추천:</strong><br/>• 사미헌 소갈비탕 2팩 (17,480원)<br/>• 하림 자연실록 생닭 850g (6,250원)<br/>• 오늘차림 소불고기 1.06kg (18,900원)<br/><a href=\\'https://returnpick-deals.blogspot.com/2026/08/40-967.html\\' style=\\'color:#059669;font-weight:bold;margin-top:8px;display:inline-block;\\'>👉 로켓프레시 24시 마감관 보러가기</a></div>';
      " style="padding: 10px 16px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 20px; font-size: 13px; font-weight: 700; color: #334155; cursor: pointer;">
        🍲 내일 아침밥 (로켓프레시)
      </button>
    </div>

    <div id="personaResultBox" style="font-size: 14px; color: #1e293b; line-height: 1.6;">
      <div style="background: #f8fafc; padding: 14px; border-radius: 10px; text-align: center; color: #94a3b8; font-size: 13px;">
        👆 위의 카테고리 버튼을 누르면 맞춤형 특가가 즉시 나타납니다.
      </div>
    </div>
  </div>`;

  const pwaBannerHtml = `
  <div style="margin-bottom: 24px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-radius: 14px; padding: 16px 20px; color: #ffffff; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; box-shadow: 0 4px 16px rgba(37,99,235,0.25);">
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 24px;">📱</span>
      <div>
        <div style="font-size: 14px; font-weight: 800; letter-spacing: -0.2px;">홈 화면에 [리턴픽 핫딜] 추가하기</div>
        <div style="font-size: 11px; color: #bfdbfe;">매일 실시간 최저가 &amp; 60일 가격 변동 알림을 원클릭으로 확인하세요.</div>
      </div>
    </div>
    <a href="https://returnpick.vercel.app?utm_source=blogger_pwa" target="_blank" style="background: #ffffff; color: #1d4ed8; text-decoration: none; font-size: 12px; font-weight: 800; padding: 8px 14px; border-radius: 8px; white-space: nowrap;">
      앱 바로가기 ➔
    </a>
  </div>`;

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

  const fullContent = `
  <article style="max-width: 740px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.6;">
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; font-size: 12px; color: #64748b; text-align: center;">
      📢 본 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
    </div>

    ${pwaBannerHtml}

    <header style="margin-bottom: 32px; text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 28px;">
      <span style="display: inline-block; background: #e0f2fe; color: #0284c7; font-size: 12px; font-weight: 800; padding: 5px 14px; border-radius: 20px; margin-bottom: 14px;">RETURNPICK SPECIAL EDITION</span>
      <h1 style="color: #0f172a; font-size: 26px; font-weight: 800; margin: 0 0 12px 0; line-height: 1.35;">
        [쿠팡 핫딜 정리] 카테고리별 실시간 베스트 특가 &amp; 폴센트 60일 가격 추적 검증
      </h1>
      <p style="color: #64748b; font-size: 15px; margin: 0; line-height: 1.6;">
        가전/디지털, 식품, 건강영양제, 생활주방 등 카테고리별로 폴센트 60일 가격 변동과 역대 최저가를 교차 검증한 진짜 핫딜 모음집입니다.
      </p>
    </header>

    ${personaSelectorHtml}

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
      content: fullContent,
      labels: ["쿠팡핫딜", "맞춤형핫딜", "폴센트검증", "가격비교", "가전특가", "식품특가"]
    })
  });

  const updateData = await updateRes.json();
  console.log(`✅ 1초 취향 추천기 탑재 메인 포스트 갱신 완료! (${updateData.url})`);
}

updateMainWithPersonaSelector().catch(console.error);
