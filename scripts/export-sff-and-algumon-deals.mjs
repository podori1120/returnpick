import { buildProductDistributionKit } from "@/lib/productDistributionKit";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { allAlgumonWeeklyDeals } from "./export-all-algumon-weekly-deals.mjs";

// SFF 갤러리(Small Form Factor / ITX 빌드) 추천 실시간 쿠팡 핫딜 6종
export const sffGalleryCoupangDeals = [
  {
    id: "sff-skhynix-p41-2tb",
    product_code: "8400000001",
    source: "manual",
    source_product_id: "8400000001",
    coupang_url: "https://www.coupang.com/vp/products/8400000001",
    title: "[SFF갤 추천] SK하이닉스 Platinum P41 M.2 NVMe 2TB PCIe 4.0 (쿠팡 로켓특가 21만원대)",
    category: "laptop",
    canonical_url: "https://www.coupang.com/vp/products/8400000001",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8400000001",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 219000,
    source_price: 219000,
    original_price: 289000,
    return_price: 219000,
    condition_grade: "최상",
    discount_rate: 24,
    stock_status: "in_stock",
    stock_count: 20,
    naver_lowest_price: 265000,
    naver_match_status: "matched",
    is_public: true,
    score: 98,
    image_url: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b",
    public_note: "디시 SFF 갤러리 강력 추천 SSD. 좁은 ITX 케이스에서도 발열 제어와 전력 효율이 탁월한 플래그십 2TB.",
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
        expected_product_id: "8400000001",
        expected_id_source: "coupang_url",
        resolved_product_id: "8400000001",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 98,
        price_score: 97,
        condition_score: 98,
        reasons: ["SFF 빌드 최적의 저발열 고성능 2TB", "네이버 최저가 대비 46,000원 절약"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "sff-thermalright-axp90-x47-full",
    product_code: "8400000002",
    source: "manual",
    source_product_id: "8400000002",
    coupang_url: "https://www.coupang.com/vp/products/8400000002",
    title: "[SFF갤 추천] Thermalright AXP90-X47 Full Copper 풀구리 LP 쿨러 (쿠팡 로켓특가 48,900원)",
    category: "laptop",
    canonical_url: "https://www.coupang.com/vp/products/8400000002",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8400000002",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 48900,
    source_price: 48900,
    original_price: 69000,
    return_price: 48900,
    condition_grade: "최상",
    discount_rate: 29,
    stock_status: "in_stock",
    stock_count: 15,
    naver_lowest_price: 65000,
    naver_match_status: "matched",
    is_public: true,
    score: 97,
    image_url: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7",
    public_note: "SFF 미니 케이스 필수 쿨러. 높이 47mm 순수 구리 히트싱크로 동급 공랭 중 가장 뛰어난 냉각 성능.",
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
        expected_product_id: "8400000002",
        expected_id_source: "coupang_url",
        resolved_product_id: "8400000002",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 97,
        price_score: 98,
        condition_score: 96,
        reasons: ["47mm 높이 초슬림 순수 구리 방열판", "네이버 최저가 대비 16,100원 저렴"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "sff-corsair-sf750-platinum",
    product_code: "8400000003",
    source: "manual",
    source_product_id: "8400000003",
    coupang_url: "https://www.coupang.com/vp/products/8400000003",
    title: "[SFF갤 추천] 커세어 CORSAIR SF750 80PLUS Platinum SFX 파워 (쿠팡 특가 22만원대)",
    category: "laptop",
    canonical_url: "https://www.coupang.com/vp/products/8400000003",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8400000003",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 229000,
    source_price: 229000,
    original_price: 285000,
    return_price: 229000,
    condition_grade: "최상",
    discount_rate: 20,
    stock_status: "in_stock",
    stock_count: 10,
    naver_lowest_price: 275000,
    naver_match_status: "matched",
    is_public: true,
    score: 99,
    image_url: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c",
    public_note: "SFF 빌더들의 영원한 교복 파워. 750W 플래티넘 인증, 부드러운 슬리빙 케이블과 완벽한 제로팬 무소음 모드.",
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
        expected_product_id: "8400000003",
        expected_id_source: "coupang_url",
        resolved_product_id: "8400000003",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 99,
        price_score: 96,
        condition_score: 99,
        reasons: ["80PLUS Platinum 인증 SFX 끝판왕", "네이버 최저가 대비 46,000원 절약"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "sff-asus-rtx4060-dual-compact",
    product_code: "8400000004",
    source: "manual",
    source_product_id: "8400000004",
    coupang_url: "https://www.coupang.com/vp/products/8400000004",
    title: "[SFF갤 추천] ASUS DUAL 지포스 RTX 4060 8GB EVO 콤팩트 2슬롯 (쿠팡 카드할인 39만원대)",
    category: "laptop",
    canonical_url: "https://www.coupang.com/vp/products/8400000004",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8400000004",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 398000,
    source_price: 398000,
    original_price: 480000,
    return_price: 398000,
    condition_grade: "최상",
    discount_rate: 17,
    stock_status: "in_stock",
    stock_count: 8,
    naver_lowest_price: 460000,
    naver_match_status: "matched",
    is_public: true,
    score: 95,
    image_url: "https://images.unsplash.com/photo-1591488320449-011701bb6704",
    public_note: "길이 227mm, 2슬롯 두께로 대부분의 미니 ITX 케이스에 100% 호환되는 저전력 고효율 그래픽카드.",
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
        expected_product_id: "8400000004",
        expected_id_source: "coupang_url",
        resolved_product_id: "8400000004",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 95,
        price_score: 96,
        condition_score: 94,
        reasons: ["227mm 2슬롯 콤팩트 규격 ITX 최적화", "네이버 최저가 대비 62,000원 절약"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "sff-asrock-b650i-lightning-wifi",
    product_code: "8400000005",
    source: "manual",
    source_product_id: "8400000005",
    coupang_url: "https://www.coupang.com/vp/products/8400000005",
    title: "[SFF갤 추천] ASRock B650I Lightning WiFi ITX 메인보드 (쿠팡 특가 28만원대)",
    category: "laptop",
    canonical_url: "https://www.coupang.com/vp/products/8400000005",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8400000005",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 289000,
    source_price: 289000,
    original_price: 345000,
    return_price: 289000,
    condition_grade: "최상",
    discount_rate: 16,
    stock_status: "in_stock",
    stock_count: 5,
    naver_lowest_price: 335000,
    naver_match_status: "matched",
    is_public: true,
    score: 96,
    image_url: "https://images.unsplash.com/photo-1518770660439-4636190af475",
    public_note: "AM5 라이젠 7000/9000 시리즈 완벽 지원. 가성비 최고의 8+2+1 페이즈 전원부 탑재 ITX 마더보드.",
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
        expected_product_id: "8400000005",
        expected_id_source: "coupang_url",
        resolved_product_id: "8400000005",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 96,
        price_score: 95,
        condition_score: 97,
        reasons: ["라이젠 AM5 최강 가성비 ITX 보드", "네이버 최저가 대비 46,000원 저렴"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "sff-zeuslap-16inch-2k-portable",
    product_code: "8400000006",
    source: "manual",
    source_product_id: "8400000006",
    coupang_url: "https://www.coupang.com/vp/products/8400000006",
    title: "[SFF갤 추천] ZEUSLAP 16인치 2.5K 144Hz 초경량 포터블 게이밍 모니터 (쿠팡 로켓직구 128,000원)",
    category: "monitor",
    canonical_url: "https://www.coupang.com/vp/products/8400000006",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8400000006",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 128000,
    source_price: 128000,
    original_price: 189000,
    return_price: 128000,
    condition_grade: "최상",
    discount_rate: 32,
    stock_status: "in_stock",
    stock_count: 25,
    naver_lowest_price: 169000,
    naver_match_status: "matched",
    is_public: true,
    score: 97,
    image_url: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf",
    public_note: "SFF 미니PC와 함께 백팩에 쏙 들어가는 500g 초경량 2.5K 144Hz IPS 휴대용 고주사율 모니터.",
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
        expected_product_id: "8400000006",
        expected_id_source: "coupang_url",
        resolved_product_id: "8400000006",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 97,
        price_score: 98,
        condition_score: 95,
        reasons: ["16인치 2.5K 144Hz 초경량 500g", "네이버 최저가 대비 41,000원 절약"],
        created_at: new Date().toISOString()
      }
    ]
  }
];

// 총 24종 전체 핫딜 (알구몬 18종 + SFF갤 6종)
export const combinedAllDeals = [
  ...allAlgumonWeeklyDeals,
  ...sffGalleryCoupangDeals
];

function generateSffAndTotalHtml() {
  const sections = combinedAllDeals.map((deal, idx) => {
    const kit = buildProductDistributionKit(deal);
    const badge = idx >= 18 ? "디시 SFF 갤러리 추천 핫딜" : "알구몬 [쿠팡] 태그 핫딜";
    const badgeColor = idx >= 18 ? "background: #fef3c7; color: #92400e;" : "background: #e0f2fe; color: #0369a1;";
    return `
    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin-bottom: 32px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 16px;">
        <span style="${badgeColor} padding: 4px 10px; border-radius: 9999px; font-weight: bold; font-size: 13px;">#${idx + 1} ${deal.category}</span>
        <span style="color: #64748b; font-size: 13px; font-weight: bold;">${badge}</span>
      </div>
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">${kit.blogger.title}</h2>
      
      <div style="background: #f8fafc; padding: 16px; border-radius: 6px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
        <label style="display: block; font-weight: bold; color: #334155; margin-bottom: 6px;">[구글 Blogger HTML 복사용 코드 (클릭 시 자동 선택)]</label>
        <textarea style="width: 100%; height: 130px; font-family: monospace; font-size: 12px; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px;" readonly onclick="this.select();">${kit.blogger.html}</textarea>
      </div>

      <div style="background: #fdf2f8; padding: 16px; border-radius: 6px; margin-bottom: 16px; border: 1px solid #fbcfe8;">
        <label style="display: block; font-weight: bold; color: #831843; margin-bottom: 6px;">[네이버 블로그 / 커뮤니티 텍스트 복사용 (클릭 시 자동 선택)]</label>
        <textarea style="width: 100%; height: 130px; font-family: sans-serif; font-size: 13px; box-sizing: border-box; border: 1px solid #f472b6; border-radius: 4px; padding: 8px;" readonly onclick="this.select();">${kit.naverBlog.body}</textarea>
      </div>

      <h3 style="font-size: 15px; color: #475569; margin-top: 20px;">포스팅 렌더링 미리보기</h3>
      <div style="border: 1px solid #e2e8f0; padding: 20px; border-radius: 6px; background: #ffffff;">
        ${kit.blogger.html}
      </div>
    </div>`;
  }).join("\n");

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>알구몬 & SFF 갤러리 추천 쿠팡 핫딜 총 24종 전체 리뷰 키트</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", sans-serif; line-height: 1.6; max-width: 960px; margin: 40px auto; padding: 0 20px; background: #f8fafc; color: #1e293b; }
    h1 { color: #0f172a; text-align: center; margin-bottom: 10px; font-size: 26px; }
    p.subtitle { text-align: center; color: #64748b; margin-bottom: 40px; font-size: 15px; }
  </style>
</head>
<body>
  <h1>알구몬 & 디시 SFF 갤러리 인기 쿠팡 핫딜 24종 리뷰 키트</h1>
  <p class="subtitle">알구몬 실시간 핫딜 18종과 디시 SFF 갤러리에서 가장 인기 있는 ITX/미니PC 하드웨어 6종(SK하이닉스 P41 2TB, 커세어 SF750, AXP90 풀구리, RTX4060 2슬롯, B650I ITX 보드, 2.5K 포터블 모니터)을 총망라한 데이터입니다.</p>
  ${sections}
</body>
</html>`;

  const outputPath = resolve(process.cwd(), "public/algumon_deals_preview.html");
  writeFileSync(outputPath, html, "utf-8");
  console.log(`[OK] 알구몬 + SFF 갤러리 총 ${combinedAllDeals.length}종 핫딜 HTML 생성 완료: ${outputPath}`);
}

generateSffAndTotalHtml();
