import { categoryOptions, getCategoryLabel } from "@/lib/category";
import { calculateDiscountRate } from "@/lib/format";
import { getPriceReferenceInfo } from "@/lib/priceReference";
import { getDealQuality } from "@/lib/quality";
import type { Category, ProductWithScore } from "@/lib/types";

export type UseCaseId =
  | "office_student"
  | "gaming"
  | "creator"
  | "portable"
  | "budget"
  | "floor_care"
  | "air_care"
  | "rainy_season";

export type PriceBandId = "under_300k" | "under_700k" | "under_1200k" | "over_1200k";

export const useCaseOptions: Array<{ id: UseCaseId; label: string; description: string }> = [
  { id: "office_student", label: "사무·대학생", description: "문서, 강의, 재택용으로 무난한 딜" },
  { id: "gaming", label: "게이밍", description: "RTX, 고주사율, 성능형 후보" },
  { id: "creator", label: "작업·크리에이터", description: "고성능 CPU, RAM, 4K/QHD 중심" },
  { id: "portable", label: "휴대성", description: "가벼운 노트북과 이동용 후보" },
  { id: "budget", label: "가성비", description: "가격대와 할인율이 좋은 후보" },
  { id: "floor_care", label: "청소 자동화", description: "로봇청소기·무선청소기 중심" },
  { id: "air_care", label: "공기·필터", description: "공기청정기와 필터 확인 후보" },
  { id: "rainy_season", label: "장마·제습", description: "제습기와 습도 관리 후보" }
];

export const priceBandOptions: Array<{ id: PriceBandId; label: string; description: string; min: number; max: number | null }> = [
  { id: "under_300k", label: "30만원 이하", description: "모니터·생활가전 입문", min: 0, max: 300000 },
  { id: "under_700k", label: "70만원 이하", description: "가성비 노트북·청소기", min: 300000, max: 700000 },
  { id: "under_1200k", label: "120만원 이하", description: "고급형 노트북·로봇청소기", min: 700000, max: 1200000 },
  { id: "over_1200k", label: "120만원 이상", description: "프리미엄 후보", min: 1200000, max: null }
];

export type UseCaseMatch = {
  id: UseCaseId;
  label: string;
  score: number;
  reason: string;
};

function textOf(product: ProductWithScore) {
  return `${product.title} ${product.brand ?? ""} ${product.model_name ?? ""}`.toLowerCase();
}

function hasAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle.toLowerCase()));
}

