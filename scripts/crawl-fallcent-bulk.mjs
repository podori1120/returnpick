async function crawlFallcentRecommendations() {
  const urls = [
    "https://fallcent.com",
    "https://fallcent.com/product/recommend/?from=gnb",
    "https://fallcent.com/product/search/?keyword=%EC%8C%80",
    "https://fallcent.com/product/search/?keyword=%EB%9D%BC%EB%A9%B4",
    "https://fallcent.com/product/search/?keyword=%EC%9D%8C%EB%A3%8C",
    "https://fallcent.com/product/search/?keyword=%EC%83%9D%ED%95%84%ED%92%88",
    "https://fallcent.com/product/search/?keyword=%EA%B0%80%EC%A0%84",
    "https://fallcent.com/product/search/?keyword=%EB%85%B8%ED%8A%B8%EB%B6%81"
  ];

  const foundProductPaths = new Set();

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      const html = await res.text();
      const matches = Array.from(html.matchAll(/\/product\/([a-zA-Z0-9_-]{20,})\//g)).map(m => m[0]);
      matches.forEach(p => foundProductPaths.add(p));
      console.log(`URL: ${url} -> 발견된 상품 수: ${matches.length} (누적: ${foundProductPaths.size})`);
    } catch (e) {
      console.log(`URL: ${url} Error:`, e.message);
    }
  }

  console.log(`\n총 수집된 폴센트 고유 상품 ID 수: ${foundProductPaths.size}개`);
  return Array.from(foundProductPaths);
}

crawlFallcentRecommendations().catch(console.error);
