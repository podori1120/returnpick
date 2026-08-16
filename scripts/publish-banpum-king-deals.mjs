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
    public_note: "티타늄 프레임과 512GB 대용량 자급제 플래그십 스마트폰.",
    inspection_report: "박스 봉인 라벨 미개봉 상태, 최초 통화일자 0일 미등록 공기계.",
    stock_remain: 3,
    card_benefit: "알뜰폰 유심 즉시 사용 가능 자급제",
    pros: ["갤럭시 AI 탑재 및 2억 화소 카메라", "새상품 대비 46만원 절약", "약정 없는 100% 자급제 공기계"]
  },
  {
    id: "bpk-07",
    title: "로보락 S8 MaxV Ultra 올인원 직배수 로봇청소기",
    category: "스마트가전",
    deal_price: 1480000,
    return_grade: "반품-최상급",
    new_product_price: 1840000,
    naver_lowest_price: 1720000,
    lowest_price_60d: 1480000,
    discount_rate: 20,
    image_url: "https://images.unsplash.com/photo-1558317374-067fb5f30001",
    public_note: "모서리 팝아웃 물걸레와 10,000Pa 압도적 흡입력의 현존 끝판왕.",
    inspection_report: "도킹 스테이션 및 본체 미사용급 클린 상태 확인.",
    stock_remain: 2,
    card_benefit: "쿠팡 공식 2년 무상 보증",
    pros: ["10,000Pa 극강의 흡입력과 60도 온수 물걸레 세척", "새상품 대비 36만원 세이브", "완전 무인 자동화"]
  },
  {
    id: "bpk-08",
    title: "소니 A7M4 (ILCE-7M4) 풀프레임 미러리스 카메라 바디",
    category: "카메라/렌즈",
    return_grade: "반품-최상급",
    deal_price: 2290000,
    new_product_price: 2890000,
    naver_lowest_price: 2690000,
    lowest_price_60d: 2290000,
    discount_rate: 21,
    image_url: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32",
    public_note: "3,300만 화소 4K 60p 유튜브 및 전문 사진 촬영용 풀프레임 바디.",
    inspection_report: "컷수 50컷 미만 단순 테스트 반품, 센서 무결점 확인.",
    stock_remain: 1,
    card_benefit: "소니 코리아 정품 등록 가능",
    pros: ["3,300만 화소 이면조사형 Exmor R 센서", "새상품 대비 60만원 파격 절약", "리얼타임 Eye AF 추적"]
  }
];

async function publishBanpumKingDeals() {
  console.log("=================================================");
  console.log("   👑 [반품왕 에디션] 100~300만원대 초고단가 반품관 발행");
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

  const targetPostId = "5041237301912454229"; // 반품관 포스트를 반품왕 8종으로 전면 갱신

  const magazineHtml = renderBanpumKingMagazineHtml(
    "[반품왕] 100~300만원대 초고단가 반품-미개봉/최상급 전자기기 BEST 8 (새상품 대비 최대 160만원 절약)",
    "갤럭시북4 프로, 맥북 프로 16 M3, LG 77인치 OLED TV, 비스포크 AI 콤보 세탁건조기, ROG RTX 4080 게이밍, 갤럭시 S24 울트라 등 검수 완료된 고단가 반품 특가 모음입니다.",
    banpumKing8Deals
  );

  const updateRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${targetPostId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      kind: "blogger#post",
      title: "[반품왕] 100~300만원대 반품-미개봉/최상급 전자기기 BEST 8",
      content: magazineHtml,
      labels: ["반품왕", "쿠팡반품", "맥북프로", "갤럭시북4", "올레드TV", "가전반품", "반품특가"]
    })
  });

  const updateData = await updateRes.json();
  console.log(`✅ 반품왕 고단가 전용관 갱신 완료! (${updateData.url})`);

  // 반품왕 전용 바이럴 텍스트 팩 생성
  const banpumKingViralText = `👑 [반품왕 실시간 핫딜] 100~300만원대 가전/전자기기 반품-미개봉 TOP 5!
(새상품 대비 최대 160만원 세이브 / 쿠팡 공식 30일 무료반품 보증)

1️⃣ LG 77인치 4K OLED 올레드 TV (반품-미개봉 정품)
👉 319만원 (정가 480만원 대비 무려 161만원 세이브!)

2️⃣ Samsung 갤럭시북4 프로 16인치 터치 (Ultra 7 / 32G / 1TB)
👉 195만원 (새상품 265만원 대비 70만원 절약!)

3️⃣ Apple 맥북 프로 16 M3 Pro (스페이스 블랙)
👉 289만원 (새상품 369만원 대비 80만원 절약!)

4️⃣ Samsung 비스포크 AI 콤보 세탁건조기 (25kg+15kg)
👉 279만원 (정가 399만원 대비 120만원 절약!)

5️⃣ ASUS ROG 스트릭스 G16 게이밍 (i9-14900HX / RTX 4080)
👉 269만원 (새상품 349만원 대비 80만원 절약!)

👉 검수 리포트 & 실시간 반품 재고 확인:
${updateData.url}`;

  writeFileSync(resolve(process.cwd(), "public/banpumking_high_value_pack.txt"), banpumKingViralText, "utf-8");
  console.log("반품왕 바이럴 팩 저장 완료: public/banpumking_high_value_pack.txt");

  // 검색엔진 색인
  if (updateData.url) {
    try {
      const pingRes = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host: "returnpick-deals.blogspot.com",
          key: "8008329337373147131",
          keyLocation: "https://returnpick-deals.blogspot.com/8008329337373147131.txt",
          urlList: [updateData.url]
        })
      });
      console.log(`IndexNow 색인 요청 완료 (${pingRes.status})`);
    } catch (e) {}
  }
}

publishBanpumKingDeals().catch(console.error);
