async function extractDetailScripts() {
  const detailUrl = "https://fallcent.com/product/KDyLq11HqiPNsdTzQ2lMR9yFBImhUnj6/";
  const res = await fetch(detailUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });

  const html = await res.text();
  const scripts = Array.from(html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)).map(m => m[1]);
  console.log("총 script 태그 수:", scripts.length);

  for (const [idx, s] of scripts.entries()) {
    if (s.includes("lowest_price") || s.includes("chart") || s.includes("Price") || s.includes("price")) {
      console.log(`\n--- [Script #${idx + 1}] ---`);
      console.log(s.slice(0, 500));
    }
  }
}

extractDetailScripts().catch(console.error);
