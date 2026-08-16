async function testAlgumonSearch() {
  const searchUrls = [
    "https://www.algumon.com/n/deal/search?q=%EC%BF%A0%ED%8C%A1", // 쿠팡
    "https://www.algumon.com/api/v1/deals?search=%EC%BF%A0%ED%8C%A1",
    "https://www.algumon.com/api/deals",
    "https://www.algumon.com/n/deal/shop/coupang",
    "https://www.algumon.com/n/deal/1024372"
  ];

  for (const url of searchUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      console.log(`URL: ${url} -> Status: ${res.status}, Type: ${res.headers.get("content-type")}`);
      const text = await res.text();
      console.log(`  Length: ${text.length}, Contains 쿠팡: ${text.includes("쿠팡")}`);
      if (text.includes("쿠팡")) {
        let idx = text.indexOf("쿠팡");
        console.log(`  Snippet:`, text.slice(Math.max(0, idx - 50), Math.min(text.length, idx + 150)));
      }
    } catch (e) {
      console.log(`URL: ${url} -> Error: ${e.message}`);
    }
  }
}

testAlgumonSearch().catch(console.error);
