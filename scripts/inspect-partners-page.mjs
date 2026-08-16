import puppeteer from "puppeteer";
import { resolve } from "node:path";

async function inspectPartnersPage() {
  const browser = await puppeteer.connect({
    browserURL: "http://127.0.0.1:9222",
    defaultViewport: null
  });

  const page = await browser.newPage();
  await page.goto("https://partners.coupang.com/#affiliate/ws/search-product", { waitUntil: "domcontentloaded" });
  await new Promise(r => setTimeout(r, 4000));

  const url = page.url();
  const title = await page.title();
  console.log(`현재 URL: ${url}, Title: ${title}`);

  const html = await page.evaluate(() => {
    return document.body.innerText.slice(0, 1000);
  });
  console.log("페이지 텍스트 요약:\n", html);

  const screenshotPath = resolve(process.cwd(), "public/partners_screen.png");
  await page.screenshot({ path: screenshotPath });
  console.log(`스크린샷 저장: ${screenshotPath}`);

  await page.close();
}

inspectPartnersPage().catch(console.error);
