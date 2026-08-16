import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

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

async function publishAllDraftsToLive() {
  console.log("=================================================");
  console.log("   블로그 모든 초안 포스트를 공개(LIVE)로 전환");
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

  // 1. 현재 블로그의 모든 포스트 목록 가져오기
  const listRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts?status=DRAFT&status=LIVE`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const listData = await listRes.json();
  const posts = listData.items || [];
  console.log(`총 ${posts.length}개의 포스트 확인됨.\n`);

  const publishedUrls = [];

  for (const [idx, post] of posts.entries()) {
    console.log(`[${idx + 1}/${posts.length}] "${post.title}" 공개 전환 중... (ID: ${post.id})`);
    
    try {
      const pubRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${post.id}/publish`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      const pubData = await pubRes.json();
      if (pubData.id && pubData.url) {
        console.log(`  -> ✅ 공개 완료! URL: ${pubData.url}`);
        publishedUrls.push({
          title: pubData.title,
          url: pubData.url,
          id: pubData.id
        });
      } else {
        console.log(`  -> ⚠️ 결과:`, pubData?.error?.message || pubData);
        if (post.url) {
          publishedUrls.push({ title: post.title, url: post.url, id: post.id });
        }
      }
    } catch (e) {
      console.error(`  -> ❌ 에러:`, e.message);
    }

    if (idx < posts.length - 1) {
      await sleep(2000);
    }
  }

  console.log("\n=================================================");
  console.log("🎉 모든 포스트 공개 전환 완료! 공개된 링크 목록:");
  console.log("=================================================");
  publishedUrls.forEach((p, i) => {
    console.log(`[${i + 1}] ${p.title}`);
    console.log(`    👉 ${p.url}\n`);
  });
}

publishAllDraftsToLive().catch(console.error);
