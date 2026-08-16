import puppeteer from "puppeteer";
import { resolve } from "node:path";

async function inspectLinkToAnyPage() {
  const browser = await puppeteer.connect({
    browserURL: "http://127.0.0.1:9222",
    defaultViewport: null
  });

  const page = await browser.newPage();
  console.log("🔗 link-to-any-page 접속 중...");
  await page.goto("https://partners.coupang.com/#affiliate/ws/link-to-any-page", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 4000));

  console.log(`현재 URL: ${page.url()}`);

  const elementsInfo = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input, textarea"));
    const buttons = Array.from(document.querySelectorAll("button, a.btn"));
    return {
      inputs: inputs.map(i => ({ tag: i.tagName, type: i.type, placeholder: i.placeholder, className: i.className, id: i.id })),
      buttons: buttons.map(b => ({ tag: b.tagName, text: b.textContent.trim(), className: b.className }))
    };
  });

  console.log("인풋 및 버튼 정보:", JSON.stringify(elementsInfo, null, 2));

  const shotPath = resolve(process.cwd(), "public/link_to_any_page_proof.png");
  await page.screenshot({ path: shotPath });
  console.log(`📸 스크린샷: ${shotPath}`);

  await page.close();
}

inspectLinkToAnyPage().catch(console.error);
