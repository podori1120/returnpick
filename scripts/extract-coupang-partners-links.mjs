import puppeteer from "puppeteer";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const targetKeywords = [
  { id: "bpk-01", name: "갤럭시북4 프로 16", query: "갤럭시북4 프로 16" },
  { id: "bpk-02", name: "맥북 프로 16 M3", query: "맥북프로 16 M3" },
  { id: "bpk-03", name: "LG 77인치 OLED TV", query: "LG 77인치 OLED TV" },
  { id: "bpk-04", name: "비스포크 AI 콤보", query: "비스포크 AI 콤보" },
  { id: "bpk-05", name: "ROG 스트릭스 G16", query: "ROG G16 RTX4080" },
  { id: "bpk-06", name: "갤럭시 S24 울트라 512GB", query: "갤럭시 S24 울트라 512GB" },
  { id: "bpk-07", name: "로보락 S8 MaxV Ultra", query: "로보락 S8 MaxV Ultra" },
  { id: "bpk-08", name: "소니 A7M4", query: "소니 A7M4" }
];

async function generateCoupangPartnersLinks() {
  console.log("=================================================");
  console.log("   🛒 [쿠팡 파트너스] 8종 고액 반품 수익 링크 자동 발급");
  console.log("=================================================\n");

  const browser = await puppeteer.connect({
    browserURL: "http://127.0.0.1:9222",
    defaultViewport: null
  });

  const page = await browser.newPage();
  
  // 1. 파트너스 간편 링크 / 상품 검색 페이지 이동
  console.log("🔗 쿠팡 파트너스 상품 검색 페이지 접속...");
  await page.goto("https://partners.coupang.com/#affiliate/ws/search-product", { waitUntil: "domcontentloaded" });
  await sleep(4000);

  const results = {};

  for (const item of targetKeywords) {
    console.log(`\n🔍 [${item.id}] '${item.query}' 파트너스 링크 생성 중...`);
    try {
      // 검색창 셀렉터 찾기 및 입력
      await page.waitForSelector("input[type='search'], input[type='text'], input.search-input", { timeout: 5000 });
      
      await page.evaluate(() => {
        const input = document.querySelector("input[type='search'], input[type='text'], input.search-input");
        if (input) {
          input.value = "";
          input.focus();
        }
      });

      const searchInput = await page.$("input[type='search'], input[type='text'], input.search-input");
      if (searchInput) {
        await searchInput.type(item.query, { delay: 30 });
        await page.keyboard.press("Enter");
        await sleep(3000);

        // 첫 번째 상품의 [링크생성] 버튼 탐색 및 클릭
        const linkBtnClicked = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll("button, a"));
          const linkBtn = btns.find(b => b.textContent && (b.textContent.includes("링크생성") || b.textContent.includes("링크 복사") || b.textContent.includes("간편링크")));
          if (linkBtn) {
            linkBtn.click();
            return true;
          }
          return false;
        });

        console.log(`  -> 링크 생성 버튼 클릭: ${linkBtnClicked}`);
        await sleep(2000);

        // 생성된 link.coupang.com URL 추출
        const generatedLink = await page.evaluate(() => {
          // input이나 텍스트 내 link.coupang.com 탐색
          const inputs = Array.from(document.querySelectorAll("input, textarea, p, span, div, a"));
          for (const el of inputs) {
            const val = el.value || el.textContent || el.href || "";
            const match = val.match(/https:\/\/link\.coupang\.com\/a\/[a-zA-Z0-9_-]+/);
            if (match) return match[0];
          }
          return null;
        });

        if (generatedLink) {
          console.log(`  ✅ [성공] 파트너스 링크 발급 완료: ${generatedLink}`);
          results[item.id] = generatedLink;
        } else {
          console.log(`  ⚠️ 팝업에서 링크 텍스트 탐색 중...`);
          // 팝업 닫기 시도
          const fallbackUrl = await page.evaluate(() => {
            const el = document.querySelector(".shorten-url, .link-text, input[readonly]");
            return el ? (el.value || el.textContent) : null;
          });
          results[item.id] = fallbackUrl || "https://link.coupang.com/a/dRiMJOFU0i";
        }

        // 팝업 닫기
        await page.evaluate(() => {
          const closeBtn = document.querySelector(".close-btn, .modal-close, button[aria-label='Close']");
          if (closeBtn) closeBtn.click();
        });
      }
    } catch (err) {
      console.error(`  ❌ [에러] ${item.id} 처리 실패:`, err.message);
      results[item.id] = "https://link.coupang.com/a/dRiMJOFU0i";
    }
    await sleep(1500);
  }

  const outPath = resolve(process.cwd(), "public/coupang_partners_generated_links.json");
  writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\n💾 전체 파트너스 링크 저장 완료: ${outPath}`);

  await page.close();
}

generateCoupangPartnersLinks().catch(console.error);
