import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const BLOG_URL = "https://returnpick-deals.blogspot.com";
const SITEMAP_URL = `${BLOG_URL}/sitemap.xml`;
const RSS_URL = `${BLOG_URL}/feeds/posts/default?alt=rss`;

const POST_URLS = [
  "https://returnpick-deals.blogspot.com/2026/08/18.html",
  "https://returnpick-deals.blogspot.com/2026/08/355ml-x-24-535.html",
  "https://returnpick-deals.blogspot.com/2026/08/40-967.html",
  "https://returnpick-deals.blogspot.com/2026/08/17900.html",
  "https://returnpick-deals.blogspot.com/2026/08/490ml-x-24-991.html"
];

async function submitSearchEngineIndexing() {
  console.log("=================================================");
  console.log("   검색엔진(Google, Bing, IndexNow) 자동 색인 및 홍보 제출");
  console.log("=================================================\n");

  // 1. Google Sitemap Ping
  console.log("[1] Google 검색로봇에 사이트맵 색인 요청 중...");
  try {
    const googlePingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;
    const googleRes = await fetch(googlePingUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
      }
    });
    console.log(`  -> Google Ping 응답 상태: ${googleRes.status} (${googleRes.statusText || "OK"})`);
  } catch (e) {
    console.log(`  -> Google Ping 시도: ${e.message}`);
  }

  // 2. Bing & Yahoo & IndexNow 색인 제출
  console.log("\n[2] Bing & IndexNow 검색엔진에 5개 공개 URL 직접 제출 중...");
  try {
    const bingPingUrl = `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;
    const bingRes = await fetch(bingPingUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
      }
    });
    console.log(`  -> Bing Sitemap Ping 응답: ${bingRes.status}`);
  } catch (e) {
    console.log(`  -> Bing Ping 시도: ${e.message}`);
  }

  // 3. IndexNow API를 통한 즉시 크롤링 요청
  try {
    const indexNowRes = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        host: "returnpick-deals.blogspot.com",
        key: "8008329337373147131",
        keyLocation: `https://returnpick-deals.blogspot.com/8008329337373147131.txt`,
        urlList: POST_URLS
      })
    });
    console.log(`  -> IndexNow API 응답 상태: ${indexNowRes.status}`);
  } catch (e) {
    console.log(`  -> IndexNow 제출 시도: ${e.message}`);
  }

  // 4. RSS Feed 접근성 확인
  console.log("\n[3] 공개 RSS 피드 유효성 확인 중...");
  try {
    const rssRes = await fetch(RSS_URL);
    console.log(`  -> RSS Feed 상태: ${rssRes.status} (공개 구독 및 검색로봇 수집 준비 완료)`);
  } catch (e) {
    console.log(`  -> RSS 확인: ${e.message}`);
  }

  console.log("\n=================================================");
  console.log("🎉 검색엔진 색인 및 크롤링 핑 제출 완료!");
  console.log("구글/빙/야후 검색엔진에 새 글 목록이 전송되었습니다.");
  console.log("=================================================");
}

submitSearchEngineIndexing().catch(console.error);
