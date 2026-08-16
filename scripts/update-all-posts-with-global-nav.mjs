import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { globalNavTabsHtml } from "@/lib/unitPriceBreakdownDesign";

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

async function ensureAllPostsHaveGlobalNav() {
  console.log("=================================================");
  console.log("   🌟 [5대 기획관] 글로벌 퀵 네비게이션 전 포스트 동기화");
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

  const listRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const listData = await listRes.json();
  const posts = listData.items || [];

  for (const [idx, p] of posts.entries()) {
    console.log(`[${idx + 1}/${posts.length}] 포스트 네비게이션 검증 중: ${p.title}`);
    if (!p.content.includes("VIP 가전관")) {
      const updatedContent = p.content.replace(/<article[^>]*>/i, (match) => `${match}\n${globalNavTabsHtml}`);
      await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${p.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          kind: "blogger#post",
          title: p.title,
          content: updatedContent,
          labels: p.labels
        })
      });
      console.log(`  -> ✅ 글로벌 네비게이션 탭 바 삽입 완료!`);
      await sleep(1000);
    } else {
      console.log(`  -> 이미 네비게이션 바가 적용되어 있습니다.`);
    }
  }

  console.log("\n=================================================");
  console.log("🎉 5대 기획관 상호 연결 네비게이션 동기화 100% 완료!");
  console.log("=================================================");
}

ensureAllPostsHaveGlobalNav().catch(console.error);
