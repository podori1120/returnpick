import puppeteer from "puppeteer";
import { resolve } from "node:path";

async function checkPublishedPost() {
  console.log("=================================================");
  console.log("   📸 [네이버 블로그] 발행 결과 최종 확인");
  console.log("=================================================\n");

  const browser = await puppeteer.connect({
    browserURL: "http://127.0.0.1:9222",
    defaultViewport: null
  });

  const page = await browser.newPage();
  await page.goto("https://blog.naver.com/PostList.naver?blogId=whiteraris", { waitUntil: "domcontentloaded" });

  const title = await page.title();
  console.log(`현재 페이지 타이틀: ${title}`);

  const postTitles = await page.evaluate(() => {
    const titleElements = document.querySelectorAll(".se-title-text, .post-title, a.title_link, .pcol1, h3");
    return Array.from(titleElements).map(el => el.textContent.trim()).filter(Boolean);
  });

  console.log("발견된 포스트 제목 목록:", postTitles.slice(0, 5));

  const screenshotPath = resolve(process.cwd(), "public/naver_final_proof.png");
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`✅ 최종 증빙 스크린샷 저장 완료: ${screenshotPath}`);

  await page.close();
}

checkPublishedPost().catch(console.error);
