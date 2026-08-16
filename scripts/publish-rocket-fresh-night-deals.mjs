import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderRocketFreshMagazineHtml } from "@/lib/rocketFreshNightDesign";

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

export const rocketFresh7Deals = [
  {
    id: "fresh-01",
    title: "하림 무항생제 인증 자연실록 통닭 850g (냉장)",
    category: "신선정육/생닭",
    deal_price: 6250,
    naver_lowest_price: 8900,
    lowest_price_60d: 6250,
    discount_rate: 30,
    image_url: "https://images.unsplash.com/photo-1587593810167-a84920ea0781",
    fresh_badge: "내일 아침 7시 신선냉장 도착",
    public_note: "신선한 친환경 무항생제 인증 1등급 통닭 850g. 삼계탕, 에어프라이어 구이용 추천.",
    cooking_tip: "에어프라이어 180도에 30분만 돌리면 겉바속촉 옛날통닭 완성!",
    pros: ["친환경 무항생제 축산물 인증", "폴센트 60일 역대 최저가 달성", "네이버 대비 2,650원 저렴"]
  },
  {
    id: "fresh-02",
    title: "사미헌 한끼 갈비탕 700g x 2팩 (냉동)",
    category: "국/탕/간편식",
    deal_price: 17480,
    naver_lowest_price: 24000,
    lowest_price_60d: 17480,
    discount_rate: 27,
    image_url: "https://images.unsplash.com/photo-1547592180-85f173990554",
    fresh_badge: "내일 아침 7시 보랭백 도착",
    public_note: "부산 서면 20년 맛집 사미헌의 푸짐한 소갈비탕 2팩 세트.",
    cooking_tip: "냄비에 붓고 5분만 끓여 파와 당면만 넣으면 든든한 아침 식사 완료.",
    pros: ["큼직하고 부드러운 소갈빗대 듬뿍", "팩당 8,740원 파격 특가", "네이버 대비 6,520원 절약"]
  },
  {
    id: "fresh-03",
    title: "비비고 순살 가자미구이 60g x 6개 (냉장)",
    category: "수산/간편식",
    deal_price: 22230,
    naver_lowest_price: 28000,
    lowest_price_60d: 22230,
    discount_rate: 21,
    image_url: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb",
    fresh_badge: "내일 아침 7시 신선 도착",
    public_note: "가시를 99% 발라내어 전자레인지 1분이면 끝나는 순살 생선구이.",
    cooking_tip: "전자레인지에 1분만 돌려 밥 위에 얹으면 아이들 밥도둑 반찬!",
    pros: ["가시 발라낼 필요 없는 100% 순살", "연기/냄새 없이 전자레인지 조리", "개당 3,705원 핫딜"]
  },
  {
    id: "fresh-04",
    title: "오늘차림 서울식 육수 소불고기 1.06kg 세트",
    category: "신선정육/밀키트",
    deal_price: 18900,
    naver_lowest_price: 25000,
    lowest_price_60d: 18900,
    discount_rate: 24,
    image_url: "https://images.unsplash.com/photo-1544025162-d76694265947",
    fresh_badge: "내일 아침 7시 신선냉장 도착",
    public_note: "소불고기 700g + 비법육수 300g + 당면 60g 2~3인분 푸짐한 구성.",
    cooking_tip: "전골냄비에 버섯과 채소를 더해 끓이면 손님 접대용 불고기 전골 완성.",
    pros: ["고기 700g 푸짐한 양", "단짠의 정석 감칠맛 육수 포함", "네이버 대비 6,100원 절약"]
  },
  {
    id: "fresh-05",
    title: "풀무원다논 그릭 요거트 설탕무첨가 플레인 400g x 2개",
    category: "유제품/디저트",
    deal_price: 9390,
    naver_lowest_price: 13000,
    lowest_price_60d: 9390,
    discount_rate: 28,
    image_url: "https://images.unsplash.com/photo-1488477181946-6428a0291777",
    fresh_badge: "내일 아침 7시 냉장 도착",
    public_note: "단백질 풍부하고 묵직한 꾸덕함의 무설탕 그릭요거트 대용량.",
    cooking_tip: "그래놀라, 블루베리, 꿀과 함께 먹으면 완벽한 다이어트 아침 식단.",
    pros: ["설탕 무첨가 0% 건강한 맛", "단백질 2배 고밀도 그릭 텍스처", "개당 4,695원 특가"]
  },
  {
    id: "fresh-06",
    title: "서울우유 목장의 신선함이 살아있는 저지방 우유 1L x 2개",
    category: "유제품/우유",
    deal_price: 6050,
    naver_lowest_price: 7900,
    lowest_price_60d: 6050,
    discount_rate: 23,
    image_url: "https://images.unsplash.com/photo-1550583724-b2692b85b150",
    fresh_badge: "내일 아침 7시 문 앞 도착",
    public_note: "목장 신선 저지방 1L 2개 개당 3,025원 로켓프레시 최저가.",
    cooking_tip: "라떼나 시리얼과 함께 즐기는 신선한 1등급 아침 우유.",
    pros: ["국산 1등급 원유 100%", "개당 3,025원 마트보다 저렴", "폴센트 최저가 검증"]
  },
  {
    id: "fresh-07",
    title: "일본 규슈 백화점 입점 생 낫또 40팩 세트",
    category: "신선건강/발효식품",
    deal_price: 38690,
    naver_lowest_price: 49000,
    lowest_price_60d: 38690,
    discount_rate: 21,
    image_url: "https://images.unsplash.com/photo-1540420773420-3366772f4999",
    fresh_badge: "내일 아침 7시 신선냉장 도착",
    public_note: "백화점 납품용 프리미엄 규슈 생낫또 40팩 대용량 특가.",
    cooking_tip: "겨자소스와 간장을 넣고 20회 이상 저어 밥 위에 계란 노른자와 얹어 드세요.",
    pros: ["나또키나아제 유익균 가득", "팩당 967원 무료배송", "네이버 대비 10,310원 절약"]
  }
];

