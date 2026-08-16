import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildProductDistributionKit } from "@/lib/productDistributionKit";
import { allAlgumonWeeklyDeals } from "./export-all-algumon-weekly-deals.mjs";

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

async function updateExistingPostsWithRealDeals() {
  console.log("=================================================");
  console.log("   기존 블로그 포스트를 알구몬 실시간 핫딜로 직접 갱신");
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

  // 1. 현재 블로그의 포스트 목록 가져오기
  const listRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts?status=DRAFT&status=LIVE`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const listData = await listRes.json();
  const existingPosts = listData.items || [];
  console.log(`현재 블로그 포스트 수: ${existingPosts.length}개\n`);

  // 2. 알구몬 핫딜 1~4번은 개별 포스트로 갱신
  for (let i = 0; i < Math.min(existingPosts.length - 1, allAlgumonWeeklyDeals.length); i++) {
    const post = existingPosts[i];
    const deal = allAlgumonWeeklyDeals[i];
    const kit = buildProductDistributionKit(deal);

    console.log(`[포스트 ${i + 1} 갱신] ${post.id} -> "${kit.blogger.title}"`);
    try {
      const patchRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${post.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          kind: "blogger#post",
          title: kit.blogger.title,
          content: kit.blogger.html
        })
      });

      const patchData = await patchRes.json();
      if (patchData.id) {
        console.log(`  -> ✅ 갱신 성공! (${patchData.title})`);
      } else {
        console.log(`  -> ❌ 실패:`, patchData?.error?.message || patchData);
      }
    } catch (e) {
      console.log(`  -> ❌ 오류:`, e.message);
    }
    await sleep(2000);
  }

  // 3. 마지막 포스트는 "알구몬 일주일치 쿠팡 핫딜 BEST 총정리 (18종 모음집)" 대형 종합 포스트로 갱신!
  if (existingPosts.length >= 5) {
    const roundupPost = existingPosts[existingPosts.length - 1];
    console.log(`\n[종합 포스트 갱신] ${roundupPost.id} -> "알구몬 일주일치 쿠팡 핫딜 18종 총정리 모음집"`);

    const allDealsHtml = allAlgumonWeeklyDeals.map((deal, idx) => {
      const kit = buildProductDistributionKit(deal);
      return `
      <section style="margin-bottom: 28px; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px;">
        <h3>#${idx + 1}. ${deal.title}</h3>
        <p><strong>할인가: ${deal.deal_price.toLocaleString()}원</strong> (네이버 최저가: ${deal.naver_lowest_price.toLocaleString()}원 대비 <strong>${(deal.naver_lowest_price - deal.deal_price).toLocaleString()}원 절약</strong>)</p>
        <p>${deal.public_note}</p>
        <p><a href="https://returnpick.vercel.app/deals/${deal.id}?utm_source=blogger&utm_medium=owned&utm_campaign=deal_distribution" style="color: #2563eb; font-weight: bold;">👉 쿠팡 특가 및 실시간 재고 확인하기</a></p>
      </section>`;
    }).join("\n");

    const roundupContent = `
    <article>
      <p><strong>[제휴 안내]</strong> 이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
      <h1>[알구몬 핫딜 모음] 최근 일주일간 가장 인기 있었던 쿠팡 특가 18종 총정리</h1>
      <p>알구몬 핫딜 게시판에서 실시간으로 반응이 뜨거웠던 식품, 생필품, 가전, IT 전자기기 쿠팡 핫딜 18종을 가격 비교와 함께 한 번에 정리했습니다.</p>
      <hr style="margin: 24px 0; border: none; border-top: 2px solid #cbd5e1;" />
      ${allDealsHtml}
      <hr style="margin: 24px 0; border: none; border-top: 2px solid #cbd5e1;" />
      <p>가격, 재고, 배송 정보, 반품 조건은 확인 시점과 구매 시점에 달라질 수 있습니다. 최종 구매 전 쿠팡 상품 페이지에서 다시 확인하세요.</p>
      <p>이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
    </article>`;

    try {
      const patchRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${roundupPost.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          kind: "blogger#post",
          title: "[알구몬 핫딜 모음] 최근 일주일 쿠팡 인기 특가 18종 총정리",
          content: roundupContent
        })
      });

      const patchData = await patchRes.json();
      if (patchData.id) {
        console.log(`  -> ✅ 18종 종합 핫딜 포스트 갱신 성공!`);
      } else {
        console.log(`  -> ❌ 실패:`, patchData?.error?.message || patchData);
      }
    } catch (e) {
      console.log(`  -> ❌ 오류:`, e.message);
    }
  }

  console.log("\n=================================================");
  console.log("🎉 블로그 갱신 및 18종 전체 딜 탑재 완료!");
  console.log(`Blogger에서 확인: https://www.blogger.com/blog/posts/${blogId}`);
  console.log("=================================================");
}

updateExistingPostsWithRealDeals().catch(console.error);
