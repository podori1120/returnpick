import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ReturnPick | 리턴픽";
export const size = { width: 1200, height: 630 };

export default function TwitterImage() {
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
              fontWeight: 800
            }}
          >
            R
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1 }}>ReturnPick</div>
            <div style={{ fontSize: 18, fontWeight: 700, opacity: 0.92 }}>리턴픽</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1.12, letterSpacing: -2 }}>
            반품 디지털 딜,
            <br />
            사기 전에 한 번 더 걸러드립니다
          </div>
          <div style={{ marginTop: 18, fontSize: 24, fontWeight: 700, opacity: 0.92 }}>
            공식 API · 최저가 비교 · 공개 문구 검증 · 관리자 검수
          </div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, opacity: 0.9 }}>returnpick</div>
      </div>
    ),
    size
  );
}
