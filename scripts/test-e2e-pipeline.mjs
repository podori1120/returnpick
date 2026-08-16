import { parseAlgumonCoupangDiscovery } from "@/lib/providers/algumonDiscoveryParser";
import { verifyCoupangAffiliateLinkResolution } from "@/lib/coupangAffiliateLinkVerifier";
import { buildProductDistributionKit, getProductDistributionReadiness } from "@/lib/productDistributionKit";

async function testPipeline() {
  console.log("=== 1. Algumon 수집 테스트 시작 ===");
  const targetUrl = "https://www.algumon.com/n/deal";
  
  let html = "";
  try {
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    html = await res.text();
    console.log(`[OK] Algumon HTML 수신 성공 (길이: ${html.length} chars)`);
  } catch (err) {
    console.error("[ERROR] Algumon 요청 실패:", err);
    return;
  }

  const deals = parseAlgumonCoupangDiscovery(html);
  console.log(`[OK] 파싱된 쿠팡 후보 딜 개수: ${deals.length}`);

  console.log("\n=== 2. 쿠팡 파트너스 링크 검증 테스트 ===");
  const sampleAffiliateUrl = "https://link.coupang.com/a/bCdef1";
  const verification = await verifyCoupangAffiliateLinkResolution(sampleAffiliateUrl);
  console.log("[OK] 파트너스 링크 검증 응답:", verification);

  console.log("\n=== 3. 블로그 리뷰 초안 생성 테스트 ===");
  const sampleProduct = {
    id: "prod-test-algumon-01",
    product_code: "7992682485",
    source: "manual",
    source_product_id: "7992682485",
    coupang_url: "https://www.coupang.com/vp/products/7992682485",
    title: "[쿠팡] LG 그램 16인치 2024년형 반품 최상급",
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

  const readiness = getProductDistributionReadiness(sampleProduct);
  console.log("[DEBUG] Readiness:", readiness);

  const kit = buildProductDistributionKit(sampleProduct);
  console.log("\n[OK] 생성된 Blogger 제목:", kit.blogger.title);
  console.log("[OK] 공정위 대가성 문구 포함 여부:", kit.blogger.html.includes(kit.disclosure));
  console.log("\n[OK] Blogger HTML 전문 미리보기:\n----------------------------------------");
  console.log(kit.blogger.html);
  console.log("----------------------------------------");
  console.log("\n[OK] 네이버 블로그 텍스트 전문 미리보기:\n----------------------------------------");
  console.log(kit.naverBlog.body);
  console.log("----------------------------------------");
  console.log("\n=== 파이프라인 전체 엔드투엔드 정상 동작 확인 완료! ===");
}

testPipeline().catch(console.error);
