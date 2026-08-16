import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildProductDistributionKit } from "@/lib/productDistributionKit";

// 환경변수 수동 로드
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

async function testPostToBlogger() {
  console.log("=== 1. Blogger 연동 테스트 시작 ===");
  console.log(`- Blog ID: ${process.env.BLOGGER_BLOG_ID}`);
  console.log(`- Blog URL: ${process.env.BLOGGER_BLOG_URL}`);

  // Access Token 교환
  console.log("\nAccess Token 발급 중...");
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
  console.log("[OK] Access Token 획득 성공!");

  // 테스트용 상품 키트 생성
  const sampleAffiliateUrl = "https://link.coupang.com/a/bCdef1";
  const sampleProduct = {
    id: "prod-returnpick-live-01",
    product_code: "7992682485",
    source: "manual",
    source_product_id: "7992682485",
    coupang_url: "https://www.coupang.com/vp/products/7992682485",
    title: "[쿠팡] LG 그램 16인치 2024년형 반품 최상급 실구매 요약",
    category: "laptop",
    canonical_url: "https://www.coupang.com/vp/products/7992682485",
    affiliate_url: sampleAffiliateUrl,
    affiliate_product_id: "7992682485",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 1250000,
    source_price: 1250000,
    original_price: 1890000,
    return_price: 1250000,
    condition_grade: "최상",
    discount_rate: 34,
    stock_status: "in_stock",
    stock_count: 2,
    naver_lowest_price: 1750000,
    naver_match_status: "matched",
    coupang_item_id: "998877",
    coupang_vendor_item_id: "887766",
    is_public: true,
    score: 88,
    image_url: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed",
    public_note: "외관 스크래치 전혀 없는 최상급 반품 상품입니다.",
    last_observed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    raw_json: {
      provider: "manual",
      observed_at: new Date().toISOString(),
      manual_review_at: new Date().toISOString(),
      affiliate_verification: {
        affiliate_url: sampleAffiliateUrl,
        status: "MATCH",
        expected_product_id: "7992682485",
        expected_id_source: "coupang_url",
        resolved_product_id: "7992682485",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 88,
        price_score: 90,
        condition_score: 85,
        reasons: ["동일 모델 네이버 최저가 대비 50만원 저렴", "반품 최상급 상태로 외관 미세 흠집 수준"],
        created_at: new Date().toISOString()
      }
    ]
  };

  const kit = buildProductDistributionKit(sampleProduct);
  console.log("\n생성된 포스팅 제목:", kit.blogger.title);

  // Blogger API로 포스트 등록 (초안 모드)
  console.log("\nBlogger API로 글 전송 중 (초안 모드)...");
  const postRes = await fetch(
    `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(process.env.BLOGGER_BLOG_ID)}/posts?isDraft=true`,
    {
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
    }
  );

  const postData = await postRes.json();
  if (postData.id) {
    console.log("\n🎉 [성공] Blogger에 글이 성공적으로 등록되었습니다!");
    console.log(`- Post ID: ${postData.id}`);
    console.log(`- Post URL: ${postData.url || "초안 상태(Blogger 관리자에서 확인 가능)"}`);
    console.log(`- 블로그 관리자 확인: https://www.blogger.com/blog/posts/${process.env.BLOGGER_BLOG_ID}`);
  } else {
    console.error("\n[오류] Blogger 글 등록 실패:", postData);
  }
}

testPostToBlogger().catch(console.error);
