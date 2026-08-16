async function testFallcentApi() {
  const searchUrl = "https://fallcent.com/product/search/?keyword=%EC%BD%94%EC%B9%B4%EC%BD%9C%EB%9D%BC";
  console.log("폴센트 상품 검색 요청:", searchUrl);

  const res = await fetch(searchUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });

  console.log("Status:", res.status);
  const html = await res.text();
  console.log("Length:", html.length);

  // 상품 링크 및 가격 정보 추출
  const productLinks = Array.from(html.matchAll(/\/product\/([a-zA-Z0-9_-]{20,})\//g)).map(m => m[0]);
  console.log("검색된 폴센트 상품 ID 목록:", Array.from(new Set(productLinks)).slice(0, 5));

  // 첫 번째 상품 상세 페이지 진입 및 가격 그래프 API 확인
  if (productLinks.length > 0) {
    const firstProductUrl = `https://fallcent.com${productLinks[0]}`;
    console.log("\n첫 번째 상품 상세 조회:", firstProductUrl);
    const detailRes = await fetch(firstProductUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const detailHtml = await detailRes.text();
    console.log("Detail Status:", detailRes.status, "Length:", detailHtml.length);

    // Chart.js 데이터나 가격 이력 JSON 탐색
    const chartDataMatches = Array.from(detailHtml.matchAll(/(?:prices|chart_data|price_history|priceHistory|labels)\s*[:=]\s*(\[[^\]]+\]|\{[^\}]+\})/gi));
    console.log("발견된 가격 히스토리 데이터 패턴 수:", chartDataMatches.length);
    if (chartDataMatches.length > 0) {
      console.log("샘플 데이터:", chartDataMatches[0][0].slice(0, 200));
    }
  }
}

testFallcentApi().catch(console.error);
