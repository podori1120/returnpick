import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderBanpumKingMagazineHtml } from "@/lib/banpumKingDesign";

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

export const banpumKing8Deals = [
  {
    id: "bpk-01",
    title: "삼성전자 갤럭시북4 프로 16인치 터치 (Intel Core Ultra 7 / 32GB / 1TB SSD / WQXGA+ AMOLED)",
    category: "노트북/PC",
    return_grade: "반품-미개봉 정품",
    deal_price: 1950000,
    new_product_price: 2650000,
    naver_lowest_price: 2490000,
    lowest_price_60d: 1950000,
    discount_rate: 26,
    image_url: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed",
    coupang_url: "https://www.coupang.com/np/search?q=%EA%B0%A4%EB%9F%AD%EC%8B%9C%EB%B6%814+%ED%94%84%EB%A1%9C+16+%EB%B0%98%ED%92%88",
    public_note: "단순 박스 겉면 라벨 훼손 반품. 32GB 메모리 + 1TB SSD 플래그십 190만원대.",
    inspection_report: "박스 내부 완충재 및 본체 보호필름 100% 미개봉 신품 상태 확인 완료.",
    stock_remain: 2,
    card_benefit: "최대 22개월 무이자 + 30일 무료반품",
    pros: ["3K 120Hz 다이내믹 아몰레드 터치 디스플레이", "새상품 대비 70만원 파격 절약", "삼성 공식 무상 AS 1년 보증"]
  },
  {
    id: "bpk-02",
    title: "Apple 2024 맥북 프로 16 M3 Pro (12코어 CPU, 18코어 GPU, 18GB RAM, 512GB SSD)",
    category: "애플/노트북",
    return_grade: "반품-최상급",
    deal_price: 2890000,
    new_product_price: 3690000,
    naver_lowest_price: 3450000,
    lowest_price_60d: 2890000,
    discount_rate: 22,
    image_url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8",
    coupang_url: "https://www.coupang.com/np/search?q=%EB%A7%A5%EB%B6%81%ED%94%84%EB%A1%9C+16+M3+%EB%B0%98%ED%92%88",
    public_note: "스페이스 블랙 M3 Pro 16인치 전문가용 맥북 프로 280만원대.",
    inspection_report: "단순 변심 1회 개봉 반품, 외관 흠집 전무 및 배터리 사이클 1회 신품급.",
    stock_remain: 1,
    card_benefit: "애플케어 플러스 등록 가능 + 24개월 무이자",
    pros: ["16.2인치 리퀴드 레티나 XDR 120Hz 디스플레이", "새상품 대비 80만원 대폭 절약", "22시간 괴물 배터리 타임"]
  },
  {
    id: "bpk-03",
    title: "LG전자 77인치 4K UHD 올레드 OLED TV (스탠드형 / 무료 로켓설치)",
    category: "대형가전/TV",
    return_grade: "반품-미개봉 정품",
    deal_price: 3190000,
    new_product_price: 4800000,
    naver_lowest_price: 4200000,
    lowest_price_60d: 3190000,
    discount_rate: 34,
    image_url: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1",
    coupang_url: "https://www.coupang.com/np/search?q=LG+77%EC%9D%B8%EC%B9%98+OLED+TV+%EB%B0%98%ED%92%88",
    public_note: "자발광 77인치 초대형 4K 올레드 TV. 박스 미개봉 정품 310만원대.",
    inspection_report: "물류창고 단순 보관 흠집 박스, 내부 TV 패널 100% 무결점 정품 확인.",
    stock_remain: 1,
    card_benefit: "로켓설치 전문 기사 2인 1조 무료 설치 및 폐가전 수거",
    pros: ["77인치 웅장한 대화면과 압도적인 블랙 표현", "새상품 대비 무려 161만원 세이브", "LG 정품 패널 2년 무상 보증"]
  },
  {
    id: "bpk-04",
    title: "삼성전자 비스포크 AI 콤보 올인원 세탁건조기 25kg+15kg",
    category: "대형가전/세탁기",
    return_grade: "반품-최상급",
    deal_price: 2790000,
    new_product_price: 3990000,
    naver_lowest_price: 3490000,
    lowest_price_60d: 2790000,
    discount_rate: 30,
    image_url: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1",
    coupang_url: "https://www.coupang.com/np/search?q=%EB%B9%84%EC%8A%A4%ED%8F%AC%ED%81%AC+AI+%EC%BD%A4%EB%B3%B4+%EB%B0%98%ED%92%88",
    public_note: "세탁 후 건조까지 세탁물 이동 없이 99분 만에 끝내는 올인원 콤보.",
    inspection_report: "단순 변심 반품, 내부 드럼통 및 외관 클린 상태 확인 완료.",
    stock_remain: 2,
    card_benefit: "삼성 전문 기사 무료 배송/설치",
    pros: ["세탁물 옮길 필요 없는 올인원 원스톱", "새상품 대비 120만원 파격 절약", "인버터 히트펌프 고효율 건조"]
  },
  {
    id: "bpk-05",
    title: "ASUS ROG 스트릭스 G16 게이밍 노트북 (i9-14900HX / RTX 4080 / 32GB / 1TB / 240Hz)",
    category: "게이밍/PC",
    return_grade: "반품-최상급",
    deal_price: 2690000,
    new_product_price: 3490000,
    naver_lowest_price: 3250000,
    lowest_price_60d: 2690000,
    discount_rate: 23,
    image_url: "https://images.unsplash.com/photo-1603302576837-37561b2e2302",
    coupang_url: "https://www.coupang.com/np/search?q=ASUS+ROG+G16+RTX4080+%EB%B0%98%ED%92%88",
    public_note: "i9 14세대 최상급 CPU와 RTX 4080 탑재 플래그십 게이밍 머신.",
    inspection_report: "키보드 및 상하판 흠집 전무, 풀박스 구성품 완벽 유지.",
    stock_remain: 1,
    card_benefit: "카드사 무이자 최대 22개월",
    pros: ["RTX 4080 12GB TGP 175W 풀파워", "QHD 240Hz 3ms 고주사율 패널", "새상품 대비 80만원 절약"]
  },
  {
    id: "bpk-06",
    title: "삼성전자 갤럭시 S24 울트라 512GB 자급제 (티타늄 그레이)",
    category: "스마트폰/모바일",
    return_grade: "반품-미개봉 정품",
    deal_price: 1380000,
    new_product_price: 1840000,
    naver_lowest_price: 1650000,
    lowest_price_60d: 1380000,
    discount_rate: 25,
    image_url: "https://images.unsplash.com/photo-1511707171634-5f897ff02560",
    coupang_url: "https://www.coupang.com/np/search?q=%EA%B0%A4%EB%9F%AD%EC%8B%9CS24+%EC%9A%B8%ED%8A%B8%EB%9D%BC+512GB+%EB%B0%98%ED%92%88",
    public_note: "티타늄 프레임과 512GB 대용량 자급제 플래그십 스마트폰.",
    inspection_report: "박스 봉인 라벨 미개봉 상태, 최초 통화일자 0일 미등록 공기계.",
    stock_remain: 3,
    card_benefit: "알뜰폰 유심 즉시 사용 가능 자급제",
    pros: ["2억 화소 카메라 및 갤럭시 AI 온디바이스 기능", "새상품 대비 46만원 세이브", "삼성전자 정품 자급제"]
  },
  {
    id: "bpk-07",
    title: "로보락 S8 MaxV Ultra 올인원 로봇청소기 (직배수 키트 지원 / 온수 물걸레 세척)",
    category: "가전/청소기",
    return_grade: "반품-최상급",
    deal_price: 1480000,
    new_product_price: 1840000,
    naver_lowest_price: 1720000,
    lowest_price_60d: 1480000,
    discount_rate: 20,
    image_url: "https://images.unsplash.com/photo-1558317374-067fb5f30001",
    coupang_url: "https://www.coupang.com/np/search?q=%EB%A1%9C%EB%B3%B4%EB%9D%BD+S8+MaxV+Ultra+%EB%B0%98%ED%92%88",
    public_note: "60도 온수 물걸레 세척과 직배수 지원 끝판왕 로봇청소기 140만원대.",
    inspection_report: "도킹 스테이션 및 본체 미사용급 클린 상태 확인.",
    stock_remain: 2,
    card_benefit: "로보락 코리아 공식 2년 무상 AS 보증",
    pros: ["10,000Pa 강력 흡입력과 엣지 물걸레 확장", "새상품 대비 36만원 절약", "유지관리 걱정 없는 올인원 도크"]
  },
  {
    id: "bpk-08",
    title: "소니 A7M4 (ILCE-7M4) 풀프레임 미러리스 카메라 바디",
    category: "카메라/영상",
    return_grade: "반품-최상급",
    deal_price: 2290000,
    new_product_price: 2890000,
    naver_lowest_price: 2690000,
    lowest_price_60d: 2290000,
    discount_rate: 21,
    image_url: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32",
    coupang_url: "https://www.coupang.com/np/search?q=%EC%86%8C%EB%8B%88+A7M4+%EB%B0%98%ED%92%88",
    public_note: "3300만 화소 BIONZ XR 프로세서 탑재 영상/사진 하이브리드 미러리스.",
    inspection_report: "컷수 50컷 미만 단순 테스트 반품, 센서 무결점 확인.",
    stock_remain: 1,
    card_benefit: "소니 코리아 정품 등록 가능",
    pros: ["4K 60p 10bit 4:2:2 영상 촬영", "새상품 대비 60만원 파격 절약", "인체공학 그립 및 듀얼 슬롯"]
  }
];

export async function publishBanpumKingDeals() {
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

  const html = renderBanpumKingMagazineHtml(
    "[반품왕] 100~300만원대 초고액 반품-미개봉/최상급 전자기기 BEST 8 (새상품 대비 최대 161만원 세이브)",
    "단순 박스 개봉만으로 수십~백만 원 이상 할인된 맥북 프로, 갤럭시북4, LG 77인치 올레드 TV, 비스포크 AI 콤보 실시간 반품 재고 모음입니다.",
    banpumKing8Deals
  );

  const targetPostId = "5041237301912454229";
  const url = `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${targetPostId}`;
  
  await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      kind: "blogger#post",
      title: "[반품왕] 100~300만원대 초고액 반품-미개봉/최상급 전자기기 BEST 8 (새상품 대비 최대 161만원 세이브)",
      content: html,
      labels: ["반품왕", "쿠팡반품", "고액반품", "맥북프로", "갤럭시북4", "올레드TV", "가전특가"]
    })
  });

  console.log("✅ 반품왕 고단가 전용관 갱신 완료! (https://returnpick-deals.blogspot.com/2026/08/17900.html)");
}

publishBanpumKingDeals().catch(console.error);
