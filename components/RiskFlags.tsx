import type { RiskFlag } from "@/lib/types";

const labels: Record<RiskFlag, string> = {
  RISK_CONDITION_UNKNOWN: "반품등급 확인필요",
  RISK_PRICE_UNKNOWN: "가격 확인필요",
  RISK_BAD_PRICE_VS_NAVER: "네이버 대비 비쌈",
  RISK_FREEDOS: "FreeDOS",
  RISK_LOW_RAM: "RAM 낮음",
  RISK_GAMING_USED: "게이밍 중고 리스크",
  RISK_HIGH_PRICE_RETURN: "고가 반품",
  RISK_PANEL_DEFECT: "패널 리스크",
  RISK_DOCK_STATION_UNKNOWN: "도킹 확인필요",
  RISK_USED_BATTERY: "배터리 리스크",
  RISK_CONSUMABLES_UNKNOWN: "소모품 확인필요",
  RISK_FILTER_COST: "필터 비용",
  RISK_STOCK_ONE: "재고 1개"
};

export default function RiskFlags({ flags }: { flags?: RiskFlag[] | string[] | null }) {
  if (!flags?.length) {
    return <span className="text-sm font-semibold text-pine">주요 위험 플래그 없음</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {flags.map((flag) => (
        <span key={flag} className="rounded-md border border-coral/30 bg-coral/10 px-2 py-1 text-xs font-bold text-coral">
          {labels[flag as RiskFlag] ?? flag}
        </span>
      ))}
    </div>
  );
}
