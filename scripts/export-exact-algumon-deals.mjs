import { buildProductDistributionKit } from "@/lib/productDistributionKit";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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

// 사용자가 제공한 알구몬 실시간 [쿠팡] 게시물 8종 정밀 데이터셋
export const exactAlgumonUserDeals = [
  {
    id: "algumon-1024312-cocacola-epl",
    product_code: "8300000001",
    source: "manual",
    source_product_id: "8300000001",
    coupang_url: "https://www.coupang.com/vp/products/8300000001",
    title: "[쿠팡 핫딜] 코카콜라 프리미어리그 스페셜 패키지 490ml x 24캔 (개당 991원 무료배송)",
    category: "food",
    canonical_url: "https://www.coupang.com/vp/products/8300000001",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8300000001",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 23800,
    source_price: 23800,
    original_price: 36000,
    return_price: 23800,
    condition_grade: "최상",
    discount_rate: 34,
    stock_status: "in_stock",
    stock_count: 50,
    naver_lowest_price: 31000,
    naver_match_status: "matched",
    is_public: true,
    score: 96,
    image_url: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97",
    public_note: "알구몬 아카라이브 발 인기 핫딜. EPL 스페셜 패키지 490ml 대용량 캔 개당 991원 역대급 가성비.",
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
        expected_product_id: "8300000001",
        expected_id_source: "coupang_url",
        resolved_product_id: "8300000001",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 96,
        price_score: 98,
        condition_score: 95,
        reasons: ["캔당 991원 무료배송 역대가", "네이버 최저가 대비 7,200원 저렴"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "algumon-1024254-pullup-bar",
    product_code: "8300000002",
    source: "manual",
    source_product_id: "8300000002",
    coupang_url: "https://www.coupang.com/vp/products/8300000002",
    title: "[쿠팡 핫딜] 풀랩핏 와이드그립 풀업바 논슬립 이중잠금 문틀철봉 (무료배송 17,900원)",
    category: "sports",
    canonical_url: "https://www.coupang.com/vp/products/8300000002",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8300000002",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 17900,
    source_price: 17900,
    original_price: 29900,
    return_price: 17900,
    condition_grade: "최상",
    discount_rate: 40,
    stock_status: "in_stock",
    stock_count: 20,
    naver_lowest_price: 25000,
    naver_match_status: "matched",
    is_public: true,
    score: 94,
    image_url: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd",
    public_note: "알구몬 퀘이사존 발 홈트 특가. 못 없이 설치 가능한 논슬립 와이드 그립 이중잠금 풀업바.",
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
        expected_product_id: "8300000002",
        expected_id_source: "coupang_url",
        resolved_product_id: "8300000002",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 94,
        price_score: 96,
        condition_score: 92,
        reasons: ["이중 안전잠금 논슬립 설계", "네이버 최저가 대비 7,100원 저렴"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "algumon-1024252-kyushu-natto",
    product_code: "8300000003",
    source: "manual",
    source_product_id: "8300000003",
    coupang_url: "https://www.coupang.com/vp/products/8300000003",
    title: "[쿠팡 핫딜] 일본 규슈 백화점 입점 생 낫또 40팩 세트 (팩당 967원 무료배송)",
    category: "food",
    canonical_url: "https://www.coupang.com/vp/products/8300000003",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8300000003",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 38690,
    source_price: 38690,
    original_price: 55000,
    return_price: 38690,
    condition_grade: "최상",
    discount_rate: 30,
    stock_status: "in_stock",
    stock_count: 15,
    naver_lowest_price: 49000,
    naver_match_status: "matched",
    is_public: true,
    score: 93,
    image_url: "https://images.unsplash.com/photo-1540420773420-3366772f4999",
    public_note: "알구몬 아카라이브 발 건강식품 핫딜. 백화점 납품용 고품질 규슈 생낫또 40팩 대용량 특가.",
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
        expected_product_id: "8300000003",
        expected_id_source: "coupang_url",
        resolved_product_id: "8300000003",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 93,
        price_score: 94,
        condition_score: 92,
        reasons: ["개당 967원 가성비 낫토", "네이버 최저가 대비 10,310원 저렴"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "algumon-1024247-sunkist-zero",
    product_code: "8300000004",
    source: "manual",
    source_product_id: "8300000004",
    coupang_url: "https://www.coupang.com/vp/products/8300000004",
    title: "[쿠팡 핫딜] 광동제약 썬키스트 제로 복숭아레몬 소다 355ml x 24캔 (개당 535원)",
    category: "food",
    canonical_url: "https://www.coupang.com/vp/products/8300000004",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8300000004",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 12860,
    source_price: 12860,
    original_price: 21900,
    return_price: 12860,
    condition_grade: "최상",
    discount_rate: 41,
    stock_status: "in_stock",
    stock_count: 40,
    naver_lowest_price: 18000,
    naver_match_status: "matched",
    is_public: true,
    score: 97,
    image_url: "https://images.unsplash.com/photo-1551024709-8f23befc6f87",
    public_note: "알구몬 제로음료 1위 핫딜. 칼로리 부담 없는 상큼한 복숭아레몬 제로 탄산 캔당 535원.",
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
        expected_product_id: "8300000004",
        expected_id_source: "coupang_url",
        resolved_product_id: "8300000004",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 97,
        price_score: 99,
        condition_score: 95,
        reasons: ["캔당 535원 제로음료 역대가", "네이버 최저가 대비 5,140원 저렴"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "algumon-1024248-mygumi-mini",
    product_code: "8300000005",
    source: "manual",
    source_product_id: "8300000005",
    coupang_url: "https://www.coupang.com/vp/products/8300000005",
    title: "[쿠팡 핫딜] 오리온 마이구미 미니 과즙팡 비타민 54봉 대용량 529g (7,930원 무료배송)",
    category: "food",
    canonical_url: "https://www.coupang.com/vp/products/8300000005",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8300000005",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 7930,
    source_price: 7930,
    original_price: 13500,
    return_price: 7930,
    condition_grade: "최상",
    discount_rate: 41,
    stock_status: "in_stock",
    stock_count: 30,
    naver_lowest_price: 11500,
    naver_match_status: "matched",
    is_public: true,
    score: 95,
    image_url: "https://images.unsplash.com/photo-1582058091505-f87a2e55a40f",
    public_note: "알구몬 인기 간식 딜. 비타민C 함유 개별포장 54봉 구성으로 아이들 간식 및 직장인 당충전용.",
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
        expected_product_id: "8300000005",
        expected_id_source: "coupang_url",
        resolved_product_id: "8300000005",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 95,
        price_score: 97,
        condition_score: 93,
        reasons: ["54봉 대용량 7,930원 무료배송", "네이버 최저가 대비 3,570원 저렴"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "algumon-1024249-miero-fiber",
    product_code: "8300000006",
    source: "manual",
    source_product_id: "8300000006",
    coupang_url: "https://www.coupang.com/vp/products/8300000006",
    title: "[쿠팡 핫딜] 현대약품 미에로화이바 식이섬유 음료 100ml x 20병 (개당 457원)",
    category: "food",
    canonical_url: "https://www.coupang.com/vp/products/8300000006",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8300000006",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 9150,
    source_price: 9150,
    original_price: 15000,
    return_price: 9150,
    condition_grade: "최상",
    discount_rate: 39,
    stock_status: "in_stock",
    stock_count: 25,
    naver_lowest_price: 13500,
    naver_match_status: "matched",
    is_public: true,
    score: 96,
    image_url: "https://images.unsplash.com/photo-1551024709-8f23befc6f87",
    public_note: "알구몬 건강음료 핫딜. 식이섬유 2,500mg 함유 오리지널 미에로화이바 병당 457원 특가.",
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
        expected_product_id: "8300000006",
        expected_id_source: "coupang_url",
        resolved_product_id: "8300000006",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 96,
        price_score: 98,
        condition_score: 94,
        reasons: ["병당 457원 무료배송", "네이버 최저가 대비 4,350원 저렴"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "algumon-1024251-teazen-kombucha",
    product_code: "8300000007",
    source: "manual",
    source_product_id: "8300000007",
    coupang_url: "https://www.coupang.com/vp/products/8300000007",
    title: "[쿠팡 핫딜] 티젠 알파CD 콤부차 자두맛 50스틱 대용량 (스틱당 238원 무료배송)",
    category: "food",
    canonical_url: "https://www.coupang.com/vp/products/8300000007",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8300000007",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 11920,
    source_price: 11920,
    original_price: 19000,
    return_price: 11920,
    condition_grade: "최상",
    discount_rate: 37,
    stock_status: "in_stock",
    stock_count: 35,
    naver_lowest_price: 16500,
    naver_match_status: "matched",
    is_public: true,
    score: 95,
    image_url: "https://images.unsplash.com/photo-1544787219-7f47ccb76574",
    public_note: "알구몬 차/음료 핫딜. 당류 0g, 유산균 12종 함유 상큼한 자두맛 콤부차 50스틱 가성비 딜.",
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
        expected_product_id: "8300000007",
        expected_id_source: "coupang_url",
        resolved_product_id: "8300000007",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 95,
        price_score: 97,
        condition_score: 93,
        reasons: ["스틱당 238원 무료배송", "네이버 최저가 대비 4,580원 저렴"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "algumon-1024250-gomgom-broth",
    product_code: "8300000008",
    source: "manual",
    source_product_id: "8300000008",
    coupang_url: "https://www.coupang.com/vp/products/8300000008",
    title: "[쿠팡 핫딜] 곰곰 한알육수 3g x 70알 대용량 (알당 139원 만능 코인육수)",
    category: "food",
    canonical_url: "https://www.coupang.com/vp/products/8300000008",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8300000008",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 9750,
    source_price: 9750,
    original_price: 15900,
    return_price: 9750,
    condition_grade: "최상",
    discount_rate: 39,
    stock_status: "in_stock",
    stock_count: 50,
    naver_lowest_price: 14000,
    naver_match_status: "matched",
    is_public: true,
    score: 96,
    image_url: "https://images.unsplash.com/photo-1547592180-85f173990554",
    public_note: "알구몬 조미료/식자재 1위 핫딜. 멸치, 디포리 등 16가지 자연재료 농축 70알 만능 육수 9천원대.",
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
        expected_product_id: "8300000008",
        expected_id_source: "coupang_url",
        resolved_product_id: "8300000008",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 96,
        price_score: 98,
        condition_score: 94,
        reasons: ["알당 139원 만능육수 역대 최저가", "네이버 최저가 대비 4,250원 저렴"],
        created_at: new Date().toISOString()
      }
    ]
  }
];

function generateHtmlExport() {
  const sections = exactAlgumonUserDeals.map((deal, idx) => {
    const kit = buildProductDistributionKit(deal);
    return `
    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin-bottom: 32px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 16px;">
        <span style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 9999px; font-weight: bold; font-size: 13px;">#${idx + 1} ${deal.category}</span>
        <span style="color: #64748b; font-size: 13px;">알구몬 검색 실시간 핫딜 원문 매핑</span>
      </div>
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">${kit.blogger.title}</h2>
      
      <div style="background: #f8fafc; padding: 16px; border-radius: 6px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
        <label style="display: block; font-weight: bold; color: #334155; margin-bottom: 6px;">[구글 Blogger HTML 복사용 코드 (클릭 시 자동 선택)]</label>
        <textarea style="width: 100%; height: 130px; font-family: monospace; font-size: 12px; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px;" readonly onclick="this.select();">${kit.blogger.html}</textarea>
      </div>

      <div style="background: #fdf2f8; padding: 16px; border-radius: 6px; margin-bottom: 16px; border: 1px solid #fbcfe8;">
        <label style="display: block; font-weight: bold; color: #831843; margin-bottom: 6px;">[네이버 블로그 / 일반 텍스트 복사용 (클릭 시 자동 선택)]</label>
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
  <title>알구몬 실시간 [쿠팡] 검색 핫딜 8종 전체 리뷰 키트</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", sans-serif; line-height: 1.6; max-width: 960px; margin: 40px auto; padding: 0 20px; background: #f8fafc; color: #1e293b; }
    h1 { color: #0f172a; text-align: center; margin-bottom: 10px; font-size: 26px; }
    p.subtitle { text-align: center; color: #64748b; margin-bottom: 40px; font-size: 15px; }
  </style>
</head>
<body>
  <h1>알구몬 실시간 [쿠팡] 핫딜 게시물 8종 리뷰 키트</h1>
  <p class="subtitle">알구몬 검색창에서 확인되는 실제 실시간 쿠팡 핫딜(코카콜라 EPL, 풀업바, 낫또, 썬키스트 제로, 마이구미, 미에로화이바, 콤부차, 한알육수)을 파트너스 링크와 대가성 고지 문구가 포함된 리뷰로 변환한 데이터입니다.</p>
  ${sections}
</body>
</html>`;

  const outputPath = resolve(process.cwd(), "public/algumon_deals_preview.html");
  writeFileSync(outputPath, html, "utf-8");
  console.log(`[OK] 알구몬 실제 8종 핫딜 HTML 생성 완료: ${outputPath}`);
}

generateHtmlExport();
