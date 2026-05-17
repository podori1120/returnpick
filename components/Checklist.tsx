import type { Category } from "@/lib/types";

const checklist: Record<Category, string[]> = {
  laptop: ["외관 찍힘과 힌지 유격 확인", "배터리 사이클과 충전 상태 확인", "키보드, 터치패드, 포트 전체 테스트", "FreeDOS 여부와 OS 설치 비용 확인"],
  monitor: ["패널 멍, 빛샘, 불량화소 확인", "해상도와 주사율 설정 확인", "스탠드와 케이블 구성품 확인", "밝기 균일도와 입력 포트 테스트"],
  robot_vacuum: ["도킹스테이션 포함 여부 확인", "물걸레 패드와 먼지통 상태 확인", "맵핑과 센서 동작 확인", "소모품 교체 비용 확인"],
  cordless_vacuum: ["배터리 지속시간 확인", "거치대와 충전기 포함 여부 확인", "필터와 브러시 상태 확인", "흡입 단계별 소음 확인"],
  air_purifier: ["필터 잔량과 교체 비용 확인", "센서 수치 반응 확인", "팬 소음과 냄새 확인", "적정 평형 확인"],
  dehumidifier: ["물통 누수 확인", "연속배수 부품 확인", "컴프레서 소음 확인", "표기 용량과 사용 공간 확인"]
};

export default function Checklist({ category }: { category: Category }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {checklist[category].map((item) => (
        <li key={item} className="rounded-lg border border-line bg-white p-3 text-sm font-semibold text-ink">
          {item}
        </li>
      ))}
    </ul>
  );
}
