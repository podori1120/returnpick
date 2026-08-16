import puppeteer from "puppeteer";

async function dumpGeneratorDom() {
  const browser = await puppeteer.connect({
    browserURL: "http://127.0.0.1:9222",
    defaultViewport: null
  });

  const page = await browser.newPage();
  await page.goto("https://partners.coupang.com/#affiliate/ws/link-generator", { waitUntil: "domcontentloaded" });
  await new Promise(r => setTimeout(r, 4000));

  const inputs = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("input, textarea, button, form"));
    return all.map(el => ({
      tag: el.tagName,
      id: el.id,
      className: el.className,
      placeholder: el.placeholder || "",
      text: el.innerText || el.textContent || ""
    }));
  });

  console.log("탐색된 입력/버튼 엘리먼트:", JSON.stringify(inputs.slice(0, 20), null, 2));
  await page.close();
}

dumpGeneratorDom().catch(console.error);
