import { FlaskConical } from "lucide-react";

export default function DemoModeNotice({ count }: { count?: number }) {
  return (
    <aside className="rounded-lg border border-lemon bg-lemon/15 p-4 text-sm leading-6 text-ink" role="status">
      <div className="flex items-start gap-3">
        <FlaskConical className="mt-0.5 shrink-0 text-amber-700" size={19} aria-hidden />
        <div>
          <p className="font-black">로컬 데모 모드{count ? ` · 샘플 ${count.toLocaleString("ko-KR")}개` : ""}</p>
          <p className="mt-1 font-semibold text-steel">
            화면·검색·비교 흐름을 확인하기 위한 샘플입니다. 실제 쿠팡 가격·재고·반품등급과 상품별 제휴 링크가 아니며, 구매 버튼은 비활성화되어 있습니다.
          </p>
          <p className="mt-1 text-xs font-bold text-steel">운영 배포에서는 실제 소스와 상품별 파트너스 링크 검수를 통과한 상품만 공개됩니다.</p>
        </div>
      </div>
    </aside>
  );
}