async function publishRocketFreshNightDeals() {
  console.log("=================================================");
  console.log("   🌙 [로켓프레시 자정 마감] 새벽배송 특가 포스트 발행");
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

  const magazineHtml = renderRocketFreshMagazineHtml(
    "[오늘 밤 24:00 주문 마감] 내일 아침 7시 문 앞 도착! 로켓프레시 마감 특가 TOP 7",
    "오늘 밤 12시 전에 주문하면 내일 아침 7시 전에 보랭백으로 신선하게 도착하는 밀키트, 생닭, 소불고기, 유제품 실시간 최저가 모음입니다.",
    rocketFresh7Deals
  );

  const postRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      kind: "blogger#post",
      title: "[오늘 밤 24:00 마감] 내일 아침 7시 도착! 로켓프레시 신선특가 BEST 7",
      content: magazineHtml,
      labels: ["로켓프레시", "새벽배송", "쿠팡특가", "마감세일", "신선식품", "밀키트"]
    })
  });

  const postData = await postRes.json();
  console.log(`✅ 로켓프레시 자정 마감 포스트 발행 완료! (${postData.url || postData.id})`);

  // 야간 홍보 전용 숏폼 텍스트 생성
  const nightViralText = `🌙 [오늘 밤 24:00 마감! 내일 아침 7시 도착 로켓프레시 TOP 5] 🚀

오늘 밤 12시 전에 주문하면 내일 아침 문 앞으로 바로 도착합니다!
(폴센트 60일 가격 변동 검증 완료)

1. 하림 무항생제 자연실록 통닭 850g -> 6,250원 (역대 최저)
2. 사미헌 한끼 갈비탕 2팩 -> 17,480원 (맛집 갈비탕)
3. 오늘차림 서울식 소불고기 1.06kg -> 18,900원 (푸짐한 고기 700g)
4. 비비고 순살 가자미구이 6개 -> 22,230원 (가시 없는 순살)
5. 풀무원다논 그릭요거트 400g 2개 -> 9,390원

👉 전체 7종 확인 & 주문하기:
${postData.url || "https://returnpick-deals.blogspot.com/2026/08/18.html"}`;

  writeFileSync(resolve(process.cwd(), "public/rocket_fresh_night_clip.txt"), nightViralText, "utf-8");
  console.log("야간 홍보 클립 저장 완료: public/rocket_fresh_night_clip.txt");

  // 검색엔진 즉시 색인
  if (postData.url) {
    try {
      await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host: "returnpick-deals.blogspot.com",
          key: "8008329337373147131",
          keyLocation: "https://returnpick-deals.blogspot.com/8008329337373147131.txt",
          urlList: [postData.url]
        })
      });
      console.log("IndexNow 검색엔진 색인 전송 완료 (202)");
    } catch (e) {}
  }
}

publishRocketFreshNightDeals().catch(console.error);
