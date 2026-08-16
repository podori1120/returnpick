import { buildProductDistributionKit } from "@/lib/productDistributionKit";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { algumonTagCoupangDeals } from "./publish-real-algumon-deals.mjs";

function generateHtmlExport() {
  const sections = algumonTagCoupangDeals.map((deal, idx) => {
    const kit = buildProductDistributionKit(deal);
    return `
    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin-bottom: 32px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 16px;">
        <span style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 9999px; font-weight: bold; font-size: 13px;">#${idx + 1} ${deal.category}</span>
        <span style="color: #64748b; font-size: 13px;">알구몬 [쿠팡] 태그 원문 추출</span>
      </div>
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">${kit.blogger.title}</h2>
      
      <div style="background: #f8fafc; padding: 16px; border-radius: 6px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
        <label style="display: block; font-weight: bold; color: #334155; margin-bottom: 6px;">[구글 Blogger HTML 복사용 코드 (원클릭)]</label>
        <textarea style="width: 100%; height: 120px; font-family: monospace; font-size: 12px; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px;" readonly onclick="this.select();">${kit.blogger.html}</textarea>
      </div>

      <div style="background: #fdf2f8; padding: 16px; border-radius: 6px; margin-bottom: 16px; border: 1px solid #fbcfe8;">
        <label style="display: block; font-weight: bold; color: #831843; margin-bottom: 6px;">[네이버 블로그 / 일반 텍스트 복사용 (원클릭)]</label>
        <textarea style="width: 100%; height: 120px; font-family: sans-serif; font-size: 13px; box-sizing: border-box; border: 1px solid #f472b6; border-radius: 4px; padding: 8px;" readonly onclick="this.select();">${kit.naverBlog.body}</textarea>
      </div>

      <h3 style="font-size: 15px; color: #475569; margin-top: 20px;">포스팅 렌더링 미리보기</h3>
      <div style="border: 1px solid #e2e8f0; padding: 20px; border-radius: 6px; background: #ffffff;">
        ${kit.blogger.html}
      </div>
    </div>`;
  }).join("\n");

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>알구몬 [쿠팡] 태그 실제 8종 핫딜 포스팅 키트</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", sans-serif; line-height: 1.6; max-width: 960px; margin: 40px auto; padding: 0 20px; background: #f8fafc; color: #1e293b; }
    h1 { color: #0f172a; text-align: center; margin-bottom: 10px; font-size: 26px; }
    p.subtitle { text-align: center; color: #64748b; margin-bottom: 40px; font-size: 15px; }
  </style>
</head>
<body>
  <h1>알구몬(Algumon) [쿠팡] 태그 실제 게시물 8종 리뷰 키트</h1>
  <p class="subtitle">알구몬 핫딜 게시판에 등록된 실제 쿠팡 상품들을 파트너스 수익링크 및 공정위 대가성 문구가 포함된 리뷰로 변환한 데이터입니다.</p>
  ${sections}
</body>
</html>`;

  const outputPath = resolve(process.cwd(), "public/algumon_deals_preview.html");
  writeFileSync(outputPath, html, "utf-8");
  console.log(`[OK] 알구몬 [쿠팡] 태그 8종 HTML 내보내기 완료: ${outputPath}`);
}

generateHtmlExport();
