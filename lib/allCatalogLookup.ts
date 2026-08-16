import { calculateDealScore } from "@/lib/scoring";
import type { ProductWithScore, Category, ConditionGrade } from "@/lib/types";

// 1. 반품왕 고액 8종
export const banpumKingCatalog = [
  {
    id: "bpk-01",
    title: "삼성전자 갤럭시북4 프로 16인치 터치 (Intel Core Ultra 7 / 32GB / 1TB SSD)",
    category: "laptop" as Category,
    brand: "Samsung",
    model_name: "Galaxy Book4 Pro",
    deal_price: 1950000,
    new_price: 2650000,
    naver_lowest_price: 2490000,
    condition_grade: "미개봉" as ConditionGrade,
    stock_count: 2,
    image_url: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed",
    public_note: "박스 내부 완충재 및 본체 보호필름 100% 미개봉 신품 상태 확인 완료.",
    coupang_url: "https://www.coupang.com/np/search?q=%EA%B0%A4%EB%9F%AD%EC%8B%9C%EB%B6%814+%ED%94%84%EB%A1%9C+16",
    affiliate_url: "https://link.coupang.com/a/bWq88Z"
  },
  {
    id: "bpk-02",
    title: "Apple 2024 맥북 프로 16 M3 Pro (12코어 CPU, 18GB RAM, 512GB SSD 스페이스블랙)",
    category: "laptop" as Category,
    brand: "Apple",
    model_name: "MacBook Pro 16",
    deal_price: 2890000,
    new_price: 3690000,
    naver_lowest_price: 3450000,
    condition_grade: "최상" as ConditionGrade,
    stock_count: 1,
    image_url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8",
    public_note: "단순 변심 1회 개봉 반품, 외관 흠집 전무 및 배터리 사이클 1회 신품급.",
    coupang_url: "https://www.coupang.com/np/search?q=%EB%A7%A5%EB%B6%81+%ED%94%84%EB%A1%9C+16+M3",
    affiliate_url: "https://link.coupang.com/a/bWq88Z"
  },
  {
    id: "bpk-03",
    title: "LG전자 77인치 4K UHD 올레드 OLED TV (OLED77C3 / 무료설치)",
    category: "monitor" as Category,
    brand: "LG",
    model_name: "OLED77C3",
    deal_price: 3190000,
    new_price: 4800000,
    naver_lowest_price: 4200000,
    condition_grade: "미개봉" as ConditionGrade,
    stock_count: 1,
    image_url: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1",
    public_note: "물류창고 단순 보관 흠집 박스, 내부 TV 패널 100% 무결점 정품 확인.",
    coupang_url: "https://www.coupang.com/np/search?q=LG+77%EC%9D%B8%EC%87%A1+OLED+TV",
    affiliate_url: "https://link.coupang.com/a/bWq88Z"
  },
  {
    id: "bpk-04",
    title: "삼성전자 비스포크 AI 콤보 올인원 세탁건조기 25kg+15kg",
    category: "robot_vacuum" as Category,
    brand: "Samsung",
    model_name: "Bespoke AI Combo",
    deal_price: 2790000,
    new_price: 3990000,
    naver_lowest_price: 3490000,
    condition_grade: "최상" as ConditionGrade,
    stock_count: 2,
    image_url: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1",
    public_note: "단순 변심 반품, 내부 드럼통 및 외관 클린 상태 확인 완료.",
    coupang_url: "https://www.coupang.com/np/search?q=%EB%B9%84%EC%8A%A4%ED%8F%AC%ED%81%AC+AI+%EC%BD%A4%EB%B3%B4",
    affiliate_url: "https://link.coupang.com/a/bWq88Z"
  },
  {
    id: "bpk-05",
    title: "ASUS ROG 스트릭스 G16 게이밍 노트북 (i9-14900HX / RTX 4080 / 32GB / 1TB)",
    category: "laptop" as Category,
    brand: "ASUS",
    model_name: "ROG Strix G16",
    deal_price: 2690000,
    new_price: 3490000,
    naver_lowest_price: 3250000,
    condition_grade: "최상" as ConditionGrade,
    stock_count: 1,
    image_url: "https://images.unsplash.com/photo-1603302576837-37561b2e2302",
    public_note: "키보드 및 상하판 흠집 전무, 풀박스 구성품 완벽 유지.",
    coupang_url: "https://www.coupang.com/np/search?q=ASUS+ROG+G16+RTX4080",
    affiliate_url: "https://link.coupang.com/a/bWq88Z"
  },
  {
    id: "bpk-06",
    title: "삼성전자 갤럭시 S24 울트라 512GB 자급제 (티타늄 그레이)",
    category: "laptop" as Category,
    brand: "Samsung",
    model_name: "Galaxy S24 Ultra",
    deal_price: 1380000,
    new_price: 1840000,
    naver_lowest_price: 1650000,
    condition_grade: "미개봉" as ConditionGrade,
    stock_count: 3,
    image_url: "https://images.unsplash.com/photo-1511707171634-5f897ff02560",
    public_note: "박스 봉인 라벨 미개봉 상태, 최초 통화일자 0일 미등록 공기계.",
    coupang_url: "https://www.coupang.com/np/search?q=%EA%B0%A4%EB%9F%AD%EC%8B%9CS24+%EC%9A%B8%ED%8A%B8%EB%9D%BC+512GB",
    affiliate_url: "https://link.coupang.com/a/bWq88Z"
  },
  {
    id: "bpk-07",
    title: "로보락 S8 MaxV Ultra 올인원 직배수 로봇청소기",
    category: "robot_vacuum" as Category,
    brand: "Roborock",
    model_name: "S8 MaxV Ultra",
    deal_price: 1480000,
    new_price: 1840000,
    naver_lowest_price: 1720000,
    condition_grade: "최상" as ConditionGrade,
    stock_count: 2,
    image_url: "https://images.unsplash.com/photo-1558317374-067fb5f30001",
    public_note: "도킹 스테이션 및 본체 미사용급 클린 상태 확인.",
    coupang_url: "https://www.coupang.com/np/search?q=%EB%A1%9C%EB%B3%B4%EB%9D%BD+S8+MaxV+Ultra",
    affiliate_url: "https://link.coupang.com/a/bWq88Z"
  },
  {
    id: "bpk-08",
    title: "소니 A7M4 (ILCE-7M4) 풀프레임 미러리스 카메라 바디",
    category: "laptop" as Category,
    brand: "Sony",
    model_name: "ILCE-7M4",
    deal_price: 2290000,
    new_price: 2890000,
    naver_lowest_price: 2690000,
    condition_grade: "최상" as ConditionGrade,
    stock_count: 1,
    image_url: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32",
    public_note: "컷수 50컷 미만 단순 테스트 반품, 센서 무결점 확인.",
    coupang_url: "https://www.coupang.com/np/search?q=%EC%86%8C%EB%8B%88+A7M4",
    affiliate_url: "https://link.coupang.com/a/bWq88Z"
  }
];

