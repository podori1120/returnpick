import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderUltraHighValueMagazineHtml } from "@/lib/ultraHighValueTechDesign";

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

export const ultraHighValue5Deals = [
  {
    id: "high-01",
    title: "Apple 2024 맥북 에어 15 M3 칩 (16GB RAM, 512GB SSD)",
    category: "애플/노트북",
    deal_price: 1890000,
    origin_price: 2160000,
    naver_lowest_price: 2050000,
    lowest_price_60d: 1890000,
    discount_rate: 13,
    image_url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8",
    public_note: "M3 칩셋 16GB 기본 탑재형 15인치 맥북 에어. 학생 및 영상편집용 끝판왕.",
    stock_remain: 3,
    card_benefit: "국민/삼성/신한 최대 10% 추가할인",
    pros: ["15.3인치 리퀴드 레티나 대화면", "M3 칩셋의 압도적 배터리 타임 (18시간)", "네이버 최저가 대비 16만원 파격 절약"]
  },
  {
    id: "high-02",
    title: "LG전자 65인치 4K UHD 올레드 OLED TV (스탠드형 무료설치)",
    category: "대형가전/TV",
    deal_price: 1690000,
    origin_price: 2200000,
    naver_lowest_price: 1950000,
    lowest_price_60d: 1690000,
    discount_rate: 23,
    image_url: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1",
    public_note: "자발광 4K 올레드 패널과 알파9 AI 프로세서 탑재 프리미엄 스마트 TV.",
    stock_remain: 2,
    card_benefit: "로켓설치 내일 도착 및 무료 폐가전 수거",
    pros: ["완벽한 블랙 표현 자발광 올레드", "돌비 비전 & 돌비 애트모스 극장급 사운드", "네이버 대비 26만원 세이브"]
  },
  {
    id: "high-03",
    title: "삼성전자 비스포크 AI 콤보 올인원 세탁건조기 25kg+15kg",
    category: "대형가전/세탁기",
    deal_price: 2890000,
    origin_price: 3790000,
    naver_lowest_price: 3290000,
    lowest_price_60d: 2890000,
    discount_rate: 24,
    image_url: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1",
    public_note: "세탁 후 건조까지 세탁물 이동 없이 99분 만에 끝내는 차세대 올인원 콤보.",
    stock_remain: 4,
    card_benefit: "최대 24개월 무이자 + 로켓설치",
    pros: ["세탁물 옮길 필요 없는 올인원 원스톱", "대용량 25kg 세탁 + 15kg 건조", "네이버 대비 40만원 파격 할인"]
  },
  {
    id: "high-04",
    title: "HP 오멘 OMEN 16 게이밍 노트북 (i7-14700HX RTX 4070 QHD 240Hz)",
    category: "게이밍/노트북",
    deal_price: 1949000,
    origin_price: 2490000,
    naver_lowest_price: 2250000,
    lowest_price_60d: 1949000,
    discount_rate: 22,
    image_url: "https://images.unsplash.com/photo-1603302576837-37561b2e2302",
    public_note: "i7 14세대와 RTX 4070, QHD 240Hz 초고주사율 하이엔드 게이밍 노트북.",
    stock_remain: 5,
    card_benefit: "카드사 5% 즉시할인 + 무이자 22개월",
    pros: ["RTX 4070 8GB 강력한 3D 그래픽", "QHD 240Hz 프로 게이머용 디스플레이", "네이버 대비 30.1만원 절약"]
  },
  {
    id: "high-05",
    title: "로보락 S8 Pro Ultra 올인원 로봇청소기 (열풍건조 물걸레 세척)",
    category: "스마트가전",
    deal_price: 1420000,
    origin_price: 1690000,
    naver_lowest_price: 1550000,
    lowest_price_60d: 1420000,
    discount_rate: 16,
    image_url: "https://images.unsplash.com/photo-1558317374-067fb5f30001",
    public_note: "먼지비움, 물걸레 세척, 열풍 건조까지 100% 전자동 끝판왕 로봇청소기.",
    stock_remain: 3,
    card_benefit: "쿠팡 직수입 공식 2년 무상 AS",
    pros: ["완전 무인 자동 물걸레 세척 & 건조", "6,000Pa 압도적 흡입력", "네이버 대비 13만원 절약"]
  }
];

async function publishUltraHighValueDeals() {
  console.log("=================================================");
  console.log("   💰 [VIP 프리미엄 가전관] 100~200만원대 초고단가 발행");
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

  const targetPostId = "7685606082388474435"; // 단독 포스트를 VIP 가전관으로 갱신

  const magazineHtml = renderUltraHighValueMagazineHtml(
    "[쿠팡 VIP 특가] 100~200만원대 프리미엄 가전 &amp; 애플/게이밍 빅세일 BEST 5 (최대 40만원 절약)",
    "맥북 에어 15인치, LG 올레드 TV, 비스포크 AI 콤보 세탁건조기, 오멘 16 게이밍 노트북, 로보락 S8 Pro Ultra 등 초고단가 프리미엄 가전 실시간 역대급 할인 모음입니다.",
    ultraHighValue5Deals
  );

  const updateRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${targetPostId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      kind: "blogger#post",
      title: "[쿠팡 VIP 특가] 100~200만원대 프리미엄 가전 & 애플 빅세일 BEST 5",
      content: magazineHtml,
      labels: ["쿠팡특가", "맥북에어", "올레드TV", "로보락", "게이밍노트북", "가전특가"]
    })
  });

  const updateData = await updateRes.json();
  console.log(`✅ VIP 초고단가 가전관 갱신 완료! (${updateData.url})`);

  // 초공격적 커뮤니티 바이럴 텍스트 팩 생성
  const aggressiveViralText = `🔥 [긴급 핫딜] 100만원대 프리미엄 가전/애플 가격 붕괴 TOP 5!
(카드사 최대 10% 추가할인 + 24개월 무이자 할부 지원)

1️⃣ Apple 맥북 에어 15인치 M3 (16G/512G)
👉 189만원 (네이버 대비 16만원 저렴 / 품절 임박)

2️⃣ LG전자 65인치 4K OLED 올레드 TV (스탠드/무료설치)
👉 169만원 (네이버 대비 26만원 세이브!)

3️⃣ 삼성 비스포크 AI 콤보 세탁건조기 (25kg+15kg)
👉 289만원 (정가 대비 90만원 할인 / 세탁기+건조기 일체형)

4️⃣ HP 오멘 16 게이밍 노트북 (i7-14700HX / RTX 4070 / QHD 240Hz)
👉 194.9만원 (네이버 대비 30.1만원 절약)

5️⃣ 로보락 S8 Pro Ultra 올인원 로봇청소기
👉 142만원 (열풍건조 + 전자동 물걸레 세척)

👉 실시간 재고 & 카드사 무이자 혜택 확인:
${updateData.url}`;

  writeFileSync(resolve(process.cwd(), "public/aggressive_viral_deal_pack.txt"), aggressiveViralText, "utf-8");
  console.log("초공격적 바이럴 팩 저장 완료: public/aggressive_viral_deal_pack.txt");

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

publishUltraHighValueDeals().catch(console.error);
