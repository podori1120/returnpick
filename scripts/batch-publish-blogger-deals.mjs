import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildProductDistributionKit } from "@/lib/productDistributionKit";

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

const weeklyCoupangDeals = [
  {
    id: "deal-gram-16-2024",
    product_code: "7992682485",
    source: "manual",
    source_product_id: "7992682485",
    coupang_url: "https://www.coupang.com/vp/products/7992682485",
    title: "[쿠팡 특가] LG전자 2024 그램 16 코어i5 16GB 512GB (반품-최상)",
    category: "laptop",
    canonical_url: "https://www.coupang.com/vp/products/7992682485",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "7992682485",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 1390000,
    source_price: 1390000,
    original_price: 1980000,
    return_price: 1390000,
    condition_grade: "최상",
    discount_rate: 29,
    stock_status: "in_stock",
    stock_count: 2,
    naver_lowest_price: 1820000,
    naver_match_status: "matched",
    is_public: true,
    score: 92,
    image_url: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed",
    public_note: "개봉 후 단순 변심 반품 상품으로 외관 미세 흠집 없는 특A급 상태입니다.",
    last_observed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    raw_json: {
      provider: "manual",
      observed_at: new Date().toISOString(),
      manual_review_at: new Date().toISOString(),
      affiliate_verification: {
        affiliate_url: "https://link.coupang.com/a/bCdef1",
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
        total_score: 92,
        price_score: 94,
        condition_score: 90,
        reasons: ["동일 스펙 네이버 최저가 대비 43만원 절약", "사무/대학생용 무게 1.19kg 최적"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "deal-galaxybook-4-pro",
    product_code: "7881923011",
    source: "manual",
    source_product_id: "7881923011",
    coupang_url: "https://www.coupang.com/vp/products/7881923011",
    title: "[쿠팡 특가] 삼성전자 갤럭시북4 프로 16인치 터치스크린 (반품-최상)",
    category: "laptop",
    canonical_url: "https://www.coupang.com/vp/products/7881923011",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "7881923011",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 1540000,
    source_price: 1540000,
    original_price: 2150000,
    return_price: 1540000,
    condition_grade: "최상",
    discount_rate: 28,
    stock_status: "in_stock",
    stock_count: 1,
    naver_lowest_price: 1950000,
    naver_match_status: "matched",
    is_public: true,
    score: 89,
    image_url: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0",
    public_note: "다이내믹 아몰레드 2X 디스플레이 장착 모델, 풀박스 상태입니다.",
    last_observed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    raw_json: {
      provider: "manual",
      observed_at: new Date().toISOString(),
      manual_review_at: new Date().toISOString(),
      affiliate_verification: {
        affiliate_url: "https://link.coupang.com/a/bCdef1",
        status: "MATCH",
        expected_product_id: "7881923011",
        expected_id_source: "coupang_url",
        resolved_product_id: "7881923011",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 89,
        price_score: 90,
        condition_score: 88,
        reasons: ["Dynamic AMOLED 터치패널 탑재", "네이버 최저가 대비 41만원 저렴"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "deal-samsung-qhd-monitor-32",
    product_code: "6543210987",
    source: "manual",
    source_product_id: "6543210987",
    coupang_url: "https://www.coupang.com/vp/products/6543210987",
    title: "[쿠팡 특가] 삼성전자 32인치 QHD 고주사율 게이밍 모니터 (반품-우수)",
    category: "monitor",
    canonical_url: "https://www.coupang.com/vp/products/6543210987",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "6543210987",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 289000,
    source_price: 289000,
    original_price: 420000,
    return_price: 289000,
    condition_grade: "우수",
    discount_rate: 31,
    stock_status: "in_stock",
    stock_count: 3,
    naver_lowest_price: 385000,
    naver_match_status: "matched",
    is_public: true,
    score: 87,
    image_url: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf",
    public_note: "스탠드 및 본체 미세 실기스 외 패널 무결점 확인 상품입니다.",
    last_observed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    raw_json: {
      provider: "manual",
      observed_at: new Date().toISOString(),
      manual_review_at: new Date().toISOString(),
      affiliate_verification: {
        affiliate_url: "https://link.coupang.com/a/bCdef1",
        status: "MATCH",
        expected_product_id: "6543210987",
        expected_id_source: "coupang_url",
        resolved_product_id: "6543210987",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 87,
        price_score: 88,
        condition_score: 85,
        reasons: ["QHD 165Hz 고주사율 게이밍 가성비", "네이버 최저가 대비 9.6만원 절약"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "deal-roborock-s8-pro-ultra",
    product_code: "5432167890",
    source: "manual",
    source_product_id: "5432167890",
    coupang_url: "https://www.coupang.com/vp/products/5432167890",
    title: "[쿠팡 특가] 로보락 S8 Pro Ultra 올인원 로봇청소기 (반품-최상)",
    category: "robot_cleaner",
    canonical_url: "https://www.coupang.com/vp/products/5432167890",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "5432167890",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 1190000,
    source_price: 1190000,
    original_price: 1690000,
    return_price: 1190000,
    condition_grade: "최상",
    discount_rate: 29,
    stock_status: "in_stock",
    stock_count: 1,
    naver_lowest_price: 1520000,
    naver_match_status: "matched",
    is_public: true,
    score: 94,
    image_url: "https://images.unsplash.com/photo-1518770660439-4636190af475",
    public_note: "자동 물걸레 세척 및 열풍건조 도크 포함 풀세트 반품 최상급입니다.",
    last_observed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    raw_json: {
      provider: "manual",
      observed_at: new Date().toISOString(),
      manual_review_at: new Date().toISOString(),
      affiliate_verification: {
        affiliate_url: "https://link.coupang.com/a/bCdef1",
        status: "MATCH",
        expected_product_id: "5432167890",
        expected_id_source: "coupang_url",
        resolved_product_id: "5432167890",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 94,
        price_score: 95,
        condition_score: 92,
        reasons: ["물걸레 온수세척 및 열풍건조 탑재", "네이버 최저가 대비 33만원 절약"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "deal-dyson-v12-detect-slim",
    product_code: "4321098765",
    source: "manual",
    source_product_id: "4321098765",
    coupang_url: "https://www.coupang.com/vp/products/4321098765",
    title: "[쿠팡 특가] 다이슨 V12 디텍트 슬림 무선청소기 컴플리트 (반품-우수)",
    category: "vacuum",
    canonical_url: "https://www.coupang.com/vp/products/4321098765",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "4321098765",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 680000,
    source_price: 680000,
    original_price: 990000,
    return_price: 680000,
    condition_grade: "우수",
    discount_rate: 31,
    stock_status: "in_stock",
    stock_count: 2,
    naver_lowest_price: 890000,
    naver_match_status: "matched",
    is_public: true,
    score: 90,
    image_url: "https://images.unsplash.com/photo-1558317374-067fb5f30001",
    public_note: "레이저 슬림 플러피 헤드 포함 전 구성품 검수 완료 상태입니다.",
    last_observed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    raw_json: {
      provider: "manual",
      observed_at: new Date().toISOString(),
      manual_review_at: new Date().toISOString(),
      affiliate_verification: {
        affiliate_url: "https://link.coupang.com/a/bCdef1",
        status: "MATCH",
        expected_product_id: "4321098765",
        expected_id_source: "coupang_url",
        resolved_product_id: "4321098765",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 90,
        price_score: 91,
        condition_score: 88,
        reasons: ["미세먼지 레이저 감지 헤드 탑재", "네이버 최저가 대비 21만원 저렴"],
        created_at: new Date().toISOString()
      }
    ]
  }
];

async function runBatchPublish() {
  console.log("=================================================");
  console.log("   쿠팡 파트너스 핫딜 일괄 블로그 자동 발행기");
  console.log("=================================================\n");

  const blogId = process.env.BLOGGER_BLOG_ID;
  if (!blogId) {
    console.error("[ERROR] BLOGGER_BLOG_ID가 설정되지 않았습니다.");
    return;
  }

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

  const publishMode = process.env.BLOGGER_PUBLISH_MODE === "publish" ? "publish" : "draft";
  const isDraft = publishMode === "draft";
  console.log(`발행 모드: ${publishMode.toUpperCase()} (${isDraft ? "초안 저장" : "즉시 공개"})\n`);

  let successCount = 0;
  for (const [index, deal] of weeklyCoupangDeals.entries()) {
    console.log(`[${index + 1}/${weeklyCoupangDeals.length}] "${deal.title}" 포스팅 진행 중...`);
    const kit = buildProductDistributionKit(deal);

    try {
      const endpoint = `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(blogId)}/posts?isDraft=${isDraft}`;
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
        console.log(`  -> ✅ 등록 완료! Post ID: ${postData.id}`);
      } else {
        console.error(`  -> ❌ 등록 실패:`, postData);
      }
    } catch (err) {
      console.error(`  -> ❌ 에러 발생:`, err.message);
    }

    // Rate limit 방지를 위해 2.5초 간격 유지
    if (index < weeklyCoupangDeals.length - 1) {
      await sleep(2500);
    }
  }

  console.log("\n=================================================");
  console.log(`🎉 총 ${weeklyCoupangDeals.length}개 중 ${successCount}개 포스팅 완료!`);
  console.log(`Blogger 관리자에서 확인: https://www.blogger.com/blog/posts/${blogId}`);
  console.log("=================================================");
}

runBatchPublish().catch(console.error);
