async function dumpChartData() {
  const detailUrl = "https://fallcent.com/product/KDyLq11HqiPNsdTzQ2lMR9yFBImhUnj6/";
  const res = await fetch(detailUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });

  const html = await res.text();
  
  // chartData 스크립트 블록 추출
  const scriptMatch = html.match(/const\s+chartData\s*=\s*(\{[\s\S]*?\});/);
  if (scriptMatch) {
    console.log("=== [발견된 폴센트 실제 가격 변동 차트 데이터 (chartData)] ===");
    console.log(scriptMatch[1].slice(0, 800));
  } else {
    // JSON.parse 패턴 탐색
    const jsonMatches = Array.from(html.matchAll(/JSON\.parse\(['"]([\s\S]*?)['"]\)/g)).map(m => m[1]);
    console.log("JSON.parse matches:", jsonMatches.length);
  }

  // 상품 기본 메타 (상품명, 현재가, 역대 최저가 등)
  const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/)?.[1];
  const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/)?.[1];
  const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/)?.[1];
  console.log("\n상품명:", ogTitle);
  console.log("설명:", ogDesc);
  console.log("이미지:", ogImage);
}

dumpChartData().catch(console.error);
