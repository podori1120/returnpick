async function extractDealsFromMain() {
  const res = await fetch("https://www.algumon.com/n/deal", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  const html = await res.text();
  
  // JSON-LD 안에 CollectionPage 아이템들이 들어있는지 확인
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (jsonLdMatch) {
    try {
      const data = JSON.parse(jsonLdMatch[1]);
      console.log("JSON-LD Structure:", Object.keys(data));
      if (data.itemListElement || data.hasPart || data.about) {
        console.log("Found structured items:", JSON.stringify(data).slice(0, 500));
      }
    } catch (e) {
      console.log("JSON-LD parse error:", e);
    }
  }

  // HTML 내 /n/deal/ 링크들과 텍스트 패턴 추출
  const dealPattern = /href="\/n\/deal\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  const items = [];
  while ((match = dealPattern.exec(html)) !== null) {
    const dealId = match[1];
    const rawContent = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    items.push({ dealId, rawContent });
  }

  console.log(`\n발견된 개별 딜 링크 개수: ${items.length}개`);
  items.slice(0, 15).forEach((item, idx) => {
    console.log(`[${idx + 1}] ID: ${item.dealId} | 내용: ${item.rawContent}`);
  });
}

extractDealsFromMain().catch(console.error);
