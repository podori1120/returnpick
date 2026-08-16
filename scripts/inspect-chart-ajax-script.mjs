async function inspectChartAjaxScript() {
  const detailUrl = "https://fallcent.com/product/KDyLq11HqiPNsdTzQ2lMR9yFBImhUnj6/";
  const res = await fetch(detailUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });

  const html = await res.text();
  const script19 = Array.from(html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi))
    .map(m => m[1])
    .find(s => s.includes("v2/price_chart"));

  console.log("=== [Script #19 price_chart AJAX 전체 소스] ===");
  console.log(script19);
}

inspectChartAjaxScript().catch(console.error);
