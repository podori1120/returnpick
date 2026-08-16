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

async function optimizeBlogSeo() {
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

  console.log("Blogger SEO 메타 설명 및 정보 업데이트 중...");
  const patchRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "리턴픽 오늘의 쿠팡 핫딜 & 반품특가",
      description: "알구몬 및 커뮤니티 실시간 쿠팡 핫딜, 로켓배송 특가, 반품 최상급 노트북·가전·생필품 가격비교 가이드"
    })
  });

  const patchData = await patchRes.json();
  if (patchData.id) {
    console.log("✅ 블로그 SEO 메타 최적화 완료!");
    console.log(`- 블로그 이름: ${patchData.name}`);
    console.log(`- 블로그 설명: ${patchData.description}`);
  } else {
    console.log("결과:", patchData);
  }
}

optimizeBlogSeo().catch(console.error);