function numberSpec(product: ProductWithScore, key: string) {
  const value = product.spec_json?.[key];
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function getReferencePrice(product: ProductWithScore) {
  return getPriceReferenceInfo(product).value;
}

export function getDealPrice(product: ProductWithScore) {
  return product.return_price ?? product.source_price ?? product.new_price ?? null;
}

export function getDiscountRate(product: ProductWithScore) {
  return calculateDiscountRate(getReferencePrice(product), getDealPrice(product));
}

function addMatch(matches: UseCaseMatch[], id: UseCaseId, score: number, reason: string) {
  if (score <= 0) return;
  const option = useCaseOptions.find((item) => item.id === id);
  if (!option) return;
  matches.push({ id, label: option.label, score, reason });
}

export function getUseCaseMatches(product: ProductWithScore): UseCaseMatch[] {
  const text = textOf(product);
  const discount = getDiscountRate(product) ?? 0;
  const dealPrice = getDealPrice(product) ?? 0;
  const ram = numberSpec(product, "ram");
  const weight = numberSpec(product, "weight");
  const matches: UseCaseMatch[] = [];

  if (product.category === "laptop") {
    const isGaming = hasAny(text, ["rtx", "tuf", "리전", "legion", "빅터스", "victus", "msi", "gaming"]);
    const isHighSpec = hasAny(text, ["ultra 7", "i7", "ryzen 7", "32gb", "1tb", "rtx 4060", "rtx 4070", "m3"]);
    addMatch(matches, "office_student", isGaming ? 42 : 78 + (ram && ram >= 16 ? 10 : 0), "문서·강의·재택용으로 볼 만한 노트북입니다.");
    addMatch(matches, "gaming", isGaming ? 86 : 0, "그래픽카드나 게이밍 라인업이 확인됩니다.");
    addMatch(matches, "creator", isHighSpec ? 78 : 0, "CPU, RAM, 저장공간이 작업용 기준에 가깝습니다.");
    addMatch(matches, "portable", weight && weight <= 1.35 ? 86 : hasAny(text, ["그램", "맥북에어", "14"]) ? 72 : 0, "무게나 라인업상 휴대성을 기대할 수 있습니다.");
  }

  if (product.category === "monitor") {
    addMatch(matches, "office_student", hasAny(text, ["qhd", "27인치", "32인치", "ips"]) ? 74 : 48, "재택·문서 작업용 화면 구성이 무난합니다.");
    addMatch(matches, "gaming", hasAny(text, ["144hz", "165hz", "240hz", "울트라기어", "alienware", "mobiuz"]) ? 86 : 0, "고주사율 모니터 후보입니다.");
    addMatch(matches, "creator", hasAny(text, ["4k", "uhd", "qhd", "ips"]) ? 70 : 0, "해상도와 패널 기준으로 작업용 후보입니다.");
  }

  if (product.category === "robot_vacuum" || product.category === "cordless_vacuum") {
    addMatch(matches, "floor_care", 84, "청소 시간을 줄이는 생활가전 후보입니다.");
    if (hasAny(text, ["배터리", "필터", "도킹", "자동먼지비움"])) addMatch(matches, "budget", discount >= 0.18 ? 72 : 54, "구성품 확인 후 가격 차이를 볼 만합니다.");
  }

  if (product.category === "air_purifier") {
    addMatch(matches, "air_care", 86, "필터와 평형이 중요한 공기 관리 후보입니다.");
  }

  if (product.category === "dehumidifier") {
    addMatch(matches, "rainy_season", 88, "장마철 전후로 가격 변동을 보기 좋은 제습기 후보입니다.");
  }

  const budgetThreshold: Record<Category, number> = {
    laptop: 900000,
    monitor: 350000,
    robot_vacuum: 700000,
    cordless_vacuum: 450000,
    air_purifier: 300000,
    dehumidifier: 380000
  };
  if (dealPrice && dealPrice <= budgetThreshold[product.category] && discount >= 0.15) {
    addMatch(matches, "budget", 82, "가격대와 할인율이 함께 맞는 가성비 후보입니다.");
  }

  return matches.sort((a, b) => b.score - a.score);
}

export function getPrimaryUseCase(product: ProductWithScore) {
  return getUseCaseMatches(product)[0] ?? null;
}

export function matchesUseCase(product: ProductWithScore, useCaseId: UseCaseId) {
  return getUseCaseMatches(product).some((match) => match.id === useCaseId && match.score >= 60);
}

export function isUseCase(value: string | undefined): value is UseCaseId {
  return Boolean(value && useCaseOptions.some((option) => option.id === value));
}

export function isPriceBand(value: string | undefined): value is PriceBandId {
  return Boolean(value && priceBandOptions.some((option) => option.id === value));
}

export function matchesPriceBand(product: ProductWithScore, priceBandId: PriceBandId) {
  const band = priceBandOptions.find((item) => item.id === priceBandId);
  const price = getDealPrice(product);
  if (!band || price == null) return false;
  return price >= band.min && (band.max == null || price <= band.max);
}

export function buildDealRadar(products: ProductWithScore[]) {
  const topScore = [...products].sort((a, b) => (b.latest_score?.total_score ?? 0) - (a.latest_score?.total_score ?? 0))[0] ?? null;
  const topDiscount = [...products].sort((a, b) => (getDiscountRate(b) ?? -1) - (getDiscountRate(a) ?? -1))[0] ?? null;
  const readyCount = products.filter((product) => getDealQuality(product).status === "ready").length;
  const verifiedCount = products.filter((product) => product.return_price && !["확인필요", "알수없음"].includes(product.condition_grade)).length;
  const categorySignals = categoryOptions
    .map((category) => {
      const categoryProducts = products.filter((product) => product.category === category.value);
      const avgScore = categoryProducts.length
        ? Math.round(categoryProducts.reduce((sum, product) => sum + (product.latest_score?.total_score ?? 0), 0) / categoryProducts.length)
        : 0;
      const avgDiscount = categoryProducts.length
        ? categoryProducts.reduce((sum, product) => sum + Math.max(0, getDiscountRate(product) ?? 0), 0) / categoryProducts.length
        : 0;
      return {
        category: category.value,
        label: getCategoryLabel(category.value),
        count: categoryProducts.length,
        avgScore,
        avgDiscount,
        readyCount: categoryProducts.filter((product) => getDealQuality(product).status === "ready").length
      };
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.readyCount - a.readyCount || b.avgScore - a.avgScore);
  const useCaseCounts = useCaseOptions.map((option) => ({
    ...option,
    count: products.filter((product) => matchesUseCase(product, option.id)).length
  }));
  const priceBands = priceBandOptions.map((band) => ({
    ...band,
    count: products.filter((product) => matchesPriceBand(product, band.id)).length
  }));

  return {
    total: products.length,
    topScore,
    topDiscount,
    readyCount,
    verifiedCount,
    categorySignals,
    useCaseCounts,
    priceBands
  };
}

export function getRelatedProducts(product: ProductWithScore, candidates: ProductWithScore[], limit = 4) {
  const useCases = new Set(getUseCaseMatches(product).map((match) => match.id));
  return candidates
    .filter((candidate) => candidate.id !== product.id)
    .map((candidate) => {
      const sameCategory = candidate.category === product.category ? 35 : 0;
      const sharedUseCases = getUseCaseMatches(candidate).filter((match) => useCases.has(match.id)).length * 18;
      const scoreGap = Math.max(0, 20 - Math.abs((candidate.latest_score?.total_score ?? 0) - (product.latest_score?.total_score ?? 0)));
      const discountBoost = Math.max(0, getDiscountRate(candidate) ?? 0) * 25;
      return { candidate, rank: sameCategory + sharedUseCases + scoreGap + discountBoost };
    })
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit)
    .map((item) => item.candidate);
}
