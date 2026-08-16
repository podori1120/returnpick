async function inspectFallcentDomain() {
  const domains = [
    "https://fallcent.com",
    "https://api.fallcent.com",
    "https://app.fallcent.com",
    "https://server.fallcent.com",
    "https://fallcent.com/api",
    "https://fallcent.com/robots.txt",
    "https://fallcent.com/sitemap.xml"
  ];

  for (const url of domains) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json,text/html,*/*"
        }
      });
      const text = await res.text();
      console.log(`URL: ${url} | Status: ${res.status} | Length: ${text.length}`);
      if (res.status === 200 && text.length < 500) {
        console.log(`  -> 내용:`, text.trim());
      } else if (res.status === 200) {
        // 내부 JS 파일이나 API 경로 탐색
        const jsFiles = Array.from(text.matchAll(/src="([^"]+\.js[^"]*)"/g)).map(m => m[1]);
        const apiMatches = Array.from(text.matchAll(/(https?:\/\/[a-zA-Z0-9.-]+\/api\/[^\s"']+)/g)).map(m => m[1]);
        if (jsFiles.length) console.log(`  -> JS 스크립트 발견:`, jsFiles.slice(0, 3));
        if (apiMatches.length) console.log(`  -> API 경로 발견:`, apiMatches.slice(0, 3));
      }
    } catch (e) {
      console.log(`URL: ${url} | Error: ${e.message}`);
    }
  }
}

inspectFallcentDomain().catch(console.error);