// 2. VIP 가전 5종
export const highValueCatalog = [
  {
    id: "high-01",
    title: "Apple 2024 맥북 에어 15 M3 칩 (16GB RAM, 512GB SSD)",
    category: "laptop" as Category,
    brand: "Apple",
    model_name: "MacBook Air 15",
    deal_price: 1890000,
    new_price: 2160000,
    naver_lowest_price: 2050000,
    condition_grade: "최상" as ConditionGrade,
    stock_count: 3,
    image_url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8",
    public_note: "M3 칩셋 16GB 기본 탑재형 15인치 맥북 에어. 학생 및 영상편집용 끝판왕.",
    coupang_url: "https://www.coupang.com/np/search?q=%EB%A7%A5%EB%B6%81%EC%97%90%EC%96%B4+15+M3",
    affiliate_url: "https://link.coupang.com/a/bWq88Z"
  },
  {
    id: "high-02",
    title: "LG전자 65인치 4K UHD 올레드 OLED TV (스탠드형 무료설치)",
    category: "monitor" as Category,
    brand: "LG",
    model_name: "OLED65",
    deal_price: 1690000,
    new_price: 2200000,
    naver_lowest_price: 1950000,
    condition_grade: "미개봉" as ConditionGrade,
    stock_count: 2,
    image_url: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1",
    public_note: "자발광 4K 올레드 패널과 알파9 AI 프로세서 탑재 프리미엄 스마트 TV.",
    coupang_url: "https://www.coupang.com/np/search?q=LG+65%EC%9D%B8%EC%B9%98+OLED",
    affiliate_url: "https://link.coupang.com/a/bWq88Z"
  },
  {
    id: "high-03",
    title: "삼성전자 비스포크 AI 콤보 올인원 세탁건조기 25kg+15kg",
    category: "robot_vacuum" as Category,
    brand: "Samsung",
    model_name: "AI Combo",
    deal_price: 2890000,
    new_price: 3790000,
    naver_lowest_price: 3290000,
    condition_grade: "최상" as ConditionGrade,
    stock_count: 4,
    image_url: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1",
    public_note: "세탁 후 건조까지 세탁물 이동 없이 99분 만에 끝내는 차세대 올인원 콤보.",
    coupang_url: "https://www.coupang.com/np/search?q=%EB%B9%84%EC%8A%A4%ED%8F%AC%ED%81%AC+AI+%EC%BD%A4%EB%B3%B4",
    affiliate_url: "https://link.coupang.com/a/bWq88Z"
  },
  {
    id: "high-04",
    title: "HP 오멘 OMEN 16 게이밍 노트북 (i7-14700HX RTX 4070 QHD 240Hz)",
    category: "laptop" as Category,
    brand: "HP",
    model_name: "OMEN 16",
    deal_price: 1949000,
    new_price: 2490000,
    naver_lowest_price: 2250000,
    condition_grade: "최상" as ConditionGrade,
    stock_count: 5,
    image_url: "https://images.unsplash.com/photo-1603302576837-37561b2e2302",
    public_note: "i7 14세대와 RTX 4070, QHD 240Hz 초고주사율 하이엔드 게이밍 노트북.",
    coupang_url: "https://www.coupang.com/np/search?q=HP+%EC%98%A4%EB%A9%98+16+RTX4070",
    affiliate_url: "https://link.coupang.com/a/bWq88Z"
  },
  {
    id: "high-05",
    title: "로보락 S8 Pro Ultra 올인원 로봇청소기 (열풍건조 물걸레 세척)",
    category: "robot_vacuum" as Category,
    brand: "Roborock",
    model_name: "S8 Pro Ultra",
    deal_price: 1420000,
    new_price: 1690000,
    naver_lowest_price: 1550000,
    condition_grade: "최상" as ConditionGrade,
    stock_count: 3,
    image_url: "https://images.unsplash.com/photo-1558317374-067fb5f30001",
    public_note: "먼지비움, 물걸레 세척, 열풍 건조까지 100% 전자동 끝판왕 로봇청소기.",
    coupang_url: "https://www.coupang.com/np/search?q=%EB%A1%9C%EB%B3%B4%EB%9D%BD+S8+Pro+Ultra",
    affiliate_url: "https://link.coupang.com/a/bWq88Z"
  }
];

