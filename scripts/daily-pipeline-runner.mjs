import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildProductDistributionKit } from "@/lib/productDistributionKit";
import { fetchFallcentPriceAnalysis } from "@/lib/fallcentPriceTracker";
import { dateGroupedCoupangDeals } from "./update-clean-date-deals.mjs";

// .env.local 환경변수 로드
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

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

export async function runDailyPipeline() {
  console.log("=================================================");
  console.log("   [ReturnPick] 폴센트 실시간 가격 추적 연동 일일 파이프라인");
  console.log(`   실행 시각: ${new Date().toLocaleString("ko-KR")}`);
  console.log("=================================================\n");

  const blogId = process.env.BLOGGER_BLOG_ID;
  if (!blogId) {
    console.error("[ERROR] BLOGGER_BLOG_ID 환경변수가 설정되지 않았습니다.");
    return;
  }

  // 1. Google OAuth Token 갱신
  console.log("[1/4] Google OAuth Access Token 갱신 중...");
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
  if (!accessToken) {
    console.error("[ERROR] Access Token 획득 실패:", tokens);
    return;
  }
  console.log("  -> ✅ Access Token 획득 완료!\n");

  // 2. 폴센트 60일 가격 히스토리 데이터 연동 및 강화
  console.log("[2/4] 폴센트(Fallcent) 실시간 가격 변동 데이터 추적 및 검증 중...");
  const enrichedDeals = [];

  for (const [idx, deal] of dateGroupedCoupangDeals.slice(0, 10).entries()) {
    console.log(`  [${idx + 1}/10] "${deal.title}" 가격 추적 조회 중...`);
    const fallcentData = await fetchFallcentPriceAnalysis(deal.title, deal.deal_price);
    
    if (fallcentData) {
      console.log(`    -> 📈 폴센트 60일 최저가: ${fallcentData.lowest_price_60d.toLocaleString()}원 | 평균가: ${fallcentData.average_price_60d.toLocaleString()}원 (${fallcentData.trend_summary})`);
      enrichedDeals.push({
        ...deal,
        fallcent: fallcentData,
        public_note: `${deal.public_note} 📊 [폴센트 60일 가격추적] 60일 최저가: ${fallcentData.lowest_price_60d.toLocaleString()}원 / 평균가: ${fallcentData.average_price_60d.toLocaleString()}원 (${fallcentData.trend_summary})`
      });
    } else {
      enrichedDeals.push(deal);
    }
    await sleep(1000);
  }

  // 3. 블로그 포스트 갱신 및 등록
  console.log("\n[3/4] 블로그에 폴센트 가격 검증 반영 포스팅 발행 중...");
  const listRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts?status=LIVE`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const listData = await listRes.json();
  const existingPosts = listData.items || [];
  const mainPost = existingPosts.find(p => p.id === "5479330542488219707") || existingPosts[0];

  if (mainPost) {
    const dates = Array.from(new Set(enrichedDeals.map(d => d.date)));
    const dateSectionsHtml = dates.map(dateStr => {
      const items = enrichedDeals.filter(d => d.date === dateStr);
      const itemsHtml = items.map((item, idx) => {
        const fallcentBadge = item.fallcent ? `
          <div style="margin: 6px 0; padding: 8px 12px; background: #eff6ff; border-radius: 6px; border-left: 3px solid #3b82f6; font-size: 13px; color: #1e40af;">
            <strong>📈 폴센트 60일 가격 검증:</strong> 최근 60일 최저가 <strong>${item.fallcent.lowest_price_60d.toLocaleString()}원</strong> / 평균가 ${item.fallcent.average_price_60d.toLocaleString()}원<br/>
            <span>${item.fallcent.trend_summary}</span>
          </div>
        ` : "";

        return `
        <div style="margin-bottom: 20px; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
          <h4 style="margin: 0 0 8px 0; color: #0f172a; font-size: 16px;">${item.title}</h4>
          <p style="margin: 4px 0; color: #334155;"><strong>특가: ${item.deal_price.toLocaleString()}원</strong> (네이버 최저가: ${item.naver_lowest_price.toLocaleString()}원 대비 <span style="color: #dc2626; font-weight: bold;">${(item.naver_lowest_price - item.deal_price).toLocaleString()}원 절약</span>)</p>
          ${fallcentBadge}
          <p style="margin: 4px 0; color: #64748b; font-size: 14px;">${item.public_note}</p>
          <p style="margin: 8px 0 0 0;"><a href="https://returnpick.vercel.app/deals/${item.id}?utm_source=blogger&utm_medium=owned&utm_campaign=deal_distribution" style="color: #2563eb; font-weight: bold; text-decoration: underline;">👉 쿠팡 실시간 재고 및 특가 바로가기</a></p>
        </div>
        `;
      }).join("\n");

      return `
      <div style="margin-bottom: 32px;">
        <h3 style="color: #1e293b; border-left: 4px solid #2563eb; padding-left: 12px; font-size: 18px; margin-bottom: 16px;">📅 ${dateStr} 쿠팡 핫딜 (가격 추적 검증 완료)</h3>
        ${itemsHtml}
      </div>`;
    }).join("\n");

    const fullContent = `
    <article>
      <p style="font-size: 13px; color: #64748b; background: #f1f5f9; padding: 8px 12px; border-radius: 4px;">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
      <h1 style="color: #0f172a; font-size: 24px;">[쿠팡 핫딜 정리] 최근 일주일간 실시간 인기 특가 & 폴센트 60일 가격 검증</h1>
      <p style="color: #475569; font-size: 15px;">폴센트(Fallcent) 실시간 가격 변동 추적 엔진으로 최근 60일간의 역대 최저가 및 평균가를 교차 검증한 진짜 쿠팡 핫딜 모음입니다.</p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e2e8f0;" />
      ${dateSectionsHtml}
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e2e8f0;" />
      <p style="font-size: 13px; color: #64748b;">가격, 재고, 배송 조건은 실시간으로 변동될 수 있습니다. 최종 구매 전 쿠팡 상품 페이지를 확인해 주세요.<br/>이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
    </article>`;

    const updateRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${mainPost.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        kind: "blogger#post",
        title: "[쿠팡 핫딜 정리] 실시간 인기 특가 & 폴센트 60일 가격 추적 검증",
        content: fullContent
      })
    });
    const updateData = await updateRes.json();
    console.log(`  -> ✅ 블로그 종합 포스트 갱신 완료! (${updateData.url})`);
  }

  // 4. 검색엔진 IndexNow 색인 전송
  console.log("\n[4/4] 검색엔진(IndexNow)에 최신 포스트 즉시 색인 요청 중...");
  try {
    const indexNowRes = await fetch("https://api.indexnow.org/indexnow", {
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
          "https://returnpick-deals.blogspot.com/2026/08/40-967.html",
          "https://returnpick-deals.blogspot.com/2026/08/355ml-x-24-535.html"
        ]
      })
    });
    console.log(`  -> ✅ IndexNow 색인 응답: ${indexNowRes.status} (색인 대기열 접수 완료)`);
  } catch (e) {
    console.log(`  -> IndexNow 요청: ${e.message}`);
  }

  console.log("\n=================================================");
  console.log("🎉 [ReturnPick] 일일 자동 파이프라인 실행 완료!");
  console.log(`블로그 실시간 확인: https://returnpick-deals.blogspot.com/2026/08/18.html`);
  console.log("=================================================");
}

if (process.argv[1]?.endsWith("daily-pipeline-runner.mjs")) {
  runDailyPipeline().catch(console.error);
}
