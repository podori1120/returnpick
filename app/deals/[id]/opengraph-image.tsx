import { ImageResponse } from "next/og";
import { formatPrice } from "@/lib/format";
import { getSiteUrl } from "@/lib/siteUrl";

export const runtime = "edge";
export const alt = "ReturnPick | 리턴픽 딜";
export const size = { width: 1200, height: 630 };

type PublicDeal = {
  id: string;
  title: string;
  return_price?: number | null;
  source_price?: number | null;
  new_price?: number | null;
  naver_lowest_price?: number | null;
};

async function getDeal(id: string): Promise<PublicDeal | null> {
  const siteUrl = getSiteUrl();
  const response = await fetch(`${siteUrl}/api/products/compare?ids=${encodeURIComponent(id)}`, {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { products?: PublicDeal[] };
  const product = data.products?.[0];
  return product?.id === id ? product : null;
}

export default async function OpenGraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = await getDeal(id);

  const title = deal?.title ?? "딜을 찾을 수 없습니다";
  const returnPrice = deal?.return_price ?? deal?.source_price ?? null;
  const comparePrice = deal?.naver_lowest_price ?? deal?.new_price ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(135deg, #0f172a 0%, #0f766e 60%, #e0f2fe 120%)",
          color: "white",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.25)",
              fontSize: 34,
              fontWeight: 900
            }}
          >
            R
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1 }}>ReturnPick</div>
            <div style={{ fontSize: 18, fontWeight: 700, opacity: 0.92 }}>리턴픽 반품딜</div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 52, fontWeight: 900, lineHeight: 1.12, letterSpacing: -1.5 }}>
            {title.length > 52 ? `${title.slice(0, 52)}…` : title}
          </div>
          <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {returnPrice != null ? (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 999,
                  fontSize: 22,
                  fontWeight: 900,
                  backgroundColor: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.25)"
                }}
              >
                반품가 {formatPrice(returnPrice)}
              </div>
            ) : null}
            {comparePrice != null ? (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 999,
                  fontSize: 22,
                  fontWeight: 900,
                  backgroundColor: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.25)"
                }}
              >
                비교가 {formatPrice(comparePrice)}
              </div>
            ) : null}
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                fontSize: 22,
                fontWeight: 900,
                backgroundColor: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.25)"
              }}
            >
              검수된 추천 딜
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, opacity: 0.92 }}>{getSiteUrl().replace(/^https?:\/\//, "")}</div>
          <div style={{ fontSize: 18, fontWeight: 800, opacity: 0.92 }}>deals/{id.slice(0, 8)}</div>
        </div>
      </div>
    ),
    size
  );
}
