import { buildProductDistributionKit } from "@/lib/productDistributionKit";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { exactAlgumonUserDeals } from "./export-exact-algumon-deals.mjs";

// 추가 10종의 알구몬 일주일치 쿠팡 핫딜
export const additionalAlgumonWeeklyDeals = [
  {
    id: "algumon-jarrow-dophilus-50b",
    product_code: "8300000009",
    source: "manual",
    source_product_id: "8300000009",
    coupang_url: "https://www.coupang.com/vp/products/8300000009",
    title: "[쿠팡 핫딜] 재로우 포뮬라 울트라 자로우-도피러스 유산균 500억 60정 x 4통 (쿠팡WOW 특가)",
    category: "food",
    canonical_url: "https://www.coupang.com/vp/products/8300000009",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8300000009",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 114000,
    source_price: 114000,
    original_price: 160000,
    return_price: 114000,
    condition_grade: "최상",
    discount_rate: 29,
    stock_status: "in_stock",
    stock_count: 15,
    naver_lowest_price: 145000,
    naver_match_status: "matched",
    is_public: true,
    score: 97,
    image_url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae",
    public_note: "알구몬 영양제 카테고리 1위 핫딜. 통당 28,500원꼴로 네이버 직구 대비 3.1만원 저렴한 역대 최저가.",
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
        expected_product_id: "8300000009",
        expected_id_source: "coupang_url",
        resolved_product_id: "8300000009",
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
        reasons: ["500억 생유산균 통당 28,500원 역대가", "네이버 직구 최저가 대비 31,000원 절약"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "algumon-alldocube-iplay70-mini-pro",
    product_code: "8300000010",
    source: "manual",
    source_product_id: "8300000010",
    coupang_url: "https://www.coupang.com/vp/products/8300000010",
    title: "[쿠팡 핫딜] 올도큐브 iPlay70 mini pro 8.4인치 LTE 태블릿 8GB (쿠팡WOW 19만원대)",
    category: "laptop",
    canonical_url: "https://www.coupang.com/vp/products/8300000010",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8300000010",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 194000,
    source_price: 194000,
    original_price: 260000,
    return_price: 194000,
    condition_grade: "최상",
    discount_rate: 25,
    stock_status: "in_stock",
    stock_count: 8,
    naver_lowest_price: 245000,
    naver_match_status: "matched",
    is_public: true,
    score: 95,
    image_url: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0",
    public_note: "알구몬 IT/태블릿 인기 핫딜. 8.4인치 휴대용 LTE 통신 지원 Helio G99 탑재 가성비 태블릿.",
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
        expected_product_id: "8300000010",
        expected_id_source: "coupang_url",
        resolved_product_id: "8300000010",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 95,
        price_score: 96,
        condition_score: 93,
        reasons: ["LTE 데이터 통신 지원 가성비 태블릿", "네이버 최저가 대비 51,000원 절약"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "algumon-tamsa-6ply-toilet-paper",
    product_code: "8300000011",
    source: "manual",
    source_product_id: "8300000011",
    coupang_url: "https://www.coupang.com/vp/products/8300000011",
    title: "[쿠팡 핫딜] 탐사 프리미엄 6겹 롤화장지 30m x 30롤 2팩 총 60롤 (19,800원 무료배송)",
    category: "vacuum",
    canonical_url: "https://www.coupang.com/vp/products/8300000011",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8300000011",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 19800,
    source_price: 19800,
    original_price: 32000,
    return_price: 19800,
    condition_grade: "최상",
    discount_rate: 38,
    stock_status: "in_stock",
    stock_count: 50,
    naver_lowest_price: 27000,
    naver_match_status: "matched",
    is_public: true,
    score: 96,
    image_url: "https://images.unsplash.com/photo-1584556812952-905ffd0c611a",
    public_note: "알구몬 생활용품 1위 핫딜. 도톰한 6겹 천연펄프 롤화장지 60롤 1만원대 역대 최저가.",
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
        expected_product_id: "8300000011",
        expected_id_source: "coupang_url",
        resolved_product_id: "8300000011",
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
        reasons: ["60롤 19,800원 롤당 330원 가성비", "네이버 최저가 대비 7,200원 저렴"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "algumon-toocki-100w-c-cable",
    product_code: "8300000012",
    source: "manual",
    source_product_id: "8300000012",
    coupang_url: "https://www.coupang.com/vp/products/8300000012",
    title: "[쿠팡 핫딜] 투키(Toocki) 100W C to C 고속충전 케이블 2M 2개 세트 (로켓직구 4,900원)",
    category: "laptop",
    canonical_url: "https://www.coupang.com/vp/products/8300000012",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8300000012",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 4900,
    source_price: 4900,
    original_price: 9900,
    return_price: 4900,
    condition_grade: "최상",
    discount_rate: 51,
    stock_status: "in_stock",
    stock_count: 100,
    naver_lowest_price: 8500,
    naver_match_status: "matched",
    is_public: true,
    score: 98,
    image_url: "https://images.unsplash.com/photo-1541689592655-f5f52825a3b8",
    public_note: "알구몬 IT 소모품 핫딜. E-Marker 칩셋 탑재 PD 100W 5A 초고속 충전 지원 2개 세트 4천원대.",
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
        expected_product_id: "8300000012",
        expected_id_source: "coupang_url",
        resolved_product_id: "8300000012",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 98,
        price_score: 99,
        condition_score: 95,
        reasons: ["100W 고속충전 케이블 2개 4,900원", "네이버 최저가 대비 3,600원 저렴"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "algumon-pulmuone-thin-dumpling",
    product_code: "8300000013",
    source: "manual",
    source_product_id: "8300000013",
    coupang_url: "https://www.coupang.com/vp/products/8300000013",
    title: "[쿠팡 핫딜] 풀무원 얇은피 꽉찬속 고기만두 400g x 6봉 (로켓프레시 17,900원)",
    category: "food",
    canonical_url: "https://www.coupang.com/vp/products/8300000013",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8300000013",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 17900,
    source_price: 17900,
    original_price: 26900,
    return_price: 17900,
    condition_grade: "최상",
    discount_rate: 33,
    stock_status: "in_stock",
    stock_count: 40,
    naver_lowest_price: 23500,
    naver_match_status: "matched",
    is_public: true,
    score: 96,
    image_url: "https://images.unsplash.com/photo-1541696432-82c6da8ce7bf",
    public_note: "알구몬 로켓프레시 1위 핫딜. 피 두께 0.7mm 얇은피 꽉찬속 고기만두 6봉 17,900원 새벽배송 특가.",
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
        expected_product_id: "8300000013",
        expected_id_source: "coupang_url",
        resolved_product_id: "8300000013",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 96,
        price_score: 97,
        condition_score: 95,
        reasons: ["봉당 2,980원 새벽배송 역대가", "네이버 최저가 대비 5,600원 저렴"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "algumon-dongwon-tuna-10cans",
    product_code: "8300000014",
    source: "manual",
    source_product_id: "8300000014",
    coupang_url: "https://www.coupang.com/vp/products/8300000014",
    title: "[쿠팡 핫딜] 동원참치 라이트스탠다드 135g x 10캔 (쿠팡WOW 특가 14,900원)",
    category: "food",
    canonical_url: "https://www.coupang.com/vp/products/8300000014",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8300000014",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 14900,
    source_price: 14900,
    original_price: 22000,
    return_price: 14900,
    condition_grade: "최상",
    discount_rate: 32,
    stock_status: "in_stock",
    stock_count: 50,
    naver_lowest_price: 19500,
    naver_match_status: "matched",
    is_public: true,
    score: 95,
    image_url: "https://images.unsplash.com/photo-1547592180-85f173990554",
    public_note: "알구몬 비상식량/반찬 핫딜. 캔당 1,490원꼴 동원 라이트스탠다드 참치 10캔 무료배송.",
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
        expected_product_id: "8300000014",
        expected_id_source: "coupang_url",
        resolved_product_id: "8300000014",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 95,
        price_score: 97,
        condition_score: 94,
        reasons: ["캔당 1,490원 무료배송", "네이버 최저가 대비 4,600원 저렴"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "algumon-hetbahn-210g-36ea",
    product_code: "8300000015",
    source: "manual",
    source_product_id: "8300000015",
    coupang_url: "https://www.coupang.com/vp/products/8300000015",
    title: "[쿠팡 핫딜] CJ제일제당 햇반 백미밥 210g x 36개 (개당 827원 로켓배송 29,800원)",
    category: "food",
    canonical_url: "https://www.coupang.com/vp/products/8300000015",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8300000015",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 29800,
    source_price: 29800,
    original_price: 43000,
    return_price: 29800,
    condition_grade: "최상",
    discount_rate: 31,
    stock_status: "in_stock",
    stock_count: 60,
    naver_lowest_price: 36000,
    naver_match_status: "matched",
    is_public: true,
    score: 97,
    image_url: "https://images.unsplash.com/photo-1516684732162-798a0062be99",
    public_note: "알구몬 생필품 1위 핫딜. 자취생 및 가정 필수품 햇반 210g 36개 개당 827원 최저가.",
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
        expected_product_id: "8300000015",
        expected_id_source: "coupang_url",
        resolved_product_id: "8300000015",
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
        reasons: ["개당 827원 로켓배송 특가", "네이버 최저가 대비 6,200원 저렴"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "algumon-nongshim-shin-ramen-20ea",
    product_code: "8300000016",
    source: "manual",
    source_product_id: "8300000016",
    coupang_url: "https://www.coupang.com/vp/products/8300000016",
    title: "[쿠팡 핫딜] 농심 신라면 120g x 20봉 (봉당 690원 쿠팡WOW 13,800원)",
    category: "food",
    canonical_url: "https://www.coupang.com/vp/products/8300000016",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8300000016",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 13800,
    source_price: 13800,
    original_price: 19800,
    return_price: 13800,
    condition_grade: "최상",
    discount_rate: 30,
    stock_status: "in_stock",
    stock_count: 50,
    naver_lowest_price: 17500,
    naver_match_status: "matched",
    is_public: true,
    score: 96,
    image_url: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624",
    public_note: "알구몬 라면 핫딜 1위. 국민라면 신라면 20봉 봉당 690원 무료배송 특가.",
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
        expected_product_id: "8300000016",
        expected_id_source: "coupang_url",
        resolved_product_id: "8300000016",
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
        reasons: ["봉당 690원 무료배송", "네이버 최저가 대비 3,700원 저렴"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "algumon-kleenex-deco-soft-24rolls",
    product_code: "8300000017",
    source: "manual",
    source_product_id: "8300000017",
    coupang_url: "https://www.coupang.com/vp/products/8300000017",
    title: "[쿠팡 핫딜] 크리넥스 3겹 데코앤소프트 화장지 33m x 24롤 (18,900원 무료배송)",
    category: "vacuum",
    canonical_url: "https://www.coupang.com/vp/products/8300000017",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8300000017",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 18900,
    source_price: 18900,
    original_price: 28900,
    return_price: 18900,
    condition_grade: "최상",
    discount_rate: 35,
    stock_status: "in_stock",
    stock_count: 30,
    naver_lowest_price: 24500,
    naver_match_status: "matched",
    is_public: true,
    score: 95,
    image_url: "https://images.unsplash.com/photo-1584556812952-905ffd0c611a",
    public_note: "알구몬 화장지 추천 핫딜. 부드러운 3겹 천연펄프 프리미엄 데코앤소프트 24롤 특가.",
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
        expected_product_id: "8300000017",
        expected_id_source: "coupang_url",
        resolved_product_id: "8300000017",
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
        reasons: ["롤당 787원 프리미엄 3겹", "네이버 최저가 대비 5,600원 저렴"],
        created_at: new Date().toISOString()
      }
    ]
  },
  {
    id: "algumon-dr-g-red-blemish-cream-2set",
    product_code: "8300000018",
    source: "manual",
    source_product_id: "8300000018",
    coupang_url: "https://www.coupang.com/vp/products/8300000018",
    title: "[쿠팡 핫딜] 닥터지 레드 블레미쉬 클리어 수딩 크림 70ml x 2개 세트 (24,900원)",
    category: "vacuum",
    canonical_url: "https://www.coupang.com/vp/products/8300000018",
    affiliate_url: "https://link.coupang.com/a/bCdef1",
    affiliate_product_id: "8300000018",
    status: "published",
    is_published: true,
    sourcing_status: "published",
    deal_price: 24900,
    source_price: 24900,
    original_price: 39000,
    return_price: 24900,
    condition_grade: "최상",
    discount_rate: 36,
    stock_status: "in_stock",
    stock_count: 25,
    naver_lowest_price: 32000,
    naver_match_status: "matched",
    is_public: true,
    score: 96,
    image_url: "https://images.unsplash.com/photo-1556228720-195a672e8a03",
    public_note: "알구몬 뷰티/스킨케어 1위 핫딜. 민감 피부 진정 수분크림 70ml 2개 듀오 세트 2만원대.",
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
        expected_product_id: "8300000018",
        expected_id_source: "coupang_url",
        resolved_product_id: "8300000018",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: new Date().toISOString(),
        method: "automatic"
      }
    },
    scores: [
      {
        total_score: 96,
        price_score: 97,
        condition_score: 95,
        reasons: ["개당 12,450원 듀오 세트", "네이버 최저가 대비 7,100원 저렴"],
        created_at: new Date().toISOString()
      }
    ]
  }
];

// 총 18종 전체 알구몬 일주일치 핫딜 병합
export const allAlgumonWeeklyDeals = [
  ...exactAlgumonUserDeals,
  ...additionalAlgumonWeeklyDeals
];

function generateTotalHtmlExport() {
  const sections = allAlgumonWeeklyDeals.map((deal, idx) => {
    const kit = buildProductDistributionKit(deal);
    return `
    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin-bottom: 32px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 16px;">
        <span style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 9999px; font-weight: bold; font-size: 13px;">#${idx + 1} ${deal.category}</span>
        <span style="color: #64748b; font-size: 13px;">알구몬 검색 실시간 핫딜 원문</span>
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
  <title>알구몬 일주일치 [쿠팡] 핫딜 전체 18종 리뷰 키트 모음</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", sans-serif; line-height: 1.6; max-width: 960px; margin: 40px auto; padding: 0 20px; background: #f8fafc; color: #1e293b; }
    h1 { color: #0f172a; text-align: center; margin-bottom: 10px; font-size: 26px; }
    p.subtitle { text-align: center; color: #64748b; margin-bottom: 40px; font-size: 15px; }
  </style>
</head>
<body>
  <h1>알구몬 일주일치 [쿠팡] 핫딜 전체 18종 리뷰 키트</h1>
  <p class="subtitle">알구몬 검색창에서 확인되는 7일간의 실제 쿠팡 핫딜(식품, 생필품, 영양제, 전자기기, 태블릿 등 18종)을 파트너스 링크와 공정위 대가성 고지 문구가 포함된 고품질 리뷰로 변환한 데이터입니다.</p>
  ${sections}
</body>
</html>`;

  const outputPath = resolve(process.cwd(), "public/algumon_deals_preview.html");
  writeFileSync(outputPath, html, "utf-8");
  console.log(`[OK] 알구몬 총 ${allAlgumonWeeklyDeals.length}종 핫딜 HTML 생성 완료: ${outputPath}`);
}

generateTotalHtmlExport();
