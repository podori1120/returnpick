import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { renderRocketFreshMagazineHtml } from "@/lib/rocketFreshNightDesign";
import { rocketFresh7Deals } from "./publish-rocket-fresh-night-deals.mjs";

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

async function updateRocketFreshDedicatedPost() {
  console.log("=================================================");
  console.log("   🌙 [로켓프레시 자정 마감] 전용 포스트 LIVE 갱신");
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

  const targetPostId = "1802995966645046698"; // 낫또 포함 신선식품 전용 포스트

  const magazineHtml = renderRocketFreshMagazineHtml(
    "[오늘 밤 24:00 마감] 내일 아침 7시 문 앞 도착! 로켓프레시 신선특가 BEST 7",
    "오늘 밤 12시 전에 결제 시 내일 아침 7시 문 앞 보랭백으로 신선하게 도착하는 밀키트, 통닭, 소불고기, 그릭요거트, 생낫또 실시간 최저가 모음입니다.",
    rocketFresh7Deals
  );

  const updateRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${targetPostId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      kind: "blogger#post",
      title: "[오늘 밤 24:00 마감] 내일 아침 7시 도착! 로켓프레시 신선특가 BEST 7",
      content: magazineHtml,
      labels: ["로켓프레시", "새벽배송", "쿠팡특가", "마감세일", "밀키트", "신선식품"]
    })
  });

  const updateData = await updateRes.json();
  console.log(`✅ 로켓프레시 전용 포스트 갱신 완료! (${updateData.url})`);

  // 검색엔진 즉시 색인
  if (updateData.url) {
    try {
      const pingRes = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host: "returnpick-deals.blogspot.com",
          key: "8008329337373147131",
          keyLocation: "https://returnpick-deals.blogspot.com/8008329337373147131.txt",
          urlList: [updateData.url]
        })
      });
      console.log(`IndexNow 색인 요청 완료 (${pingRes.status})`);
    } catch (e) {}
  }
}

updateRocketFreshDedicatedPost().catch(console.error);
