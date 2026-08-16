async function checkDealDetailFollow(dealId) {
  const url = `https://www.algumon.com/n/deal/${dealId}`;
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  const html = await res.text();
  console.log(`\n=== Deal ${dealId} === Status: ${res.status}, Final URL: ${res.url}, (HTML length: ${html.length})`);
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  console.log("Title:", titleMatch ? titleMatch[1] : "N/A");
  
  const textSample = html.slice(0, 500);
  console.log("Sample:", textSample);
}

checkDealDetailFollow("1024372").catch(console.error);
