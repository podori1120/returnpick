import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderRefurbishedTechMagazineHtml } from "@/lib/refurbishedTechDesign";

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

export const refurbishedTech8Deals = [
  {
    id: "refurb-01",
    title: "HP 2026 넥소스 14 가성비 노트북 (i5-1334U 16GB 512GB SSD)",
    category: "노트북/PC",
    return_grade: "반품-미개봉 정품",
    deal_price: 589000,
    new_product_price: 790000,
    naver_lowest_price: 740000,
    lowest_price_60d: 589000,
    discount_rate: 25,
    image_url: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed",
    public_note: "단순 박스 훼손 반품-미개봉 상태. i5 16GB 512GB 완벽 스펙 50만원대.",
    inspection_point: "박스 봉인 씰 미개봉 확인, 내부 본체 100% 미사용 신품 상태.",
    pros: ["16GB RAM + 512GB SSD 완벽 사무용 스펙", "새상품 대비 20.1만원 파격 세이브", "쿠팡 30일 무료반품 보증"]
  },
  {
    id: "refurb-02",
    title: "삼성전자 스마트 인버터 제습기 18L AY18CG7500G",
    category: "생활가전",
    return_grade: "반품-최상급",
    deal_price: 318000,
    new_product_price: 445000,
    naver_lowest_price: 395000,
    lowest_price_60d: 318000,
    discount_rate: 28,
    image_url: "https://images.unsplash.com/photo-1585771724684-38269d6639fd",
    public_note: "1등급 에너지 인버터 저소음 대용량 제습기 반품-최상 30만원대.",
    inspection_point: "단순 변심 1회 개봉 반품, 외관 흠집 전무 및 정상 작동 확인.",
    pros: ["1등급 초절전 인버터 컴프레서", "새상품 대비 12.7만원 절약", "18L 거실 전체 커버"]
  },
  {
    id: "refurb-03",
    title: "SK하이닉스 Platinum P41 M.2 NVMe SSD 2TB",
    category: "컴퓨터부품",
    return_grade: "반품-미개봉 정품",
    deal_price: 198000,
    new_product_price: 265000,
    naver_lowest_price: 255000,
    lowest_price_60d: 198000,
    discount_rate: 25,
    image_url: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b",
    public_note: "PCIe 4.0 7,000MB/s 극강의 저발열 플래그십 2TB SSD.",
    inspection_point: "정품 홀로그램 스티커 미개봉 패키지 상태 완벽 유지.",
    pros: ["압도적인 2TB 대용량과 읽기 7,000MB/s", "새상품 대비 6.7만원 절약", "PS5 및 데스크탑 완벽 호환"]
  },
  {
    id: "refurb-04",
    title: "올도큐브 iPlay70 mini pro 8.4인치 LTE 태블릿 8GB",
    category: "태블릿/모바일",
    return_grade: "반품-최상급",
    deal_price: 179000,
    new_product_price: 245000,
    naver_lowest_price: 229000,
    lowest_price_60d: 179000,
    discount_rate: 27,
    image_url: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0",
    public_note: "Helio G99 탑재 한 손에 잡히는 LTE 8.4인치 태블릿.",
    inspection_point: "액정 보호필름 부착 상태 반품, 배터리 사이클 0~1회 신품급.",
    pros: ["LTE 유심 지원 휴대용 태블릿", "새상품 대비 6.6만원 세이브", "유튜브, 내비게이션, 독서용 최적"]
  },
  {
    id: "refurb-05",
    title: "ZEUSLAP 16인치 2.5K 144Hz 초경량 포터블 모니터",
    category: "모니터/디스플레이",
    return_grade: "반품-최상급",
    deal_price: 112000,
    new_product_price: 169000,
    naver_lowest_price: 155000,
    lowest_price_60d: 112000,
    discount_rate: 34,
    image_url: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf",
    public_note: "2560x1600 고해상도 144Hz 게이밍 IPS 패널 포터블 모니터.",
    inspection_point: "무결점 패널 확인 완료, C타입 케이블 및 마그네틱 커버 풀구성.",
    pros: ["16인치 2.5K 고해상도 144Hz 패널", "새상품 대비 5.7만원 절약", "노트북 듀얼모니터 & 닌텐도 스위치 연결"]
  },
  {
    id: "refurb-06",
    title: "커세어 CORSAIR SF750 80PLUS Platinum 풀모듈러 파워",
    category: "컴퓨터부품",
    return_grade: "반품-최상급",
    deal_price: 209000,
    new_product_price: 275000,
    naver_lowest_price: 265000,
    lowest_price_60d: 209000,
    discount_rate: 24,
    image_url: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c",
    public_note: "ITX 빌드의 명품 플래티넘 고효율 SFX 파워서플라이.",
    inspection_point: "모든 슬리빙 케이블 구성품 누락 없음 확인.",
    pros: ["80PLUS 플래티넘 인증 극강 효율", "새상품 대비 6.6만원 세이브", "조용한 제로팬 모드 탑재"]
  },
  {
    id: "refurb-07",
    title: "샤크 에보파워 시스템 부스트+ 프리미엄 스틱청소기",
    category: "생활가전",
    return_grade: "반품-최상급",
    deal_price: 649000,
    new_product_price: 850000,
    naver_lowest_price: 799000,
    lowest_price_60d: 649000,
    discount_rate: 24,
    image_url: "https://images.unsplash.com/photo-1558317374-067fb5f30001",
    public_note: "플렉스 접이식 파이프와 자동 먼지비움 스테이션 무선청소기.",
    inspection_point: "먼지통 및 브러시 헤드 미사용 클린 상태 확인.",
    pros: ["허리 숙이지 않는 꺾임 관절 파이프", "새상품 대비 20.1만원 대폭 세이브", "스마트 센서 흡입력 자동 조절"]
  },
  {
    id: "refurb-08",
    title: "젠하이저 모멘텀 4 와이어리스 노이즈캔슬링 헤드폰",
    category: "음향가전",
    return_grade: "반품-최상급",
    deal_price: 298000,
    new_product_price: 429000,
    naver_lowest_price: 379000,
    lowest_price_60d: 298000,
    discount_rate: 31,
    image_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
    public_note: "60시간 연속 재생과 최상급 하이파이 음질의 ANC 무선 헤드폰.",
    inspection_point: "이어패드 흠집 전무, 정품 하드케이스 및 오디오 케이블 포함.",
    pros: ["압도적인 60시간 배터리 타임", "새상품 대비 13.1만원 절약", "젠하이저 독보적인 음질"]
  }
];

