async function printFullJsonLd() {
  const res = await fetch("https://www.algumon.com/n/deal", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  const html = await res.text();
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (jsonLdMatch) {
    console.log(jsonLdMatch[1].slice(0, 1500));
  }
}

printFullJsonLd().catch(console.error);
