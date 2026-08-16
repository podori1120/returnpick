import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { renderHighValueBanpumMagazineHtml } from "@/lib/highValueBanpumKingRenderer";
import { banpumKing8Deals } from "./publish-banpum-king-deals.mjs";

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

async function deployAllHighValueBanpumHalls() {
  console.log("=================================================");
  console.log("   👑 [전면 방향 전환] 고액 반품 위주 5대 전문관 배포");
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

  // 1. 포스트 1: 메인 종합관 (5479330542488219707)
  console.log("[1/5] 메인 반품왕 종합관 배포 중...");
  const mainHtml = renderHighValueBanpumMagazineHtml(
    "[반품왕] 100~300만원대 초고액 반품-미개봉/최상급 전자기기 & 가전 BEST 8",
    "새상품 정가 대비 최대 160만 원 이상 저렴하게 풀린 맥북 프로, 갤럭시북4, LG 77인치 OLED TV, 비스포크 AI 콤보 세탁건조기 실시간 반품 특가 모음입니다.",
    banpumKing8Deals
  );
  await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/5479330542488219707`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "blogger#post",
      title: "[반품왕] 100~300만원대 초고액 반품-미개봉/최상급 전자기기 BEST 8",
      content: mainHtml,
      labels: ["반품왕", "쿠팡반품", "고액반품", "맥북프로", "갤럭시북4", "올레드TV", "가전특가"]
    })
  });
  console.log("  -> ✅ 메인 반품왕 종합관 배포 완료!");
  await sleep(1000);

  // 2. 포스트 2: 애플/맥북 반품관 (7685606082388474435)
  console.log("[2/5] 애플/맥북 전용 반품관 배포 중...");
  const appleDeals = [banpumKing8Deals[1], banpumKing8Deals[7]]; // 맥북 프로, 소니 카메라
  const appleHtml = renderHighValueBanpumMagazineHtml(
    "[반품왕] Apple 2024 맥북 프로 16 M3 & 초고가 장비 반품특가 (최대 80만원 절약)",
    "애플 맥북 프로 16인치 M3 Pro 스페이스 블랙 및 전문가용 장비 반품-최상급 실시간 재고 큐레이션입니다.",
    appleDeals
  );
  await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/7685606082388474435`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "blogger#post",
      title: "[반품왕] Apple 맥북 프로 16 M3 Pro 반품특가 (새상품 대비 80만원 절약)",
      content: appleHtml,
      labels: ["반품왕", "맥북프로", "애플반품", "M3Pro", "노트북특가"]
    })
  });
  console.log("  -> ✅ 애플/맥북 반품관 배포 완료!");
  await sleep(1000);

  // 3. 포스트 3: 노트북/게이밍PC 반품관 (5041237301912454229)
  console.log("[3/5] 노트북/게이밍PC 반품관 배포 중...");
  const laptopDeals = [banpumKing8Deals[0], banpumKing8Deals[4]]; // 갤럭시북4 프로, ROG 스트릭스
  const laptopHtml = renderHighValueBanpumMagazineHtml(
    "[반품왕] 삼성 갤럭시북4 프로 16 터치 & ROG RTX 4080 게이밍 반품특가 (최대 80만원 절약)",
    "Intel Core Ultra 7 갤럭시북4 프로 터치 및 RTX 4080 플래그십 게이밍 노트북 반품 실시간 큐레이션입니다.",
    laptopDeals
  );
  await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/5041237301912454229`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "blogger#post",
      title: "[반품왕] 갤럭시북4 프로 16 & ROG RTX 4080 게이밍 반품특가",
      content: laptopHtml,
      labels: ["반품왕", "갤럭시북4", "게이밍노트북", "RTX4080", "노트북반품"]
    })
  });
  console.log("  -> ✅ 노트북/게이밍 반품관 배포 완료!");
  await sleep(1000);

  // 4. 포스트 4: 대형가전/TV/세탁기 반품관 (1802995966645046698)
  console.log("[4/5] 대형가전/TV/세탁기 반품관 배포 중...");
  const homeApplianceDeals = [banpumKing8Deals[2], banpumKing8Deals[3]]; // LG 77인치 OLED, 비스포크 AI 콤보
  const homeApplianceHtml = renderHighValueBanpumMagazineHtml(
    "[반품왕] LG 77인치 4K 올레드 TV & 비스포크 AI 콤보 세탁건조기 반품특가 (최대 161만원 세이브)",
    "77인치 초대형 올레드 TV와 세탁기+건조기 일체형 비스포크 AI 콤보 반품-미개봉/최상급 실시간 큐레이션입니다.",
    homeApplianceDeals
  );
  await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/1802995966645046698`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "blogger#post",
      title: "[반품왕] LG 77인치 OLED TV & 비스포크 AI 콤보 세탁건조기 반품특가",
      content: homeApplianceHtml,
      labels: ["반품왕", "올레드TV", "비스포크AI콤보", "대형가전반품", "세탁건조기"]
    })
  });
  console.log("  -> ✅ 대형가전/TV/세탁기 반품관 배포 완료!");
  await sleep(1000);

  // 5. 포스트 5: 폰/카메라/로봇청소기 반품관 (5958500708687351036)
  console.log("[5/5] 폰/카메라/로봇청소기 반품관 배포 중...");
  const smartDeviceDeals = [banpumKing8Deals[5], banpumKing8Deals[6]]; // 갤럭시 S24 울트라, 로보락 S8 MaxV
  const smartDeviceHtml = renderHighValueBanpumMagazineHtml(
    "[반품왕] 갤럭시 S24 울트라 512GB & 로보락 S8 MaxV Ultra 반품특가 (최대 46만원 절약)",
    "티타늄 512GB 자급제 스마트폰과 현존 끝판왕 10,000Pa 올인원 로봇청소기 반품-미개봉/최상급 실시간 큐레이션입니다.",
    smartDeviceDeals
  );
  await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/5958500708687351036`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "blogger#post",
      title: "[반품왕] 갤럭시 S24 울트라 512GB & 로보락 S8 MaxV 반품특가",
      content: smartDeviceHtml,
      labels: ["반품왕", "갤럭시S24울트라", "로보락", "로봇청소기", "자급제폰"]
    })
  });
  console.log("  -> ✅ 폰/카메라/로봇청소기 반품관 배포 완료!");

  // 검색엔진 색인 즉시 전송
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
          "https://returnpick-deals.blogspot.com/2026/08/40-967.html",
          "https://returnpick-deals.blogspot.com/2026/08/355ml-x-24-535.html"
        ]
      })
    });
    console.log(`\nIndexNow 색인 요청 완료 (${pingRes.status})`);
  } catch (e) {}

  console.log("\n=================================================");
  console.log("🎉 5개 전체 블로그가 [고액 반품 전문관]으로 100% 전면 재편 완료!");
  console.log("=================================================");
}

deployAllHighValueBanpumHalls().catch(console.error);
