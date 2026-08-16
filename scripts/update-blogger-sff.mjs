import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildProductDistributionKit } from "@/lib/productDistributionKit";
import { combinedAllDeals, sffGalleryCoupangDeals } from "./export-sff-and-algumon-deals.mjs";

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

async function updateBlogWithSffAndDeals() {
  console.log("=================================================");
  console.log("   블로그에 디시 SFF 갤러리 핫딜 및 24종 종합 갱신");
  console.log("=================================================\n");

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
  const blogId = process.env.BLOGGER_BLOG_ID;

  // 1. 포스트 목록 가져오기
  const listRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts?status=LIVE`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const listData = await listRes.json();
  const posts = listData.items || [];
  console.log(`현재 공개 포스트 수: ${posts.length}개\n`);

  // 종합 포스트 (첫 번째 포스트 또는 대형 포스트) 갱신
  const roundupPost = posts.find(p => p.id === "5479330542488219707") || posts[0];
  if (roundupPost) {
    console.log(`[종합 대형 포스트 갱신] ${roundupPost.id} -> "알구몬 & 디시 SFF갤 인기 쿠팡 핫딜 24종 총정리"`);

    const sectionsHtml = combinedAllDeals.map((deal, idx) => {
      const sourceTag = idx >= 18 ? "💡 [디시인사이드 SFF 갤러리 추천]" : "🔥 [알구몬 실시간 핫딜]";
      return `
      <section style="margin-bottom: 28px; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px;">
        <span style="font-size: 12px; color: #64748b; font-weight: bold;">${sourceTag}</span>
        <h3 style="margin-top: 4px;">#${idx + 1}. ${deal.title}</h3>
        <p><strong>쿠팡 특가: ${deal.deal_price.toLocaleString()}원</strong> (네이버 최저가: ${deal.naver_lowest_price.toLocaleString()}원 대비 <strong>${(deal.naver_lowest_price - deal.deal_price).toLocaleString()}원 절약</strong>)</p>
        <p>${deal.public_note}</p>
        <p><a href="https://returnpick.vercel.app/deals/${deal.id}?utm_source=blogger&utm_medium=owned&utm_campaign=deal_distribution" style="color: #2563eb; font-weight: bold;">👉 실시간 쿠팡 특가 및 재고 확인하기</a></p>
      </section>`;
    }).join("\n");

    const fullContent = `
    <article>
      <p><strong>[공정위 대가성 고지]</strong> 이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
      <h1>[쿠팡 핫딜 총정리] 알구몬 & 디시 SFF 갤러리 인기 특가 24종 모음</h1>
      <p>알구몬 핫딜 게시판에서 반응이 뜨거웠던 식품/생필품 18종과 디시인사이드 SFF(Small Form Factor) 갤러리에서 검증된 ITX/미니PC 하드웨어 부품 6종(SK하이닉스 P41 2TB, 커세어 SF750, AXP90 풀구리, RTX4060 콤팩트, B650I 메인보드, 2.5K 포터블 모니터)의 가격 비교 및 실시간 재고 정보를 한 번에 정리했습니다.</p>
      <hr style="margin: 24px 0; border: none; border-top: 2px solid #cbd5e1;" />
      ${sectionsHtml}
      <hr style="margin: 24px 0; border: none; border-top: 2px solid #cbd5e1;" />
      <p>가격, 재고, 할인율, 배송 조건은 실시간으로 변동될 수 있습니다. 최종 구매 전 쿠팡 상품 페이지를 확인하세요.</p>
      <p>이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
    </article>`;

    try {
      const updateRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${roundupPost.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          kind: "blogger#post",
          title: "[쿠팡 핫딜 총정리] 알구몬 & 디시 SFF 갤러리 인기 특가 24종 모음",
          content: fullContent
        })
      });

      const updateData = await updateRes.json();
      if (updateData.id) {
        console.log(`  -> ✅ 24종 종합 포스트 갱신 완료! (${updateData.url})`);
      } else {
        console.log(`  -> ❌ 실패:`, updateData);
      }
    } catch (e) {
      console.log(`  -> ❌ 에러:`, e.message);
    }
  }

  console.log("\n=================================================");
  console.log("🎉 블로그 24종 핫딜(SFF 갤러리 포함) 갱신 완료!");
  console.log("=================================================");
}

updateBlogWithSffAndDeals().catch(console.error);
