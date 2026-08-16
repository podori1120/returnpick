import puppeteer from "puppeteer";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const targets = [
  { id: "bpk-01", name: "갤럭시북4 프로 16", coupangUrl: "https://www.coupang.com/np/search?q=%EA%B0%A4%EB%9F%AD%EC%8B%9C%EB%B6%814+%ED%94%84%EB%A1%9C+16+%EB%B0%98%ED%92%88" },
  { id: "bpk-02", name: "맥북 프로 16 M3", coupangUrl: "https://www.coupang.com/np/search?q=%EB%A7%A5%EB%B6%81%ED%94%84%EB%A1%9C+16+M3+%EB%B0%98%ED%92%88" },
  { id: "bpk-03", name: "LG 77인치 OLED TV", coupangUrl: "https://www.coupang.com/np/search?q=LG+77%EC%9D%B8%EC%B9%98+OLED+TV+%EB%B0%98%ED%92%88" },
  { id: "bpk-04", name: "비스포크 AI 콤보", coupangUrl: "https://www.coupang.com/np/search?q=%EB%B9%84%EC%8A%A4%ED%8F%AC%ED%81%AC+AI+%EC%BD%A4%EB%B3%B4+%EB%B0%98%ED%92%88" },
  { id: "bpk-05", name: "ROG 스트릭스 G16", coupangUrl: "https://www.coupang.com/np/search?q=ASUS+ROG+G16+RTX4080+%EB%B0%98%ED%92%88" },
  { id: "bpk-06", name: "갤럭시 S24 울트라 512GB", coupangUrl: "https://www.coupang.com/np/search?q=%EA%B0%A4%EB%9F%AD%EC%8B%9CS24+%EC%9A%B8%ED%8A%B8%EB%9D%BC+512GB+%EB%B0%98%ED%92%88" },
  { id: "bpk-07", name: "로보락 S8 MaxV Ultra", coupangUrl: "https://www.coupang.com/np/search?q=%EB%A1%9C%EB%B3%B4%EB%9D%BD+S8+MaxV+Ultra+%EB%B0%98%ED%92%88" },
  { id: "bpk-08", name: "소니 A7M4", coupangUrl: "https://www.coupang.com/np/search?q=%EC%86%8C%EB%8B%88+A7M4+%EB%B0%98%ED%92%88" }
];

async function generateExactAffiliateLinks() {
  console.log("=================================================");
  console.log("   🎯 [쿠팡 파트너스] 간편링크 생성기로 8종 수익 링크 발급");
  console.log("=================================================\n");

  const browser = await puppeteer.connect({
    browserURL: "http://127.0.0.1:9222",
    defaultViewport: null
  });

  const page = await browser.newPage();
  await page.goto("https://partners.coupang.com/#affiliate/ws/link-to-any-page", { waitUntil: "networkidle2" });
  await sleep(3000);

  const exactAffiliateLinks = {};

  for (const item of targets) {
    console.log(`\n🔍 [${item.id}] ${item.name} 쿠팡 URL 변환 중...`);
    console.log(`  -> 대상 URL: ${item.coupangUrl}`);

    // 1. 입력창 초기화 및 URL 입력
    await page.evaluate((targetUrl) => {
      const inputs = Array.from(document.querySelectorAll("input, textarea"));
      // 변환할 URL 입력창 찾기
      const urlInput = inputs.find(i => !i.readOnly && i.type !== "hidden") || inputs[0];
      if (urlInput) {
        urlInput.value = "";
        urlInput.focus();
        // React/Vue 이벤트 트리거
        const event = new Event('input', { bubbles: true });
        urlInput.value = targetUrl;
        urlInput.dispatchEvent(event);
      }
    }, item.coupangUrl);

    await sleep(500);

    // 2. '링크 생성' 버튼 클릭
    const generateClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find(b => b.textContent && b.textContent.includes("링크 생성"));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    console.log(`  -> 링크 생성 버튼 클릭: ${generateClicked}`);
    await sleep(2000);

    // 3. 생성된 link.coupang.com URL 추출
    const affiliateUrl = await page.evaluate(() => {
      const allEls = Array.from(document.querySelectorAll("input, textarea, p, span, div, a"));
      for (const el of allEls) {
        const text = el.value || el.textContent || el.href || "";
        const match = text.match(/https:\/\/link\.coupang\.com\/a\/[a-zA-Z0-9_-]+/);
        if (match) return match[0];
      }
      return null;
    });

    if (affiliateUrl) {
      console.log(`  ✅ [발급 성공!] ${affiliateUrl}`);
      exactAffiliateLinks[item.id] = affiliateUrl;
    } else {
      console.log(`  ⚠️ 링크 추출 실패, 대체 링크 사용`);
      exactAffiliateLinks[item.id] = "https://link.coupang.com/a/gf5Ev1IkrA";
    }

    await sleep(1000);
  }

  const outPath = resolve(process.cwd(), "public/exact_individual_affiliate_links.json");
  writeFileSync(outPath, JSON.stringify(exactAffiliateLinks, null, 2), "utf-8");
  console.log(`\n💾 8종 개별 파트너스 수익 링크 저장 완료: ${outPath}`);

  await page.close();
}

generateExactAffiliateLinks().catch(console.error);
