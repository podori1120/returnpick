async function dumpCanvasChart() {
  const detailUrl = "https://fallcent.com/product/KDyLq11HqiPNsdTzQ2lMR9yFBImhUnj6/";
  const res = await fetch(detailUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });

  const html = await res.text();
  
  // canvas 태그 추출
  const canvasMatches = Array.from(html.matchAll(/<canvas[^>]*>/gi)).map(m => m[0]);
  console.log("Canvas 태그 목록:");
  canvasMatches.forEach((c, i) => console.log(`[${i+1}]`, c));

  // data-chart 또는 data-chart-seed 속성 추출
  const dataChart = html.match(/data-chart="([^"]+)"/)?.[1];
  const dataChartSeed = html.match(/data-chart-seed="([^"]+)"/)?.[1];
  console.log("\ndata-chart 존재 여부:", !!dataChart);
  if (dataChart) {
    const decoded = dataChart.replace(/&quot;/g, '"');
    console.log("data-chart 실제 데이터:", decoded.slice(0, 500));
  }
  console.log("data-chart-seed:", dataChartSeed);
}

dumpCanvasChart().catch(console.error);
