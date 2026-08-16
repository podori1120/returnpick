import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderUnitPriceMagazineHtml } from "@/lib/unitPriceBreakdownDesign";

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

export const unitPrice8Deals = [
  {
    id: "unit-01",
    title: "광동 썬키스트 제로 복숭아레몬 소다 355ml x 24캔",
    category: "탄산음료",
    unit_badge: "캔당 535원 무료배송",
    deal_price: 12860,
    market_single_price: 1500, // 편의점 1,500원
    total_units: 24,
    naver_lowest_price: 18000,
    lowest_price_60d: 12860,
    discount_rate: 64,
    image_url: "https://images.unsplash.com/photo-1551024709-8f23befc6f87",
    public_note: "편의점 1캔에 1,500원인 제로탄산을 캔당 535원에 쟁여두는 초특가.",
    pros: ["편의점 대비 캔당 965원 절약 (총 23,140원 세이브)", "0kcal 0g 당류 다이어트 음료", "무료배송"]
  },
  {
    id: "unit-02",
    title: "CJ제일제당 햇반 백미밥 210g x 36개 대용량",
    category: "가공식품/밥",
    unit_badge: "개당 827원 최저가",
    deal_price: 29800,
    market_single_price: 1800, // 마트 1,800원
    total_units: 36,
    naver_lowest_price: 36000,
    lowest_price_60d: 29800,
    discount_rate: 54,
    image_url: "https://images.unsplash.com/photo-1516684732162-798a0062be99",
    public_note: "자취생, 맞벌이 가정 필수 비상식량 햇반 210g 정량 개당 827원.",
    pros: ["개당 827원으로 편의점 1개 가격에 2개 득템", "갓 지은 밥맛 보존", "로켓배송"]
  },
  {
    id: "unit-03",
    title: "코카콜라 프리미어리그 스페셜 패키지 490ml x 24캔",
    category: "탄산음료",
    unit_badge: "대용량 캔당 991원",
    deal_price: 23800,
    market_single_price: 2200, // 편의점 2,200원
    total_units: 24,
    naver_lowest_price: 31000,
    lowest_price_60d: 23800,
    discount_rate: 55,
    image_url: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97",
    public_note: "일반 355ml보다 큰 490ml 대용량 캔이 캔당 991원 무료배송.",
    pros: ["편의점 낱개 대비 총 2.9만원 절약", "EPL 한정판 디자인", "폴센트 최저가 검증"]
  },
  {
    id: "unit-04",
    title: "농심 신라면 120g x 20봉 박스",
    category: "라면/면류",
    unit_badge: "봉당 690원 특가",
    deal_price: 13800,
    market_single_price: 1100, // 편의점 1,100원
    total_units: 20,
    naver_lowest_price: 17500,
    lowest_price_60d: 13800,
    discount_rate: 37,
    image_url: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624",
    public_note: "국민 라면 신라면 20봉 박스를 봉당 690원에 문 앞까지 무료배송.",
    pros: ["봉당 690원 가성비", "얼큰하고 깊은 소고기 육수", "네이버 대비 3,700원 저렴"]
  },
  {
    id: "unit-05",
    title: "현대약품 오리지널 미에로화이바 100ml x 20병",
    category: "건강음료",
    unit_badge: "병당 457원 특가",
    deal_price: 9150,
    market_single_price: 1200, // 편의점 1,200원
    total_units: 20,
    naver_lowest_price: 13500,
    lowest_price_60d: 9150,
    discount_rate: 62,
    image_url: "https://images.unsplash.com/photo-1551024709-8f23befc6f87",
    public_note: "식이섬유 2,500mg 함유 오리지널 미에로화이바 병당 457원.",
    pros: ["편의점 대비 62% 저렴", "한 병당 식이섬유 2,500mg", "네이버 대비 4,350원 세이브"]
  },
  {
    id: "unit-06",
    title: "탐사 프리미엄 6겹 롤화장지 30m x 60롤",
    category: "생활용품/화장지",
    unit_badge: "롤당 330원 가성비",
    deal_price: 19800,
    market_single_price: 800, // 롤당 800원
    total_units: 60,
    naver_lowest_price: 27000,
    lowest_price_60d: 19800,
    discount_rate: 59,
    image_url: "https://images.unsplash.com/photo-1584556812952-905ffd0c611a",
    public_note: "도톰한 6겹 천연펄프 화장지 60롤 대용량이 롤당 330원.",
    pros: ["6겹 도톰한 천연펄프", "60롤 1만원대 역대 최저가", "네이버 대비 7,200원 절약"]
  },
  {
    id: "unit-07",
    title: "곰곰 만능 한알육수 3g x 70알",
    category: "조미료/육수",
    unit_badge: "알당 139원 만능육수",
    deal_price: 9750,
    market_single_price: 400, // 알당 400원
    total_units: 70,
    naver_lowest_price: 14000,
    lowest_price_60d: 9750,
    discount_rate: 65,
    image_url: "https://images.unsplash.com/photo-1547592180-85f173990554",
    public_note: "16가지 자연재료 농축 코인육수 70알이 알당 139원.",
    pros: ["3분이면 깊은 육수 완성", "알당 139원 역대 최저가", "네이버 대비 4,250원 절약"]
  },
  {
    id: "unit-08",
    title: "일본 규슈 백화점 입점 생 낫또 40팩 세트",
    category: "신선식품/발효",
    unit_badge: "팩당 967원 무료배송",
    deal_price: 38690,
    market_single_price: 2000, // 팩당 2,000원
    total_units: 40,
    naver_lowest_price: 49000,
    lowest_price_60d: 38690,
    discount_rate: 52,
    image_url: "https://images.unsplash.com/photo-1540420773420-3366772f4999",
    public_note: "백화점 납품용 고급 규슈 생낫또 40팩 대용량이 팩당 967원.",
    pros: ["팩당 967원 편의점/마트 대비 반값", "나또키나아제 가득", "네이버 대비 10,310원 세이브"]
  }
];

