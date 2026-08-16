import { parseAlgumonCoupangDiscovery } from "@/lib/providers/algumonDiscoveryParser";

async function fetchAlgumonDeals() {
  console.log("알고몬 딜 수집 중...");
  const deals = [];
  
  // 메인 딜 목록 및 추가 페이지 탐색
  const urls = [
    "https://www.algumon.com/n/deal",
    "https://www.algumon.com/deal",
    "https://www.algumon.com/deal/more?page=1",
    "https://www.algumon.com/deal/more?page=2",
    "https://www.algumon.com/deal/more?page=3",
    "https://www.algumon.com/deal/more?page=4",
    "https://www.algumon.com/deal/more?page=5"
  ];

  for (const url of urls) {
    try {
      console.log(`요청 중: ${url}`);
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      if (!res.ok) {
        console.log(`[건너뜀] 상태 코드: ${res.status}`);
        continue;
      }
      const html = await res.text();
      const parsed = parseAlgumonCoupangDiscovery(html);
      console.log(`  -> 발견된 쿠팡 딜: ${parsed.length}개`);
      deals.push(...parsed);
    } catch (e) {
      console.error(`  -> 실패: ${e.message}`);
    }
  }

  // 중복 제거
  const uniqueDeals = [];
  const seen = new Set();
  for (const d of deals) {
    if (!seen.has(d.dealId)) {
      seen.add(d.dealId);
      uniqueDeals.push(d);
    }
  }

  console.log(`\n총 고유 쿠팡 딜 개수: ${uniqueDeals.length}개`);
  uniqueDeals.forEach((d, i) => {
    console.log(`[${i + 1}] ID: ${d.dealId} | ${d.title} | ${d.displayedPriceText || "가격 미표시"} | 생성일: ${d.sourceCreatedAt || "미상"}`);
  });
}

fetchAlgumonDeals().catch(console.error);
