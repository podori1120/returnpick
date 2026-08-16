async function checkNextData() {
  const res = await fetch("https://www.algumon.com/n/deal", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  const html = await res.text();
  
  // 어떤 script 태그가 있는지 확인
  const scriptMatches = html.match(/<script[\s\S]*?<\/script>/gi) || [];
  console.log("script 태그 개수:", scriptMatches.length);
  scriptMatches.forEach((s, idx) => {
    if (s.includes("deals") || s.includes("items") || s.includes("post") || s.includes("json")) {
      console.log(`\n[스크립트 ${idx+1}] (길이: ${s.length})`, s.slice(0, 300));
    }
  });

  // 검색 API나 핫딜 URL 확인
  const links = html.match(/href="\/[a-zA-Z0-9_\-\/]+"/g) || [];
  console.log("\n발견된 내부 링크 샘플:", Array.from(new Set(links)).slice(0, 20));
}

checkNextData().catch(console.error);
