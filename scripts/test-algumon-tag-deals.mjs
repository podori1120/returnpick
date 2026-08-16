async function testAlgumonTags() {
  const urls = [
    "https://www.algumon.com/n/deal?q=%EC%BF%A0%ED%8C%A1",
    "https://www.algumon.com/n/deal?shop=%EC%BF%A0%ED%8C%A1",
    "https://www.algumon.com/n/deal?market=%EC%BF%A0%ED%8C%A1",
    "https://www.algumon.com/n/deal?site=%EC%BF%A0%ED%8C%A1"
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      const html = await res.text();
      console.log(`URL: ${url} | Status: ${res.status} | Length: ${html.length}`);
      
      // 게시글 링크 패턴 /n/deal/\d+ 확인
      const dealIds = Array.from(html.matchAll(/\/n\/deal\/(\d+)/g)).map(m => m[1]);
      console.log(`  -> 발견된 deal IDs (${dealIds.length}개):`, Array.from(new Set(dealIds)).slice(0, 10));
    } catch (e) {
      console.log(`URL: ${url} | Error: ${e.message}`);
    }
  }
}

testAlgumonTags().catch(console.error);