async function publishRefurbishedTechPost() {
  console.log("=================================================");
  console.log("   💎 [쿠팡 반품특가] 박스 미개봉/최상급 전자기기 발행");
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

  const targetPostId = "5041237301912454229"; // 전자기기/홈트 단독 포스트

  const magazineHtml = renderRefurbishedTechMagazineHtml(
    "[쿠팡 반품특가] 박스 미개봉/최상급 전자기기 & 가전 BEST 8 (새상품 대비 최대 20만원 절약)",
    "단순 변심 또는 박스 훼손으로 새상품 대비 최대 20만 원 이상 저렴하게 풀린 노트북, 제습기, SSD, 태블릿, 무선청소기 실시간 반품 특가 모음입니다.",
    refurbishedTech8Deals
  );

  const updateRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${targetPostId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      kind: "blogger#post",
      title: "[쿠팡 반품특가] 박스 미개봉/최상급 전자기기 & 가전 BEST 8",
      content: magazineHtml,
      labels: ["쿠팡반품", "반품특가", "가전특가", "노트북특가", "가격비교", "리퍼비시"]
    })
  });

  const updateData = await updateRes.json();
  console.log(`✅ 반품특가 전용 포스트 갱신 완료! (${updateData.url})`);

  // 전용 바이럴 클립 생성
  const viralText = `💎 [쿠팡 반품-미개봉/최상급 전자기기 특가 BEST 5] 🚀
(새상품 대비 최대 20만원 세이브 / 30일 무료반품 보증)

1. HP 넥소스 14 가성비 노트북 (16G/512G)
- 반품가: 589,000원 (새상품 대비 20.1만원 절약!)

2. 삼성전자 인버터 제습기 18L 대용량
- 반품가: 318,000원 (새상품 대비 12.7만원 절약!)

3. 젠하이저 모멘텀 4 무선 헤드폰
- 반품가: 298,000원 (새상품 대비 13.1만원 절약!)

4. SK하이닉스 Platinum P41 2TB NVMe SSD
- 반품가: 198,000원 (새상품 대비 6.7만원 절약!)

5. 올도큐브 iPlay70 mini pro 8.4인치 태블릿
- 반품가: 179,000원 (새상품 대비 6.6만원 절약!)

👉 실시간 반품 재고 및 상태 확인:
${updateData.url}`;

  writeFileSync(resolve(process.cwd(), "public/refurbished_tech_viral_clip.txt"), viralText, "utf-8");
  console.log("반품특가 홍보 클립 저장 완료: public/refurbished_tech_viral_clip.txt");

  // 검색엔진 즉시 색인
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

publishRefurbishedTechPost().catch(console.error);
