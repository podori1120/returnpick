import puppeteer from "puppeteer";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { banpumKing8Deals } from "./publish-banpum-king-deals.mjs";

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function verifyAndPublishNaverPost() {
  console.log("=================================================");
  console.log("   🔍 [네이버 블로그] 정밀 검증 및 100% 실전 발행");
  console.log("=================================================\n");

  let browser;
  try {
    browser = await puppeteer.connect({
      browserURL: "http://127.0.0.1:9222",
      defaultViewport: null
    });
    console.log("✅ 포트 9222 크롬 브라우저에 연결되었습니다!");
  } catch (e) {
    console.log("⚠️ 포트 9222 연결 실패:", e.message);
    return;
  }

  const page = await browser.newPage();

  // 1. 블로그 글쓰기 진입
  console.log("📝 whiteraris 님의 네이버 블로그 글쓰기 창으로 직접 이동합니다...");
  await page.goto("https://blog.naver.com/whiteraris?Redirect=Write", { waitUntil: "networkidle2" });
  await sleep(4000);

  // iframe 확인 (스마트에디터 ONE은 보통 mainFrame 내부이거나 최상위)
  let editorFrame = page;
  for (const f of page.frames()) {
    if (f.name() === "mainFrame" || f.url().includes("editor") || f.url().includes("postwrite")) {
      editorFrame = f;
      console.log(`✅ 스마트에디터 프레임 탐색 성공: ${f.name()}`);
      break;
    }
  }

  // 팝업 닫기 (임시저장, 튜토리얼 등)
  try {
    await editorFrame.evaluate(() => {
      const cancelBtns = document.querySelectorAll("button.se-popup-button-cancel, .se-help-panel-close-button, .se-popup-close-button, button.se_popup_close");
      cancelBtns.forEach(b => b.click());
    });
    console.log("ℹ️ 팝업 닫기 완료");
  } catch (e) {}

  await sleep(1000);

  // 2. 제목 입력
  const postTitle = "[쿠팡 반품특가] 100~300만원대 고액 반품-미개봉/최상급 전자기기 BEST 8 (새상품 대비 최대 161만원 절약)";
  console.log(`📌 제목 입력 중: ${postTitle}`);

  const titleTyped = await editorFrame.evaluate((title) => {
    // 제목 엘리먼트 찾기
    const titleEl = document.querySelector(".se-documentTitle .se-placeholder, .se-documentTitle [contenteditable='true'], [data-placeholder*='제목']");
    if (titleEl) {
      titleEl.focus();
      return true;
    }
    return false;
  }, postTitle);

  if (titleTyped) {
    await page.keyboard.type(postTitle, { delay: 20 });
    console.log("✅ 제목 입력 완료!");
  } else {
    // 대체 제목 입력
    await page.keyboard.press("Tab");
    await page.keyboard.type(postTitle, { delay: 20 });
  }

  await sleep(1000);

  // 3. 본문 입력
  console.log("✍️ 고액 반품 8종 본문 내용 작성 중...");
  await page.keyboard.press("Enter");
  await sleep(500);

  const fullBodyText = `📢 [공정위 문구] 본 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.

안녕하세요! 오늘은 새상품 대비 최대 161만 원까지 저렴하게 풀린 [쿠팡 100~300만원대 초고액 반품-미개봉/최상급 전자기기 BEST 8] 라인업을 정리해 드립니다.

단순 박스 라벨만 개봉되었거나 단순 변심 1회 반품된 매물로 본체는 100% 신품급이며, 와우회원 30일 무료반품과 제조사 공식 AS가 완벽히 보장됩니다.

========================================

` + banpumKing8Deals.map((d, i) => {
    const saveAmt = (d.new_product_price - d.deal_price).toLocaleString();
    return `👑 [반품왕 #${i + 1}] ${d.title}
• 반품 등급: ${d.return_grade}
• 새상품 정상가: ${d.new_product_price.toLocaleString()}원 ➔ 쿠팡 반품가: ${d.deal_price.toLocaleString()}원 (${d.discount_rate}% 할인)
• 🔥 절약 혜택: 새상품 대비 ${saveAmt}원 세이브!
• 🔍 검수 리포트: ${d.inspection_report}
• 💳 혜택: ${d.card_benefit} (잔여 ${d.stock_remain}대 한정)
👉 실시간 반품 재고 & 상태 확인: https://returnpick-deals.blogspot.com/2026/08/18.html

----------------------------------------
`;
  }).join("\n") + `
📌 구매 전 안내사항:
1. '반품-미개봉'은 단순 박스 라벨만 개봉되었거나 비닐 미개봉 상태로 본체는 100% 신품입니다.
2. '반품-최상'은 단순 변심으로 단 1회 개봉된 특A급으로 새상품과 동일한 무상 AS가 적용됩니다.
3. 쿠팡 와우회원은 수령 후 30일간 무료 반품이 가능하여 고가 제품도 안심하고 확인 후 결정하실 수 있습니다.
`;

  // 본문 클립보드 복사 후 붙여넣기
  await page.evaluate((text) => {
    const bodyEl = document.querySelector(".se-main-container [contenteditable='true'], .se-component-content, .se-text-paragraph");
    if (bodyEl) bodyEl.focus();
  });

  // 줄바꿈 단위로 본문 입력
  const lines = fullBodyText.split("\n");
  for (const l of lines) {
    if (l.trim()) {
      await page.keyboard.type(l, { delay: 5 });
    }
    await page.keyboard.press("Enter");
  }
  console.log("✅ 본문 전체 입력 완료!");
  await sleep(2000);

  // 4. [발행] 버튼 1단계 클릭
  console.log("🚀 [1단계] 우측 상단 '발행' 버튼 클릭 중...");
  const publishClicked = await editorFrame.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const publishBtn = btns.find(b => b.textContent && b.textContent.trim() === "발행" && !b.classList.contains("se-popup-button"));
    if (publishBtn) {
      publishBtn.click();
      return true;
    }
    return false;
  });
  console.log(`1단계 발행 클릭 결과: ${publishClicked}`);
  await sleep(2000);

  // 5. [발행하기] 최종 확인 2단계 클릭
  console.log("🚀 [2단계] 발행 레이어 내부 최종 '발행' 버튼 클릭 중...");
  const confirmClicked = await editorFrame.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    // 발행 확인 레이어 안의 초록색 발행 버튼
    const confirmBtn = btns.find(b => {
      const txt = b.textContent ? b.textContent.trim() : "";
      return (txt === "발행" || txt === "발행하기") && (b.className.includes("confirm") || b.className.includes("publish_btn") || b.getAttribute("data-action") === "confirm");
    });
    if (confirmBtn) {
      confirmBtn.click();
      return true;
    }
    // 레이어에서 보이는 마지막 발행 버튼 클릭
    const visibleBtns = btns.filter(b => b.textContent && (b.textContent.trim() === "발행" || b.textContent.trim() === "발행하기") && b.offsetParent !== null);
    if (visibleBtns.length > 0) {
      visibleBtns[visibleBtns.length - 1].click();
      return true;
    }
    return false;
  });
  console.log(`2단계 최종 발행 클릭 결과: ${confirmClicked}`);

  await sleep(5000);

  // 6. 실제 블로그 방문하여 발행 여부 검증
  console.log("🔍 https://blog.naver.com/whiteraris 방문하여 실제 등록 여부를 확인합니다...");
  await page.goto("https://blog.naver.com/whiteraris", { waitUntil: "networkidle2" });
  await sleep(3000);

  const blogPageTitle = await page.title();
  console.log(`블로그 메인 타이틀: ${blogPageTitle}`);

  // 화면 스크린샷 캡처
  const screenshotPath = resolve(process.cwd(), "public/naver_publish_result.png");
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`✅ 블로그 현재 상태 스크린샷 저장 완료: ${screenshotPath}`);

  console.log("\n=================================================");
  console.log("🎉 네이버 블로그(whiteraris) 포스팅 및 검증 프로세스 완료!");
  console.log("=================================================");
}

verifyAndPublishNaverPost().catch(console.error);
