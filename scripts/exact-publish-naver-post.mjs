import puppeteer from "puppeteer";
import { resolve } from "node:path";
import { banpumKing8Deals } from "./publish-banpum-king-deals.mjs";

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function exactPublishNaverPost() {
  console.log("=================================================");
  console.log("   🎯 [네이버 블로그] 스마트에디터 ONE 정밀 발행 엔진");
  console.log("=================================================\n");

  const browser = await puppeteer.connect({
    browserURL: "http://127.0.0.1:9222",
    defaultViewport: null
  });

  const page = await browser.newPage();
  console.log("📝 whiteraris 글쓰기 페이지 접속...");
  await page.goto("https://blog.naver.com/whiteraris?Redirect=Write", { waitUntil: "domcontentloaded" });
  await sleep(4000);

  // 메인 프레임 탐색
  let frame = page.frames().find(f => f.name() === "mainFrame") || page;

  // 1. 임시저장/도움말 닫기
  try {
    await frame.evaluate(() => {
      const btns = document.querySelectorAll(".se-popup-button-cancel, .se-help-panel-close-button, .se-popup-close-button");
      btns.forEach(b => b.click());
    });
  } catch (e) {}

  await sleep(1000);

  // 2. 제목 입력
  const postTitle = "[쿠팡 반품특가] 100~300만원대 고액 반품-미개봉/최상급 전자기기 BEST 8 (새상품 대비 최대 161만원 절약)";
  console.log(`📌 제목 입력: ${postTitle}`);
  
  await frame.evaluate((title) => {
    const titleEl = document.querySelector(".se-documentTitle .se-placeholder, .se-documentTitle p");
    if (titleEl) {
      titleEl.click();
    }
  }, postTitle);
  await page.keyboard.type(postTitle, { delay: 10 });
  await page.keyboard.press("Enter");
  await sleep(500);

  // 3. 본문 입력
  console.log("✍️ 본문 내용 삽입...");
  const bodyText = `📢 [공정위 문구] 본 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.

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
👉 쿠팡 반품 할인가 실시간 재고 & 바로구매: https://link.coupang.com/a/bWq88Z

----------------------------------------
`;
  }).join("\n");

  const lines = bodyText.split("\n");
  for (const l of lines) {
    if (l.trim()) {
      await page.keyboard.type(l, { delay: 2 });
    }
    await page.keyboard.press("Enter");
  }

  await sleep(2000);

  // 4. [발행] 버튼 1단계 클릭 (상단 우측 초록색 '발행' 버튼)
  console.log("🚀 [1단계] 우측 상단 '발행' 버튼 클릭");
  await frame.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const publishBtn = btns.find(b => b.textContent && b.textContent.trim() === "발행");
    if (publishBtn) publishBtn.click();
  });

  await sleep(2000);

  // 5. 발행 레이어 확인 및 최종 [발행] 버튼 클릭
  console.log("🚀 [2단계] 발행 옵션 레이어 내 최종 [발행] 버튼 클릭");
  const finalResult = await frame.evaluate(() => {
    // 발행 레이어 내의 confirm 버튼 찾기
    const confirmBtn = document.querySelector(".confirm_btn__UNBDn, button[data-action='confirm'], .btn_apply, .btn_publish");
    if (confirmBtn) {
      confirmBtn.click();
      return "confirm_btn clicked";
    }

    // 텍스트가 '발행' 또는 '발행하기'인 버튼 중 활성화된 버튼 클릭
    const allBtns = Array.from(document.querySelectorAll("button"));
    const activePublishBtns = allBtns.filter(b => {
      const t = b.textContent ? b.textContent.trim() : "";
      return (t === "발행" || t === "발행하기") && b.offsetParent !== null;
    });

    if (activePublishBtns.length > 0) {
      activePublishBtns[activePublishBtns.length - 1].click();
      return `active button clicked (${activePublishBtns.length})`;
    }

    return "button not found";
  });

  console.log(`최종 발행 버튼 클릭 상태: ${finalResult}`);
  await sleep(6000);

  // 6. 결과 확인
  await page.goto("https://blog.naver.com/whiteraris", { waitUntil: "domcontentloaded" });
  await sleep(3000);

  const proofShot = resolve(process.cwd(), "public/naver_publish_success.png");
  await page.screenshot({ path: proofShot });
  console.log(`📸 발행 결과 스크린샷 캡처 완료: ${proofShot}`);

  await page.close();
}

exactPublishNaverPost().catch(console.error);
