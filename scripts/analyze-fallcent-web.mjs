async function analyzeFallcentWeb() {
  const res = await fetch("https://fallcent.com", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });

  const html = await res.text();
  console.log("fallcent.com HTML Length:", html.length);

  // 모든 form, action, api, fetch, ajax 경로 검색
  const formActions = Array.from(html.matchAll(/action="([^"]+)"/g)).map(m => m[1]);
  console.log("Form Actions:", formActions);

  const internalLinks = Array.from(html.matchAll(/href="(\/[^"]+)"/g)).map(m => m[1]);
  console.log("Internal Links (상위 15개):", Array.from(new Set(internalLinks)).slice(0, 15));

  // script 태그 내부의 URL 패턴 검색
  const scriptUrls = Array.from(html.matchAll(/(?:\/api\/|\/product\/|\/item\/|\/deal\/|\/search\/)[a-zA-Z0-9_\-\/]+/g)).map(m => m[0]);
  console.log("Script URL Patterns:", Array.from(new Set(scriptUrls)));

  // 텍스트 샘플
  const titles = Array.from(html.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi))
    .map(m => m[1].replace(/<[^>]+>/g, "").trim())
    .filter(t => t.length > 0);
  console.log("Headings:", titles.slice(0, 10));
}

analyzeFallcentWeb().catch(console.error);
