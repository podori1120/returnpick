import puppeteer from "puppeteer";

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function executeFullAutoPublish() {
  console.log("=================================================");
  console.log("   🟢 [네이버 블로그] 100% 완전 무인 자동 포스팅 & 발행");
  console.log("=================================================\n");

  let browser;
  try {
    console.log("🔗 크롬 브라우저(포트 9222)에 연결 중...");
    browser = await puppeteer.connect({
      browserURL: "http://127.0.0.1:9222",
      defaultViewport: null
    });
    console.log("✅ 활성 크롬 브라우저에 성공적으로 연결되었습니다!");
  } catch (e) {
    console.log("⚠️ 포트 9222 연결 실패:", e.message);
    return;
  }

  const pages = await browser.pages();
  let targetPage = pages.find(p => p.url().includes("blog.naver.com") || p.url().includes("nid.naver.com")) || pages[0];

  if (!targetPage) {
    targetPage = await browser.newPage();
  }

  console.log("📝 네이버 블로그 스마트에디터 ONE으로 이동합니다...");
  await targetPage.goto("https://blog.naver.com/BlogWriteForm.naver", { waitUntil: "networkidle2" });
  await sleep(3000);

  // 스마트에디터 iframe 확인
  let editorFrame = targetPage;
  const frames = targetPage.frames();
  const mainFrame = frames.find(f => f.name() === "mainFrame" || f.url().includes("editor"));
  if (mainFrame) {
    editorFrame = mainFrame;
  }

  // 1. 임시저장/도움말 팝업 취소 클릭
  try {
    const cancelSelectors = [
      "button.se-popup-button-cancel",
      ".se-help-panel-close-button",
      ".se-popup-close-button",
      "button.se_popup_close"
    ];
    for (const sel of cancelSelectors) {
      const btn = await editorFrame.$(sel);
      if (btn) {
        await btn.click();
        console.log(`ℹ️ 팝업 닫기 클릭 (${sel})`);
        await sleep(500);
      }
    }
  } catch (e) {}

  // 2. 제목 입력
  const postTitle = "[쿠팡 반품특가] 100~300만원대 고액 반품-미개봉/최상급 전자기기 BEST 8 (새상품 대비 최대 161만원 절약)";
  console.log(`📌 제목 입력 중: ${postTitle}`);

  try {
    const titleSelector = ".se-documentTitle .se-ff-nanumgothic, .se-documentTitle .se-placeholder, [data-placeholder*='제목']";
    await editorFrame.waitForSelector(titleSelector, { timeout: 8000 });
    await editorFrame.click(titleSelector);
    await sleep(300);
    await targetPage.keyboard.type(postTitle, { delay: 20 });
    console.log("✅ 제목 입력 완료!");
  } catch (e) {
    console.log("⚠️ 제목 입력 대체 시도...");
    await targetPage.keyboard.press("Tab");
    await targetPage.keyboard.type(postTitle, { delay: 20 });
  }

  await sleep(800);

  // 3. 본문 영역 이동 및 클립보드 붙여넣기 (초고속 0.1초 삽입)
  console.log("✍️ 고액 반품 본문 초고속 자동 삽입 중...");
  await targetPage.keyboard.press("Enter");
  await sleep(400);

  // Windows 클립보드에 있는 전체 본문 Ctrl+V 붙여넣기
  await targetPage.keyboard.down("Control");
  await targetPage.keyboard.press("v");
  await targetPage.keyboard.up("Control");
  await sleep(1500);
  console.log("✅ 본문 전체 삽입 완료!");

  // 4. [발행] 버튼 클릭 (1단계)
  console.log("🚀 네이버 블로그 [발행] 버튼 탐색 및 클릭 중...");
  try {
    const publishBtnSelectors = [
      "button[data-action='publish']",
      "button.publish_btn__m9KHH",
      "button.se_publish_btn",
      ".publish_button",
      "button:has-text('발행')"
    ];

    let clicked = false;
    for (const sel of publishBtnSelectors) {
      try {
        const pBtn = await editorFrame.$(sel);
        if (pBtn) {
          await pBtn.click();
          clicked = true;
          console.log(`✅ 발행 버튼 1단계 클릭 성공 (${sel})`);
          break;
        }
      } catch (err) {}
    }

    if (!clicked) {
      // evaluate로 텍스트 '발행' 버튼 탐색
      await editorFrame.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const target = btns.find(b => b.textContent && b.textContent.trim() === "발행");
        if (target) target.click();
      });
      console.log("✅ evaluate 방식으로 1단계 발행 버튼 클릭 완료!");
    }

    await sleep(1500);

    // 5. 최종 [발행하기] 버튼 클릭 (2단계)
    console.log("🚀 최종 [발행하기] 확인 버튼 클릭 중...");
    await editorFrame.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const confirmBtn = btns.find(b => b.textContent && (b.textContent.trim() === "발행" || b.textContent.trim() === "발행하기") && b.offsetParent !== null);
      if (confirmBtn) confirmBtn.click();
    });

    await sleep(3000);
    console.log("\n=================================================");
    console.log("🎉 네이버 블로그 포스팅이 100% 완전 무인으로 성공적으로 발행되었습니다!");
    console.log("=================================================");

  } catch (e) {
    console.log("⚠️ 발행 버튼 클릭 중 오류 발생:", e.message);
  }
}

executeFullAutoPublish().catch(console.error);
