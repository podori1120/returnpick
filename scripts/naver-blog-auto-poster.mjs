import puppeteer from "puppeteer";
import { resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { banpumKing8Deals } from "./publish-banpum-king-deals.mjs";

const profileDir = resolve(process.cwd(), ".naver_chrome_profile");
if (!existsSync(profileDir)) {
  mkdirSync(profileDir, { recursive: true });
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function runNaverBlogAutoPoster() {
  console.log("=================================================");
  console.log("   🟢 [네이버 블로그] 고액 반품 스마트 자동 포스팅 엔진");
  console.log("=================================================\n");

  console.log("🚀 크롬 브라우저를 실행합니다. 화면에 열리는 창을 확인해주세요...");

  const browser = await puppeteer.launch({
    headless: false, // 사용자 화면에 브라우저 표시
    defaultViewport: null,
    args: [
      `--user-data-dir=${profileDir}`,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--window-size=1280,900"
    ]
  });

  const page = await browser.newPage();

  // 1. 네이버 메인 또는 로그인 확인
  console.log("🔍 네이버 로그인 상태를 확인 중입니다...");
  await page.goto("https://nid.naver.com/nidlogin.login", { waitUntil: "networkidle2" });

  const isAlreadyLoggedIn = await page.evaluate(() => {
    return !document.getElementById("id") && !document.getElementById("pw");
  });

  if (!isAlreadyLoggedIn) {
    console.log("\n👉 [사용자 로그인 대기]");
    console.log("화면에 열린 크롬 창에서 네이버 아이디/비밀번호로 로그인(2단계 인증 포함)을 진행해주세요!");
    console.log("로그인이 완료되면 스크립트가 자동으로 감지하여 블로그 글 작성을 시작합니다...\n");

    // 로그인 완료될 때까지 대기 (최대 3분)
    try {
      await page.waitForFunction(() => {
        return window.location.href.includes("naver.com") && !window.location.href.includes("nidlogin.login");
      }, { timeout: 180000 });
      console.log("✅ 네이버 로그인 성공이 감지되었습니다!");
    } catch (e) {
      console.log("⚠️ 로그인 대기 시간이 초과되었거나 취소되었습니다.");
      return;
    }
  } else {
    console.log("✅ 기존 로그인 세션이 유지되어 있습니다!");
  }

  await sleep(2000);

  // 2. 네이버 블로그 글쓰기 페이지 진입
  console.log("📝 네이버 블로그 스마트에디터 ONE으로 이동합니다...");
  await page.goto("https://blog.naver.com/BlogWriteForm.naver", { waitUntil: "networkidle2" });
  await sleep(3000);

  // 스마트에디터 iframe 내부로 진입할 수도 있으므로 프레임 체크
  let editorFrame = page;
  const frames = page.frames();
  const mainFrame = frames.find(f => f.name() === "mainFrame" || f.url().includes("editor"));
  if (mainFrame) {
    editorFrame = mainFrame;
  }

  // 3. 임시저장 / 이전 작성 글 팝업 닫기 처리
  try {
    const cancelBtn = await editorFrame.$("button.se-popup-button-cancel, .se-help-panel-close-button, .se-popup-close-button");
    if (cancelBtn) {
      await cancelBtn.click();
      console.log("ℹ️ 에디터 도움말/임시저장 팝업을 닫았습니다.");
      await sleep(1000);
    }
  } catch (e) {}

  // 4. 제목 입력
  const postTitle = "[쿠팡 반품특가] 100~300만원대 고액 반품-미개봉/최상급 전자기기 BEST 8 (새상품 대비 최대 161만원 절약)";
  console.log(`📌 제목 입력 중: ${postTitle}`);

  try {
    // 스마트에디터 ONE 제목 영역
    const titleSelector = ".se-documentTitle .se-ff-nanumgothic, .se-documentTitle .se-placeholder, p.se-text-paragraph, [data-placeholder*='제목']";
    await editorFrame.waitForSelector(titleSelector, { timeout: 10000 });
    await editorFrame.click(titleSelector);
    await sleep(500);
    await page.keyboard.type(postTitle, { delay: 30 });
    console.log("✅ 제목 입력 완료!");
  } catch (e) {
    console.log("⚠️ 제목 입력 선택자 탐색 재시도 중...");
    await page.keyboard.press("Tab");
    await page.keyboard.type(postTitle, { delay: 30 });
  }

  await sleep(1000);

  // 5. 본문 입력 영역 이동
  console.log("✍️ 고액 반품 본문 콘텐츠 작성 중...");
  await page.keyboard.press("Enter");
  await sleep(500);

  // 공정위 문구 입력
  await page.keyboard.type("📢 [공정위 문구] 본 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.\n\n", { delay: 20 });
  await page.keyboard.type("안녕하세요! 오늘은 새상품 대비 최대 161만 원까지 저렴하게 풀린 [쿠팡 100~300만원대 초고액 반품-미개봉/최상급 전자기기 BEST 8] 라인업을 정리해 드립니다.\n\n", { delay: 20 });
  await page.keyboard.type("단순 박스 라벨만 개봉되었거나 단순 변심 1회 반품된 매물로 본체는 100% 신품급이며, 와우회원 30일 무료반품과 제조사 공식 AS가 완벽히 보장됩니다.\n\n========================================\n\n", { delay: 20 });

  // 8종 고액 반품 상품 순차 입력
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
    await sleep(300);
  }

  await page.keyboard.type("📌 구매 전 안내사항:\n• 반품 특가 매물은 실시간 1~2대 한정 수량으로 조기 품절될 수 있습니다.\n• 쿠팡 와우회원은 수령 후 30일간 무료 교환 및 반품이 가능합니다.\n\n", { delay: 20 });
  console.log("✅ 본문 작성 완료!");

  await sleep(2000);

  console.log("\n=================================================");
  console.log("🎉 네이버 블로그 스마트에디터에 고액 반품 글이 완벽하게 작성되었습니다!");
  console.log("👉 화면의 크롬 창에서 우측 상단 [발행] 버튼을 누르시면 네이버 블로그에 즉시 배포됩니다!");
  console.log("=================================================");
}

runNaverBlogAutoPoster().catch(console.error);
