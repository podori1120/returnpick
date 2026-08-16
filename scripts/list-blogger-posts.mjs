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

async function listBlogPosts() {
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

  const postsRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts?status=DRAFT&status=LIVE`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const postsData = await postsRes.json();

  console.log("=========================================");
  console.log(`현재 블로그(${blogId})에 등록된 포스트 목록`);
  console.log("=========================================");
  if (postsData.items) {
    console.log(`총 ${postsData.items.length}개의 포스트가 등록되어 있습니다:\n`);
    postsData.items.forEach((p, idx) => {
      console.log(`[${idx + 1}] 상태: [${p.status}] | ID: ${p.id}`);
      console.log(`    제목: ${p.title}`);
      console.log(`    URL: ${p.url}\n`);
    });
  } else {
    console.log("등록된 포스트가 없습니다:", postsData);
  }
}

listBlogPosts().catch(console.error);
