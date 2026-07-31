/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { approvalSampleProduct } from "@/lib/approvalSample";
import { getSiteUrl } from "@/lib/siteUrl";

export const runtime = "nodejs";
export const alt = "Novatech S1 창문 로봇청소기 구매 전 체크";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const productImageUrl = new URL(approvalSampleProduct.imageSrc, getSiteUrl()).toString();
  const productImageResponse = await fetch(productImageUrl, { cache: "force-cache" });
  if (!productImageResponse.ok) throw new Error("EDITORIAL_SOCIAL_IMAGE_SOURCE_FAILED");
  const productImageBuffer = await sharp(Buffer.from(await productImageResponse.arrayBuffer())).png().toBuffer();
  const productImageData = Uint8Array.from(productImageBuffer).buffer;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#f7faf8",
          color: "#13231d",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
        }}
      >
        <div
          style={{
            width: "55%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "50px 52px 46px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                  backgroundColor: "#177a62",
                  color: "white",
                  fontSize: 29,
                  fontWeight: 900
                }}
              >
                R
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 0 }}>ReturnPick</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#587068", letterSpacing: 0 }}>리턴픽 구매 전 체크</div>
              </div>
            </div>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#d85b48", letterSpacing: 0 }}>제휴 링크 포함</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#177a62", letterSpacing: 0 }}>직접 검수 추천</div>
            <div
              style={{
                marginTop: 13,
                display: "flex",
                flexDirection: "column",
                fontSize: 51,
                fontWeight: 900,
                lineHeight: 1.14,
                letterSpacing: 0
              }}
            >
              <div>Novatech S1</div>
              <div>창문 로봇청소기</div>
            </div>
            <div style={{ marginTop: 18, fontSize: 23, fontWeight: 800, color: "#465f56", letterSpacing: 0 }}>
              5800Pa 초강흡입력 · 자동 물 분사
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            <div style={{ display: "flex", gap: 9 }}>
              {["안전줄 확인", "창문 규격 확인", "가격·재고 실시간 확인"].map((label) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    padding: "8px 11px",
                    borderRadius: 7,
                    backgroundColor: label === "가격·재고 실시간 확인" ? "#fff4cf" : "#e2f2ec",
                    color: label === "가격·재고 실시간 확인" ? "#7a5a00" : "#155b49",
                    fontSize: 16,
                    fontWeight: 900,
                    letterSpacing: 0
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#587068", letterSpacing: 0 }}>
              구매 전 체크 먼저, 최종 거래 조건은 쿠팡에서 확인하세요.
            </div>
          </div>
        </div>

        <div
          style={{
            width: "45%",
            height: "100%",
            display: "flex",
            position: "relative",
            alignItems: "flex-start",
            justifyContent: "flex-end",
            overflow: "hidden",
            padding: 24,
            backgroundColor: "#dbe9e3"
          }}
        >
          <img
            alt=""
            height="630"
            src={productImageData as unknown as string}
            style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", objectFit: "cover" }}
            width="540"
          />
          <div
            style={{
              display: "flex",
              position: "relative",
              padding: "8px 11px",
              borderRadius: 7,
              backgroundColor: "rgba(255,255,255,0.94)",
              color: "#394f47",
              fontSize: 15,
              fontWeight: 900,
              letterSpacing: 0
            }}
          >
            제품 사용 연출 이미지
          </div>
        </div>
      </div>
    ),
    size
  );
}
