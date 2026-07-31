import { NextResponse } from "next/server";
import { buildEditorialCampaignKit } from "@/lib/editorialCampaign";
import { requireAdmin } from "@/lib/validators";

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    return NextResponse.json({ kit: buildEditorialCampaignKit() });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 240) : "EDITORIAL_CAMPAIGN_FAILED";
    const status = message === "EDITORIAL_CAMPAIGN_LINK_NOT_CONFIGURED" ? 400 : 500;
    return NextResponse.json(
      {
        error: status === 500 ? "EDITORIAL_CAMPAIGN_FAILED" : message,
        message:
          message === "EDITORIAL_CAMPAIGN_LINK_NOT_CONFIGURED"
            ? "실제 쿠팡 파트너스 링크를 설정한 뒤 배포 원고를 생성하세요."
            : "배포 원고를 생성하지 못했습니다."
      },
      { status }
    );
  }
}
