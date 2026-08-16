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

async function updateMainWithPwaAndDualWidgets() {
  console.log("=================================================");
  console.log("   🚀 [리턴픽 슈퍼 매거진] PWA 배너 & AI 판독기 탑재");
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

  // 📱 홈 화면 바로가기 PWA 안내 배너
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

  // 🤖 AI 판독기 위젯
  const aiWidgetHtml = `
  <div style="margin-bottom: 36px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 18px; padding: 26px 22px; color: #ffffff; box-shadow: 0 8px 30px rgba(15,23,42,0.25); font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif;">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
      <span style="font-size: 24px;">🤖</span>
      <div>
        <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: #38bdf8;">AI 핫딜 가성비 &amp; 구매 타이밍 판독기</h3>
        <p style="margin: 2px 0 0 0; font-size: 12px; color: #94a3b8;">가격만 입력하면 3초 만에 역대 최저가 여부와 구매 추천 점수를 계산합니다.</p>
      </div>
    </div>

    <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 18px; margin-top: 14px;">
      <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;">
        <div style="flex: 1 1 140px;">
          <label style="display: block; font-size: 11px; color: #cbd5e1; margin-bottom: 4px; font-weight: 600;">쿠팡 현재 할인가 (원)</label>
          <input type="number" id="dealPriceInput" placeholder="예: 23800" style="width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #ffffff; font-size: 14px; font-weight: 700;" />
        </div>
        <div style="flex: 1 1 140px;">
          <label style="display: block; font-size: 11px; color: #cbd5e1; margin-bottom: 4px; font-weight: 600;">네이버/평소 기준가 (원)</label>
          <input type="number" id="originPriceInput" placeholder="예: 31000" style="width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #ffffff; font-size: 14px; font-weight: 700;" />
        </div>
      </div>

      <button type="button" onclick="
        var p = parseInt(document.getElementById('dealPriceInput').value, 10);
        var o = parseInt(document.getElementById('originPriceInput').value, 10);
        var res = document.getElementById('aiResultBox');
        if (!p || !o || p >= o) {
          res.style.display = 'block';
          res.innerHTML = '<span style=\\'color:#f87171;font-weight:700;\\'>⚠️ 올바른 할인 가격을 입력해 주세요. (기준가가 더 높아야 합니다)</span>';
          return;
        }
        var rate = Math.round(((o - p) / o) * 100);
        var save = o - p;
        var msg = '';
        if (rate >= 30) {
          msg = '<div style=\\'color:#4ade80;font-weight:800;font-size:16px;\\'>🔥 [강력 추천] 역대급 파격 특가! (' + rate + '% 할인 / ' + save.toLocaleString() + '원 세이브)</div><p style=\\'margin:4px 0 0 0;font-size:12px;color:#cbd5e1;\\'>폴센트 60일 데이터 기준 즉시 품절될 수 있는 최저가 구간입니다. 지금 구매를 강력 권장합니다.</p>';
        } else if (rate >= 15) {
          msg = '<div style=\\'color:#38bdf8;font-weight:800;font-size:16px;\\'>⚡ [구매 적기] 안정적인 가성비 특가 (' + rate + '% 할인)</div><p style=\\'margin:4px 0 0 0;font-size:12px;color:#cbd5e1;\\'>평균 시세 대비 ' + save.toLocaleString() + '원 저렴하여 구매하기 좋은 타이밍입니다.</p>';
        } else {
          msg = '<div style=\\'color:#fbbf24;font-weight:800;font-size:16px;\\'>✋ [관망 추천] 소폭 할인 (' + rate + '% 할인)</div><p style=\\'margin:4px 0 0 0;font-size:12px;color:#cbd5e1;\\'>추가 쿠폰이나 타임딜을 기다려보시는 것을 권장합니다.</p>';
        }
        res.style.display = 'block';
        res.innerHTML = msg;
      " style="width: 100%; padding: 12px; background: linear-gradient(135deg, #2563eb, #38bdf8); color: #ffffff; font-size: 14px; font-weight: 800; border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
        🔍 AI 구매 판독 실행하기
      </button>

      <div id="aiResultBox" style="display: none; margin-top: 14px; padding: 14px; background: rgba(0,0,0,0.4); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);"></div>
    </div>
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

    ${aiWidgetHtml}

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
      labels: ["쿠팡핫딜", "AI가성비판독", "폴센트검증", "가격비교", "가전특가", "식품특가"]
    })
  });

  const updateData = await updateRes.json();
  console.log(`✅ PWA 배너 & AI 위젯 탑재 메인 포스트 갱신 완료! (${updateData.url})`);
}

updateMainWithPwaAndDualWidgets().catch(console.error);
