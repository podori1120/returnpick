import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { renderPremiumPostHtml } from "@/lib/premiumBlogDesign";
import { dateGroupedCoupangDeals } from "./update-clean-date-deals.mjs";

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

async function applyAdvancedSeoAndDesign() {
  console.log("=================================================");
  console.log("   블로그 최고급 반응형 디자인 & SEO Labels 전면 적용");
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
  if (!accessToken) {
    console.error("[ERROR] Access Token 획득 실패");
    return;
  }

  // 1. 메인 종합 포스트 (JSON-LD + 이미지 + 태그)
  const mainPostId = "5479330542488219707";
  console.log(`[1/5] 메인 종합 포스트(${mainPostId}) 최고급 디자인 & Labels 갱신 중...`);

  const premiumMainHtml = renderPremiumPostHtml(
    "오늘의 쿠팡 핫딜 & 폴센트 60일 최저가 검증 모음",
    "폴센트 가격 추적 엔진으로 60일간의 가격 변동과 역대 최저가를 전수 검증한 실시간 핫딜 큐레이션입니다.",
    dateGroupedCoupangDeals
  );

  const mainUpdateRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${mainPostId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      kind: "blogger#post",
      title: "[쿠팡 핫딜 정리] 실시간 인기 특가 & 폴센트 60일 가격 추적 검증",
      content: premiumMainHtml,
      labels: ["쿠팡핫딜", "폴센트검증", "가격비교", "로켓배송", "특가모음"]
    })
  });
  const mainData = await mainUpdateRes.json();
  console.log(`  -> ✅ 메인 포스트 갱신 완료! (${mainData.url})\n`);
  await sleep(1500);

  // 2. 단독 포스트 4개 개별 최고급 디자인 갱신
  const singlePosts = [
    {
      id: "7685606082388474435",
      deal: dateGroupedCoupangDeals[0],
      title: "[쿠팡 핫딜 정리] 코카콜라 프리미어리그 스페셜 490ml x 24캔 (캔당 991원 무료배송)",
      labels: ["쿠팡핫딜", "코카콜라", "음료특가", "무료배송"]
    },
    {
      id: "5041237301912454229",
      deal: dateGroupedCoupangDeals[1],
      title: "[쿠팡 핫딜 정리] 풀랩핏 와이드그립 논슬립 이중잠금 문틀철봉 (17,900원 무료배송)",
      labels: ["쿠팡핫딜", "홈트", "문틀철봉", "운동기구"]
    },
    {
      id: "5958500708687351036",
      deal: dateGroupedCoupangDeals[2],
      title: "[쿠팡 핫딜 정리] 광동 썬키스트 제로 복숭아레몬 소다 355ml x 24캔 (캔당 535원)",
      labels: ["쿠팡핫딜", "제로음료", "썬키스트", "탄산음료"]
    },
    {
      id: "1802995966645046698",
      deal: dateGroupedCoupangDeals[3],
      title: "[쿠팡 핫딜 정리] 일본 규슈 백화점 입점 생 낫또 40팩 세트 (팩당 967원 무료배송)",
      labels: ["쿠팡핫딜", "낫또", "건강식품", "로켓프레시"]
    }
  ];

  for (const [idx, p] of singlePosts.entries()) {
    console.log(`[${idx + 2}/5] 단독 포스트(${p.id}) 최고급 디자인 & Labels 갱신 중...`);
    const singleHtml = renderPremiumPostHtml(
      p.deal.title,
      `${p.deal.public_note} (네이버 최저가 대비 ${(p.deal.naver_lowest_price - p.deal.deal_price).toLocaleString()}원 절약)`,
      [p.deal]
    );

    const updateRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${p.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        kind: "blogger#post",
        title: p.title,
        content: singleHtml,
        labels: p.labels
      })
    });
    const data = await updateRes.json();
    console.log(`  -> ✅ 갱신 완료! (${data.title})`);
    await sleep(1500);
  }

  // 3. 검색엔진 즉시 색인 재전송
  console.log("\n[검색엔진] IndexNow API에 업그레이드된 URL 전송 중...");
  try {
    const pingRes = await fetch("https://api.indexnow.org/indexnow", {
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
          "https://returnpick-deals.blogspot.com/2026/08/355ml-x-24-535.html",
          "https://returnpick-deals.blogspot.com/2026/08/40-967.html"
        ]
      })
    });
    console.log(`  -> ✅ IndexNow 색인 응답 상태: ${pingRes.status}`);
  } catch (e) {}

  console.log("\n=================================================");
  console.log("🎉 블로그 5개 전체 포스팅 최고급 디자인 & SEO 라벨링 완비!");
  console.log("실시간 확인: https://returnpick-deals.blogspot.com/2026/08/18.html");
  console.log("=================================================");
}

applyAdvancedSeoAndDesign().catch(console.error);
