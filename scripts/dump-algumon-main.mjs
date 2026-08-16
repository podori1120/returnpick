async function dumpAlgumonMain() {
  const res = await fetch("https://www.algumon.com/n/deal", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
    }
  });

  const html = await res.text();
  console.log("Status:", res.status);
  console.log("Length:", html.length);
  
  // 모든 a 태그와 href 분석
  const hrefs = Array.from(html.matchAll(/href="([^"]+)"/g)).map(m => m[1]);
  console.log("Total hrefs:", hrefs.length);
  const dealHrefs = hrefs.filter(h => h.includes("/deal/"));
  console.log("Deal hrefs:", dealHrefs);

  // 모든 텍스트 청크 중 상품명/가격/쇼핑몰명 패턴 탐색
  const spanAndDivs = Array.from(html.matchAll(/<(?:span|div|p|h\d|a)[^>]*>([\s\S]*?)<\/(?:span|div|p|h\d|a)>/gi))
    .map(m => m[1].replace(/<[^>]+>/g, "").trim())
    .filter(t => t.length > 2 && t.length < 150);
  
  console.log("\n텍스트 샘플 (상위 30개):");
  spanAndDivs.slice(0, 30).forEach((t, i) => console.log(`[${i+1}] ${t}`));
}

dumpAlgumonMain().catch(console.error);
