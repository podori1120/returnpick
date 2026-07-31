import type { UseCaseId } from "@/lib/dealIntelligence";
import type { Category } from "@/lib/types";

export type HomePurposeId = "study_work" | "gaming_creator" | "cleaning" | "air_season" | "value";

export type HomePurposeOption = {
  id: HomePurposeId;
  label: string;
  eyebrow: string;
  description: string;
  icon: "briefcase" | "gamepad" | "bot" | "wind" | "percent";
  useCaseIds: UseCaseId[];
  primaryUseCaseId: UseCaseId;
  categories: Category[];
  checks: string[];
  guideHref: string;
};

export const homePurposeOptions: HomePurposeOption[] = [
  {
    id: "study_work",
    label: "사무·학업",
    eyebrow: "노트북·모니터",
    description: "문서, 강의, 재택근무에 필요한 성능과 설치 부담을 함께 봅니다.",
    icon: "briefcase",
    useCaseIds: ["office_student", "portable"],
    primaryUseCaseId: "office_student",
    categories: ["laptop", "monitor"],
    checks: ["RAM 16GB와 SSD 512GB 기준", "FreeDOS 설치 비용과 난이도", "배터리·힌지·패널 상태"],
    guideHref: "/guide/safe-categories"
  },
  {
    id: "gaming_creator",
    label: "게이밍·작업",
    eyebrow: "성능형 노트북·모니터",
    description: "GPU와 화면 사양뿐 아니라 고가 반품에서 놓치기 쉬운 외관과 구성품을 확인합니다.",
    icon: "gamepad",
    useCaseIds: ["gaming", "creator"],
    primaryUseCaseId: "gaming",
    categories: ["laptop", "monitor"],
    checks: ["GPU·주사율·해상도 일치", "발열·팬 소음·전원 어댑터", "100만원 이상 반품 상태 근거"],
    guideHref: "/guide/return-checklist"
  },
  {
    id: "cleaning",
    label: "청소 자동화",
    eyebrow: "로봇·무선청소기",
    description: "청소 성능보다 먼저 도킹 스테이션, 배터리와 소모품 누락 위험을 봅니다.",
    icon: "bot",
    useCaseIds: ["floor_care"],
    primaryUseCaseId: "floor_care",
    categories: ["robot_vacuum", "cordless_vacuum"],
    checks: ["도킹 스테이션·브러시 구성", "배터리 사용 흔적과 충전 상태", "맵핑 초기화·필터 교체 비용"],
    guideHref: "/guide/return-checklist"
  },
  {
    id: "air_season",
    label: "공기·제습",
    eyebrow: "공기청정기·제습기",
    description: "사용 공간에 맞는 용량과 매년 들어가는 필터·관리 비용을 함께 비교합니다.",
    icon: "wind",
    useCaseIds: ["air_care", "rainy_season"],
    primaryUseCaseId: "air_care",
    categories: ["air_purifier", "dehumidifier"],
    checks: ["권장 평형·일일 제습량", "필터·물통·배수 호스 구성", "냄새·곰팡이·소음 흔적"],
    guideHref: "/guide/return-checklist"
  },
  {
    id: "value",
    label: "가성비",
    eyebrow: "동일 모델 가격 비교",
    description: "할인율 숫자보다 동일 모델 기준가와 추가 지출을 확인해 실제 절약액을 봅니다.",
    icon: "percent",
    useCaseIds: ["budget"],
    primaryUseCaseId: "budget",
    categories: ["laptop", "monitor", "robot_vacuum"],
    checks: ["네이버 동일 모델 최저가 근거", "구성품·OS·소모품 추가 비용", "실질 할인율 15% 이상인지"],
    guideHref: "/guide/safe-categories"
  }
];

export const homeCategoryDetails: Record<Category, { description: string }> = {
  laptop: { description: "RAM·SSD·배터리" },
  monitor: { description: "패널·해상도·주사율" },
  robot_vacuum: { description: "도킹·배터리·맵핑" },
  cordless_vacuum: { description: "배터리·필터·구성품" },
  air_purifier: { description: "평형·필터 비용" },
  dehumidifier: { description: "제습량·배수·소음" }
};
