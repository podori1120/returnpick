function fnv1a(seed, timestamp) {
  const data = new Uint8Array(8);
  const view = new DataView(data.buffer);
  view.setUint32(0, seed >>> 0, false);
  view.setUint32(4, timestamp >>> 0, false);

  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

async function fetchFallcentPriceHistory(productPath) {
  console.log("=================================================");
  console.log(`폴센트 상품 가격 히스토리 API 역추적 테스트 (Fingerprint 포함)`);
  console.log("=================================================\n");

  // 1. 상품 상세 페이지 조회 및 세션 쿠키, seed, productId 추출
  const pageUrl = `https://fallcent.com${productPath}`;
  const pageRes = await fetch(pageUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });

  const rawCookies = pageRes.headers.getSetCookie ? pageRes.headers.getSetCookie() : [pageRes.headers.get("set-cookie") || ""];
  const cookieHeader = rawCookies.map(c => c.split(";")[0]).filter(Boolean).join("; ");
  console.log("획득된 세션 쿠키:", cookieHeader);

  const html = await pageRes.text();
  const seedMatch = html.match(/data-chart-seed="(\d+)"/);
  const productIdMatch = html.match(/data-chart-product-id="([^"]+)"/) || html.match(/\/product\/([a-zA-Z0-9_-]+)\//);
  const productName = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/)?.[1];

  console.log("상품명:", productName);
  console.log("Seed:", seedMatch?.[1]);
  console.log("Product ID:", productIdMatch?.[1]);

  if (!seedMatch || !productIdMatch) {
    console.error("Seed 또는 Product ID를 찾을 수 없습니다.");
    return;
  }

  const seed = parseInt(seedMatch[1], 10);
  const productId = productIdMatch[1];
  const ts = Math.floor(Date.now() / 1000);
  const challenge = fnv1a(seed, ts);
  
  // 쿠키에 있는 web_device_id 또는 32자리 핑거프린트 해시 사용
  const deviceIdMatch = cookieHeader.match(/web_device_id=([a-f0-9]{32})/);
  const fp = deviceIdMatch ? deviceIdMatch[1] : "3f31cb962f0f4e8dbede07b023ab0204";

  // 2. 폴센트 내부 가격 차트 API 호출
  const chartApiUrl = `https://fallcent.com/api/v1/products/chart/${productId}/?challenge=${challenge}&ts=${ts}&fp=${fp}`;
  console.log("\n차트 API 요청 주소:", chartApiUrl);

  const chartRes = await fetch(chartApiUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": pageUrl,
      "Cookie": cookieHeader,
      "Accept": "application/json, text/plain, */*",
      "X-Requested-With": "XMLHttpRequest"
    }
  });

  console.log("Chart API Status:", chartRes.status);
  const chartJson = await chartRes.json();
  console.log("\n=== [🎉 폴센트 실시간 가격 변동 히스토리 응답 성공!] ===");
  console.log(JSON.stringify(chartJson, null, 2));
}

// 코카콜라 상품으로 테스트
fetchFallcentPriceHistory("/product/KDyLq11HqiPNsdTzQ2lMR9yFBImhUnj6/").catch(console.error);
