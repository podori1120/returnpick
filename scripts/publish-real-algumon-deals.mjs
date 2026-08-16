import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildProductDistributionKit } from "@/lib/productDistributionKit";
import { allAlgumonWeeklyDeals } from "./export-all-algumon-weekly-deals.mjs";

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

async function publishAllAlgumonDeals() {
  console.log("=================================================");
  console.log(`   알구몬 일주일치 [쿠팡] 핫딜 총 ${allAlgumonWeeklyDeals.length}종 블로그 발행기`);
  console.log("=================================================\n");

  const blogId = process.env.BLOGGER_BLOG_ID;
  if (!blogId) {
    console.error("[ERROR] BLOGGER_BLOG_ID 미설정");
    return;
  }

  // Access Token 갱신
  console.log("Google OAuth Access Token 갱신 중...");
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
  if (!tokens.access_token) {
    console.error("[ERROR] Access Token 획득 실패:", tokens);
    return;
  }
  const accessToken = tokens.access_token;
  console.log("[OK] Access Token 획득 완료!\n");

  let successCount = 0;
  for (const [index, deal] of allAlgumonWeeklyDeals.entries()) {
    console.log(`[${index + 1}/${allAlgumonWeeklyDeals.length}] "${deal.title}" 리뷰 발행 중...`);
    const kit = buildProductDistributionKit(deal);

    try {
      const endpoint = `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(blogId)}/posts?isDraft=true`;
      const postRes = await fetch(endpoint, {
        method: "POST",
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

      const postData = await postRes.json();
      if (postData.id) {
        successCount++;
        console.log(`  -> ✅ 등록 성공! Post ID: ${postData.id}`);
      } else {
        console.error(`  -> ❌ 등록 결과:`, postData?.error?.message || postData);
      }
    } catch (err) {
      console.error(`  -> ❌ 에러 발생:`, err.message);
    }

    if (index < allAlgumonWeeklyDeals.length - 1) {
      await sleep(3500);
    }
  }

  console.log("\n=================================================");
  console.log(`🎉 알구몬 일주일치 핫딜 총 ${allAlgumonWeeklyDeals.length}개 중 ${successCount}개 포스팅 완료!`);
  console.log(`Blogger 관리자에서 확인: https://www.blogger.com/blog/posts/${blogId}`);
  console.log("=================================================");
}

publishAllAlgumonDeals().catch(console.error);
