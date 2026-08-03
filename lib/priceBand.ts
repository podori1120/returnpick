export type PriceBandId = "under_300k" | "under_700k" | "under_1200k" | "over_1200k";

export type PriceBand = {
  id: PriceBandId;
  label: string;
  description: string;
  min: number;
  max: number | null;
};

export const priceBandOptions: PriceBand[] = [
  { id: "under_300k", label: "30만원 미만", description: "모니터·생활가전 입문", min: 0, max: 300000 },
  { id: "under_700k", label: "30만~70만원 미만", description: "가성비 노트북·청소기", min: 300000, max: 700000 },
  { id: "under_1200k", label: "70만~120만원 미만", description: "고급형 노트북·로봇청소기", min: 700000, max: 1200000 },
  { id: "over_1200k", label: "120만원 이상", description: "프리미엄 후보", min: 1200000, max: null }
];

export function matchesPriceBandValue(price: number, priceBandId: PriceBandId) {
  const band = priceBandOptions.find((item) => item.id === priceBandId);
  if (!band || !Number.isFinite(price)) return false;
  return price >= band.min && (band.max == null || price < band.max);
}
