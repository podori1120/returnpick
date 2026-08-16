async function probeAlgumonData() {
  const urls = [
    "https://www.algumon.com/n/deal",
    "https://www.algumon.com/n/deal/__data.json",
    "https://www.algumon.com/n/__data.json",
    "https://www.algumon.com/api/deals",
    "https://www.algumon.com/rss",
    "https://www.algumon.com/feed",
    "https://www.algumon.com/sitemap.xml"
  ];

  for (const u of urls) {
    try {
      const res = await fetch(u, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/html, application/xml, */*"
        }
      });
      console.log(`URL: ${u} | Status: ${res.status} | Content-Type: ${res.headers.get("content-type")}`);
      const text = await res.text();
      console.log(`  Length: ${text.length} | Preview: ${text.slice(0, 150).replace(/\n/g, " ")}`);
      if (text.includes("쿠팡") || text.includes("coupang")) {
        console.log(`  🔥 Found '쿠팡' or 'coupang' in ${u}! Count: ${(text.match(/쿠팡|coupang/gi) || []).length}`);
      }
    } catch (e) {
      console.log(`URL: ${u} | Error: ${e.message}`);
    }
  }
}

probeAlgumonData().catch(console.error);