async function publishUnitPriceBreakdownPost() {
  console.log("=================================================");
  console.log("   🔥 [개당 단가 파괴 가성비관] 대용량 묶음특가 발행");
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

  const targetPostId = "5958500708687351036"; // 5번째 단독 포스트를 단가 파괴관으로 갱신

  const magazineHtml = renderUnitPriceMagazineHtml(
    "[쿠팡 가성비 종결] 캔당 500원대 / 개당 800원대! 쟁여두면 이득인 대용량 묶음특가 BEST 8",
    "편의점이나 마트에서 낱개로 사면 손해인 제로탄산, 햇반, 신라면, 화장지, 코인육수 등 개당 단가를 60% 이상 파괴한 대용량 묶음 특가 모음입니다.",
    unitPrice8Deals
  );

  const updateRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${targetPostId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      kind: "blogger#post",
      title: "[쿠팡 가성비 종결] 캔당 500원대! 쟁여두면 이득인 대용량 묶음특가 BEST 8",
      content: magazineHtml,
      labels: ["쿠팡특가", "가성비특가", "묶음할인", "자취생필수품", "생필품특가", "가격비교"]
    })
  });

  const updateData = await updateRes.json();
  console.log(`✅ 개당 단가 파괴 가성비관 갱신 완료! (${updateData.url})`);

  // 전용 바이럴 스토리 팩 생성
  const viralText = `🔥 [가성비 미쳤다는 쿠팡 묶음 핫딜 TOP 5] 📦
(편의점 대비 최대 65% 저렴 / 개당 단가 역산 완료)

1️⃣ 광동 썬키스트 제로 355ml x 24캔
👉 12,860원 (캔당 535원 / 편의점 1,500원짜리)

2️⃣ CJ 햇반 210g x 36개
👉 29,800원 (개당 827원 / 편의점 1개 가격에 2개)

3️⃣ 농심 신라면 120g x 20봉 박스
👉 13,800원 (봉당 690원 무료배송)

4️⃣ 현대약품 미에로화이바 20병
👉 9,150원 (병당 457원)

5️⃣ 탐사 프리미엄 6겹 화장지 60롤
👉 19,800원 (롤당 330원)

👉 개당 단가 비교 & 대용량 묶음 담기:
${updateData.url}`;

  writeFileSync(resolve(process.cwd(), "public/unit_price_viral_clip.txt"), viralText, "utf-8");
  console.log("단가 파괴 바이럴 클립 저장 완료: public/unit_price_viral_clip.txt");

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
      console.log(`IndexNow 색인 완료 (${pingRes.status})`);
    } catch (e) {}
  }
}

publishUnitPriceBreakdownPost().catch(console.error);
