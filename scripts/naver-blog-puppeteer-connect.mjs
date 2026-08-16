import puppeteer from "puppeteer";
import { banpumKing8Deals } from "./publish-banpum-king-deals.mjs";

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function runConnectedNaverPoster() {
  console.log("=================================================");
  console.log("   🟢 [네이버 블로그] 활성 크롬 원격 제어 자동 포스팅");
  console.log("=================================================\n");

  let browser;
  try {
    console.log("🔗 포트 9222의 활성 크롬 브라우저에 연결 중...");
    browser = await puppeteer.connect({
      browserURL: "http://127.0.0.1:9222",
      defaultViewport: null
    });
    console.log("✅ 사용자 화면의 크롬 브라우저에 성공적으로 연결되었습니다!");
  } catch (e) {
    console.log("⚠️ 크롬 원격 연결 실패. 브라우저가 아직 켜지지 않았거나 포트가 다릅니다:", e.message);
    return;
  }

  const pages = await browser.pages();
  const page = pages.length > 0 ? pages[0] : await browser.newPage();

  // 1. 로그인 상태 확인
  console.log("🔍 네이버 로그인 상태를 감지 중입니다...");
  const currentUrl = page.url();

  if (currentUrl.includes("nidlogin.login") || currentUrl.includes("nid.naver.com")) {
    console.log("\n👉 [화면 확인]");
    console.log("사용자님 화면에 열린 크롬 창에서 네이버 아이디/비밀번호 로그인을 완료해주세요!");
    console.log("로그인이 완료되면 자동으로 블로그 글 작성이 시작됩니다...\n");

    try {
      await page.waitForFunction(() => {
        return !window.location.href.includes("nidlogin.login");
      }, { timeout: 180000 });
      console.log("✅ 네이버 로그인 완료가 감지되었습니다!");
    } catch (e) {
      console.log("⚠️ 로그인 대기 시간이 초과되었습니다.");
      return;
    }
  } else {
    console.log("✅ 네이버 로그인 세션 확인 완료!");
  }

  await sleep(2000);

  // 2. 네이버 블로그 스마트에디터로 이동
  console.log("📝 네이버 블로그 스마트에디터 ONE으로 이동합니다...");
  await page.goto("https://blog.naver.com/BlogWriteForm.naver", { waitUntil: "networkidle2" });
  await sleep(3000);

  let editorFrame = page;
  const frames = page.frames();
  const mainFrame = frames.find(f => f.name() === "mainFrame" || f.url().includes("editor"));
  if (mainFrame) {
    editorFrame = mainFrame;
  }

  // 팝업 닫기
  try {
    const cancelBtn = await editorFrame.$("button.se-popup-button-cancel, .se-help-panel-close-button, .se-popup-close-button");
    if (cancelBtn) {
      await cancelBtn.click();
      console.log("ℹ️ 에디터 안내 팝업을 닫았습니다.");
      await sleep(1000);
    }
  } catch (e) {}

  // 3. 제목 입력
  const postTitle = "[쿠팡 반품특가] 100~300만원대 고액 반품-미개봉/최상급 전자기기 BEST 8 (새상품 대비 최대 161만원 절약)";
  console.log(`📌 제목 입력 중: ${postTitle}`);

  try {
    const titleSelector = ".se-documentTitle .se-ff-nanumgothic, .se-documentTitle .se-placeholder, p.se-text-paragraph, [data-placeholder*='제목']";
    await editorFrame.waitForSelector(titleSelector, { timeout: 8000 });
    await editorFrame.click(titleSelector);
    await sleep(500);
    await page.keyboard.type(postTitle, { delay: 25 });
    console.log("✅ 제목 입력 완료!");
  } catch (e) {
    await page.keyboard.press("Tab");
    await page.keyboard.type(postTitle, { delay: 25 });
  }

  await sleep(1000);

  // 4. 본문 입력
  console.log("✍️ 고액 반품 8종 본문 자동 작성 중...");
  await page.keyboard.press("Enter");
  await sleep(500);

  await page.keyboard.type("📢 [공정위 문구] 본 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.\n\n", { delay: 15 });
  await page.keyboard.type("안녕하세요! 오늘은 새상품 대비 최대 161만 원까지 저렴하게 풀린 [쿠팡 100~300만원대 초고액 반품-미개봉/최상급 전자기기 BEST 8] 라인업을 정리해 드립니다.\n\n", { delay: 15 });
  await page.keyboard.type("단순 박스 라벨만 개봉되었거나 단순 변심 1회 반품된 매물로 본체는 100% 신품급이며, 와우회원 30일 무료반품과 제조사 공식 AS가 완벽히 보장됩니다.\n\n========================================\n\n", { delay: 15 });

  for (const [idx, d] of banpumKing8Deals.entries()) {
    const saveAmt = (d.new_product_price - d.deal_price).toLocaleString();
    const itemText = `👑 [반품왕 #${idx + 1}] ${d.title}\n` +
      `• 반품 등급: ${d.return_grade}\n` +
      `• 새상품 정상가: ${d.new_product_price.toLocaleString()}원 ➔ 쿠팡 반품가: ${d.deal_price.toLocaleString()}원 (${d.discount_rate}% 할인)\n` +
      `• 🔥 절약 혜택: 새상품 대비 ${saveAmt}원 세이브!\n` +
      `• 🔍 검수 리포트: ${d.inspection_report}\n` +
      `• 💳 혜택: ${d.card_benefit} (잔여 ${d.stock_remain}대 한정)\n` +
      `👉 실시간 반품 재고 & 상태 확인: https://returnpick-deals.blogspot.com/2026/08/18.html\n\n----------------------------------------\n\n`;

    await page.keyboard.type(itemText, { delay: 10 });
    await sleep(200);
  }

  await page.keyboard.type("📌 구매 전 안내사항:\n• 반품 특가 매물은 실시간 1~2대 한정 수량으로 조기 품절될 수 있습니다.\n• 쿠팡 와우회원은 수령 후 30일간 무료 교환 및 반품이 가능합니다.\n\n", { delay: 15 });
  console.log("✅ 본문 작성 완료!");

  console.log("\n=================================================");
  console.log("🎉 화면의 네이버 스마트에디터에 고액 반품 글이 완벽하게 작성되었습니다!");
  console.log("👉 우측 상단 [발행] 버튼을 누르시면 네이버 블로그 배포가 완료됩니다!");
  console.log("=================================================");
}

runConnectedNaverPoster().catch(console.error);
