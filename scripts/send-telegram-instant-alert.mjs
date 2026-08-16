import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ultraHighValue5Deals } from "./publish-ultra-high-value-deals.mjs";
import { refurbishedTech8Deals } from "./publish-refurbished-tech-post.mjs";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      process.env[key] = val;
    }
  }
}

async function sendTelegramInstantAlert() {
  console.log("=================================================");
  console.log("   📢 [텔레그램 핫딜 알리미] 즉시 발송 시스템");
  console.log("=================================================\n");

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const topDeal = ultraHighValue5Deals[0]; // 맥북 에어 15인치

  const message = `🔥 *[쿠팡 VIP 특가 긴급 알림]* 🔥

👑 *${topDeal.title}*
• 쿠팡 특가: *${topDeal.deal_price.toLocaleString()}원* (${topDeal.discount_rate}% 할인)
• 네이버 최저가: ${topDeal.naver_lowest_price.toLocaleString()}원 (*약 ${(topDeal.naver_lowest_price - topDeal.deal_price).toLocaleString()}원 절약*)
• 💳 카드사 최대 10% 추가할인 + 24개월 무이자

📊 *폴센트 60일 최저가 검증 완료*
${topDeal.public_note}

👉 [실시간 재고 & 특가 바로가기](https://returnpick-deals.blogspot.com/2026/08/490ml-x-24-991.html)`;

  if (botToken && chatId) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
          disable_web_page_preview: false
        })
      });
      const data = await res.json();
      if (data.ok) {
        console.log("✅ 텔레그램 채널 메시지 즉시 전송 성공!");
      } else {
        console.log("⚠️ 텔레그램 전송 응답:", data.description);
      }
    } catch (e) {
      console.log("⚠️ 텔레그램 전송 실패:", e.message);
    }
  } else {
    console.log("ℹ️ 텔레그램 환경변수(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)가 설정되지 않아 로컬 메시지 템플릿을 생성했습니다:");
    console.log("--------------------------------------------------");
    console.log(message);
    console.log("--------------------------------------------------");
  }
}

sendTelegramInstantAlert().catch(console.error);