export function findFallbackDeal(id: string): ProductWithScore | null {
  const allRaw = [...banpumKingCatalog, ...highValueCatalog];
  const item = allRaw.find(d => d.id === id);
  if (!item) return null;

  const nowIso = new Date().toISOString();
  const productBase = {
    id: item.id,
    source: "coupang_sourcing",
    source_product_id: item.id,
    category: item.category,
    keyword: item.brand,
    title: item.title,
    brand: item.brand,
    model_name: item.model_name,
    image_url: item.image_url,
    source_url: item.coupang_url,
    coupang_url: item.coupang_url,
    affiliate_url: item.affiliate_url,
    source_price: item.deal_price,
    return_price: item.deal_price,
    new_price: item.new_price,
    naver_lowest_price: item.naver_lowest_price,
    condition_grade: item.condition_grade,
    stock_count: item.stock_count,
    public_note: item.public_note,
    spec_json: {},
    raw_json: {},
    sourcing_status: "published" as const,
    is_published: true,
    is_rejected: false,
    rejection_reason: null,
    admin_memo: null,
    last_observed_at: nowIso,
    created_at: nowIso,
    updated_at: nowIso
  };

  const calculated = calculateDealScore(productBase);

  return {
    ...productBase,
    latest_score: {
      ...calculated,
      id: `score-${item.id}`,
      product_id: item.id,
      created_at: nowIso,
      updated_at: nowIso
    },
    deal_scores: [],
    snapshots: [],
    latest_snapshot: null
  };
}
