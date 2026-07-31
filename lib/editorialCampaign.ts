import { approvalSampleProduct } from "@/lib/approvalSample";
import { isCoupangPartnersLink } from "@/lib/coupangLink";
import { getSiteUrl } from "@/lib/siteUrl";

const CAMPAIGN_ID = "novatech_s1_window_cleaner";
const AFFILIATE_DISCLOSURE = "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";
const TELEGRAM_AFFILIATE_NOTICE = `제휴 안내:\n${AFFILIATE_DISCLOSURE}`;

function assertEditorialCampaignReady() {
  if (!isCoupangPartnersLink(process.env.NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL)) {
    throw new Error("EDITORIAL_CAMPAIGN_LINK_NOT_CONFIGURED");
  }
}

function trackedDetailUrl(source: "telegram" | "naver_blog", medium: "channel" | "owned") {
  const siteUrl = getSiteUrl().replace(/\/$/, "");
  return `${siteUrl}${approvalSampleProduct.detailPath}?utm_source=${source}&utm_medium=${medium}&utm_campaign=${CAMPAIGN_ID}`;
}

export function buildEditorialCampaignKit() {
  assertEditorialCampaignReady();
  const telegramUrl = trackedDetailUrl("telegram", "channel");
  const naverBlogUrl = trackedDetailUrl("naver_blog", "owned");
  const telegramMessage = [
    "🔥 [리턴픽 직접 검수 추천]",
    "",
    approvalSampleProduct.name,
    approvalSampleProduct.subtitle,
    "",
    "추천 이유:",
    "- 넓거나 손이 닿기 어려운 유리창 청소 부담을 줄일 때 검토할 만합니다.",
    "- 5800Pa 흡입력 표기와 자동 물 분사 기능을 함께 비교할 수 있습니다.",
    "",
    "구매 전 확인:",
    "- 안전줄과 전원선 등 실제 포함 구성품을 확인하세요.",
    "- 가격, 재고, 배송 조건은 구매 직전 쿠팡 페이지를 기준으로 확인하세요.",
    "",
    "자세히 보기:",
    telegramUrl,
    "",
    TELEGRAM_AFFILIATE_NOTICE
  ].join("\n");
  const naverBlogTitle = `[리턴픽 직접 검수] ${approvalSampleProduct.name} 구매 전 체크`;
  const naverBlogBody = [
    `[제휴 안내] ${AFFILIATE_DISCLOSURE}`,
    "",
    "창문을 직접 닦기 부담스럽거나 손이 닿기 어려운 구간이 있다면 창문 로봇청소기를 비교해 볼 수 있습니다.",
    "이번에 확인한 제품은 Novatech S1 창문 로봇청소기입니다.",
    "",
    "왜 살펴봤나요?",
    "• 5800Pa 흡입력 표기와 자동 물 분사 기능을 함께 확인할 수 있습니다.",
    "• 고층이나 넓은 유리창을 반복해서 닦는 부담을 줄일 때 검토할 만합니다.",
    "• 가격을 단정하지 않고 쿠팡의 현재 판매 조건을 직접 확인하도록 구성했습니다.",
    "",
    "구매 전 확인할 점",
    "• 안전줄과 전원선 등 실제 포함 구성품",
    "• 창문 크기와 프레임 형태가 사용 조건에 맞는지",
    "• 반품 상품이라면 반품등급과 구성품 상태",
    "• 구매 직전 가격, 재고, 배송 조건",
    "",
    "리턴픽의 검수 내용과 현재 쿠팡 가격 확인:",
    naverBlogUrl,
    "",
    "상품 가격과 재고, 배송 정보, 반품등급은 수시로 바뀔 수 있습니다. 최종 구매 전 쿠팡 상품 페이지에서 다시 확인하세요.",
    "",
    AFFILIATE_DISCLOSURE
  ].join("\n");

  return {
    campaignId: CAMPAIGN_ID,
    productName: approvalSampleProduct.name,
    publicUrl: `${getSiteUrl().replace(/\/$/, "")}${approvalSampleProduct.detailPath}`,
    disclosure: AFFILIATE_DISCLOSURE,
    telegram: { trackedUrl: telegramUrl, message: telegramMessage },
    naverBlog: {
      publisherUrl: approvalSampleProduct.registeredNaverBlogUrl,
      trackedUrl: naverBlogUrl,
      title: naverBlogTitle,
      body: naverBlogBody
    }
  };
}

export type EditorialCampaignKit = ReturnType<typeof buildEditorialCampaignKit>;

export function buildEditorialPickTelegramMessage() {
  return buildEditorialCampaignKit().telegram.message;
}
