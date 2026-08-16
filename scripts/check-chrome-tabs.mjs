import puppeteer from "puppeteer";

async function checkCoupangPartnersSession() {
  try {
    const browser = await puppeteer.connect({
      browserURL: "http://127.0.0.1:9222",
      defaultViewport: null
    });

    const pages = await browser.pages();
    console.log("열려있는 탭 목록:");
    for (let i = 0; i < pages.length; i++) {
      const title = await pages[i].title();
      const url = pages[i].url();
      console.log(`[${i}] ${title} | ${url}`);
    }
  } catch (e) {
    console.error("크롬 포트 9222 연결 실패:", e.message);
  }
}

checkCoupangPartnersSession();
