import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import path from "path";
import { readBootstrapCatalog } from "@/lib/bootstrapCatalog";
import { isGenericCoupangLandingUrl, isUsableAffiliateUrl } from "@/lib/coupangLink";
import { demoCatalog } from "@/lib/demoCatalog";
import { stableDemoProductId } from "@/lib/demoIdentity";
import { getCustomerPublishReadiness, getDealQuality } from "@/lib/quality";
import { getNaverPriceTrust } from "@/lib/naverPriceTrust";
import { isUsableProductImageUrl } from "@/lib/productImageUrl";
import { isDemoProduct, isLocalDemoModeEnabled } from "@/lib/publicDeal";
import { calculateDealScore, getLatestScore } from "@/lib/scoring";
import { isSourcingExecutionRun } from "@/lib/sourcingRunKinds";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { parseSpecsFromTitle } from "@/lib/specParser";
import type {
  AffiliateEvent,
  AffiliateEventType,
  Category,
  ConditionGrade,
  DealScore,
  ProductWithScore,
  ProductSnapshot,
  SnapshotChangeFlag,
  SourcedProduct,
  SourcingKeyword,
  SourcingRun,
  SourcingStatus,
  TelegramLog
} from "@/lib/types";

type KeywordInput = {
  keyword: string;
  category: Category;
  is_active?: boolean;
  min_price?: number | null;
  max_price?: number | null;
  min_discount_rate?: number | null;
};

type ProductInput = Partial<SourcedProduct> & Pick<SourcedProduct, "source" | "category" | "title">;
type AffiliateEventInput = {
  product_id?: string | null;
  event_type: AffiliateEventType;
  channel?: string | null;
  context?: string | null;
  anon_session_id?: string | null;
  referrer?: string | null;
  utm_source?: string | null;
};
type ProductFilters = {
  status?: SourcingStatus;
  published?: boolean;
  category?: Category;
  search?: string;
};

const now = () => new Date().toISOString();

function normalizeKeywordKey(keyword: string) {
  return keyword.trim().toLowerCase();
}

export const DEFAULT_SOURCING_KEYWORDS: KeywordInput[] = [
  { keyword: "갤럭시북", category: "laptop", min_price: 400000, max_price: 1800000, min_discount_rate: 0.1 },
  { keyword: "LG 그램", category: "laptop", min_price: 600000, max_price: 2200000, min_discount_rate: 0.1 },
  { keyword: "레노버 아이디어패드", category: "laptop", min_price: 350000, max_price: 1400000, min_discount_rate: 0.12 },
  { keyword: "레노버 리전", category: "laptop", min_price: 700000, max_price: 2400000, min_discount_rate: 0.15 },
  { keyword: "HP 빅터스", category: "laptop", min_price: 600000, max_price: 1800000, min_discount_rate: 0.15 },
  { keyword: "ASUS TUF", category: "laptop", min_price: 700000, max_price: 2200000, min_discount_rate: 0.15 },
  { keyword: "맥북", category: "laptop", min_price: 700000, max_price: 2600000, min_discount_rate: 0.08 },
  { keyword: "MSI 노트북", category: "laptop", min_price: 600000, max_price: 2200000, min_discount_rate: 0.15 },
  { keyword: "갤럭시북 프로", category: "laptop", min_price: 600000, max_price: 2200000, min_discount_rate: 0.1 },
  { keyword: "갤럭시북 울트라", category: "laptop", min_price: 600000, max_price: 2800000, min_discount_rate: 0.1 },
  { keyword: "LG 그램 16", category: "laptop", min_price: 600000, max_price: 2200000, min_discount_rate: 0.1 },
  { keyword: "LG 그램 프로", category: "laptop", min_price: 800000, max_price: 2500000, min_discount_rate: 0.1 },
  { keyword: "아이디어패드 슬림", category: "laptop", min_price: 350000, max_price: 1400000, min_discount_rate: 0.12 },
  { keyword: "리전 5", category: "laptop", min_price: 700000, max_price: 2400000, min_discount_rate: 0.15 },
  { keyword: "맥북 에어", category: "laptop", min_price: 700000, max_price: 2600000, min_discount_rate: 0.08 },
  { keyword: "맥북 프로", category: "laptop", min_price: 900000, max_price: 3000000, min_discount_rate: 0.08 },
  { keyword: "QHD 모니터", category: "monitor", min_price: 150000, max_price: 800000, min_discount_rate: 0.12 },
  { keyword: "4K 모니터", category: "monitor", min_price: 200000, max_price: 1100000, min_discount_rate: 0.12 },
  { keyword: "144Hz 모니터", category: "monitor", min_price: 150000, max_price: 900000, min_discount_rate: 0.12 },
  { keyword: "27인치 모니터", category: "monitor", min_price: 100000, max_price: 700000, min_discount_rate: 0.1 },
  { keyword: "LG 울트라기어", category: "monitor", min_price: 200000, max_price: 1000000, min_discount_rate: 0.12 },
  { keyword: "삼성 오디세이", category: "monitor", min_price: 250000, max_price: 1200000, min_discount_rate: 0.12 },
  { keyword: "USB-C 모니터", category: "monitor", min_price: 200000, max_price: 1200000, min_discount_rate: 0.1 },
  { keyword: "32인치 4K 모니터", category: "monitor", min_price: 250000, max_price: 1100000, min_discount_rate: 0.12 },
  { keyword: "27인치 QHD 모니터", category: "monitor", min_price: 150000, max_price: 800000, min_discount_rate: 0.12 },
  { keyword: "게이밍 모니터", category: "monitor", min_price: 150000, max_price: 1000000, min_discount_rate: 0.12 },
  { keyword: "로보락", category: "robot_vacuum", min_price: 300000, max_price: 1600000, min_discount_rate: 0.12 },
  { keyword: "드리미 로봇청소기", category: "robot_vacuum", min_price: 250000, max_price: 1500000, min_discount_rate: 0.12 },
  { keyword: "샤오미 로봇청소기", category: "robot_vacuum", min_price: 150000, max_price: 900000, min_discount_rate: 0.12 },
  { keyword: "로보락 Qrevo", category: "robot_vacuum", min_price: 500000, max_price: 1600000, min_discount_rate: 0.12 },
  { keyword: "로보락 S8", category: "robot_vacuum", min_price: 400000, max_price: 1600000, min_discount_rate: 0.12 },
  { keyword: "드리미 X40", category: "robot_vacuum", min_price: 500000, max_price: 1800000, min_discount_rate: 0.12 },
  { keyword: "드리미 L10s", category: "robot_vacuum", min_price: 300000, max_price: 1400000, min_discount_rate: 0.12 },
  { keyword: "올인원 로봇청소기", category: "robot_vacuum", min_price: 300000, max_price: 1800000, min_discount_rate: 0.12 },
  { keyword: "다이슨 무선청소기", category: "cordless_vacuum", min_price: 250000, max_price: 1200000, min_discount_rate: 0.1 },
  { keyword: "삼성 제트", category: "cordless_vacuum", min_price: 200000, max_price: 1000000, min_discount_rate: 0.12 },
  { keyword: "LG 코드제로", category: "cordless_vacuum", min_price: 250000, max_price: 1200000, min_discount_rate: 0.12 },
  { keyword: "다이슨 V12", category: "cordless_vacuum", min_price: 250000, max_price: 1200000, min_discount_rate: 0.1 },
  { keyword: "다이슨 V15", category: "cordless_vacuum", min_price: 400000, max_price: 1400000, min_discount_rate: 0.1 },
  { keyword: "삼성 제트 220W", category: "cordless_vacuum", min_price: 300000, max_price: 1100000, min_discount_rate: 0.12 },
  { keyword: "LG 코드제로 A9", category: "cordless_vacuum", min_price: 250000, max_price: 1200000, min_discount_rate: 0.12 },
  { keyword: "삼성 공기청정기", category: "air_purifier", min_price: 100000, max_price: 900000, min_discount_rate: 0.1 },
  { keyword: "LG 공기청정기", category: "air_purifier", min_price: 150000, max_price: 1000000, min_discount_rate: 0.1 },
  { keyword: "위닉스 공기청정기", category: "air_purifier", min_price: 80000, max_price: 600000, min_discount_rate: 0.1 },
  { keyword: "삼성 블루스카이", category: "air_purifier", min_price: 100000, max_price: 900000, min_discount_rate: 0.1 },
  { keyword: "LG 퓨리케어", category: "air_purifier", min_price: 150000, max_price: 1000000, min_discount_rate: 0.1 },
  { keyword: "위닉스 타워", category: "air_purifier", min_price: 80000, max_price: 600000, min_discount_rate: 0.1 },
  { keyword: "20평 공기청정기", category: "air_purifier", min_price: 100000, max_price: 700000, min_discount_rate: 0.1 },
  { keyword: "위닉스 제습기", category: "dehumidifier", min_price: 100000, max_price: 700000, min_discount_rate: 0.1 },
  { keyword: "LG 제습기", category: "dehumidifier", min_price: 150000, max_price: 900000, min_discount_rate: 0.1 },
  { keyword: "삼성 제습기", category: "dehumidifier", min_price: 150000, max_price: 900000, min_discount_rate: 0.1 },
  { keyword: "위닉스 뽀송", category: "dehumidifier", min_price: 100000, max_price: 700000, min_discount_rate: 0.1 },
  { keyword: "LG 휘센 제습기", category: "dehumidifier", min_price: 150000, max_price: 900000, min_discount_rate: 0.1 },
  { keyword: "삼성 인버터 제습기", category: "dehumidifier", min_price: 150000, max_price: 900000, min_discount_rate: 0.1 },
  { keyword: "16L 제습기", category: "dehumidifier", min_price: 100000, max_price: 700000, min_discount_rate: 0.1 }
];

function makeKeyword(keyword: string, category: Category, min_price: number | null, max_price: number | null, min_discount_rate: number | null): SourcingKeyword {
  const stamp = now();
  return {
    id: randomUUID(),
    keyword,
    category,
    is_active: true,
    min_price,
    max_price,
    min_discount_rate,
    created_at: stamp,
    updated_at: stamp
  };
}

function createInitialKeywords(): SourcingKeyword[] {
  return DEFAULT_SOURCING_KEYWORDS.map((input) =>
    makeKeyword(input.keyword, input.category, input.min_price ?? null, input.max_price ?? null, input.min_discount_rate ?? null)
  );
}

function makeProduct(input: ProductInput): SourcedProduct {
  const stamp = now();
  const stableId =
    !input.id && input.source === "mock" && input.source_product_id
      ? stableDemoProductId(input.source_product_id)
      : null;
  return {
    id: input.id ?? stableId ?? randomUUID(),
    source: input.source,
    source_product_id: input.source_product_id ?? null,
    category: input.category,
    keyword: input.keyword ?? null,
    title: input.title,
    brand: input.brand ?? null,
    model_name: input.model_name ?? null,
    image_url: input.image_url ?? null,
    source_url: input.source_url ?? null,
    coupang_url: input.coupang_url ?? null,
    affiliate_url: input.affiliate_url ?? null,
    source_price: input.source_price ?? null,
    return_price: input.return_price ?? null,
    new_price: input.new_price ?? null,
    naver_lowest_price: input.naver_lowest_price ?? null,
    condition_grade: input.condition_grade ?? "확인필요",
    stock_count: input.stock_count ?? null,
    spec_json: input.spec_json ?? parseSpecsFromTitle(input.title, input.category),
    raw_json: input.raw_json ?? {},
    sourcing_status: input.sourcing_status ?? "candidate",
    is_published: input.is_published ?? false,
    is_rejected: input.is_rejected ?? false,
    rejection_reason: input.rejection_reason ?? null,
    admin_memo: input.admin_memo ?? null,
    public_note: input.public_note ?? null,
    last_observed_at: input.last_observed_at === undefined ? stamp : input.last_observed_at,
    created_at: input.created_at ?? stamp,
    updated_at: input.updated_at ?? stamp
  };
}

const weakConditionGrades = new Set<ConditionGrade>(["확인필요", "알수없음"]);

function isWeakConditionGrade(value: ConditionGrade | null | undefined) {
  return !value || weakConditionGrades.has(value);
}

function preserveExistingReviewFields(existing: SourcedProduct, payload: SourcedProduct) {
  return {
    return_price: payload.return_price ?? existing.return_price,
    new_price: payload.new_price ?? existing.new_price,
    naver_lowest_price: payload.naver_lowest_price ?? existing.naver_lowest_price,
    stock_count: payload.stock_count ?? existing.stock_count,
    source_price: payload.source_price ?? existing.source_price,
    condition_grade:
      isWeakConditionGrade(payload.condition_grade) && !isWeakConditionGrade(existing.condition_grade)
        ? existing.condition_grade
        : payload.condition_grade,
    admin_memo: existing.admin_memo,
    public_note: existing.public_note,
    last_observed_at: payload.last_observed_at ?? existing.last_observed_at,
    image_url: isUsableProductImageUrl(existing.image_url) ? existing.image_url : payload.image_url,
    affiliate_url: isUsableAffiliateUrl(existing.affiliate_url) ? existing.affiliate_url : payload.affiliate_url,
    raw_json: {
      ...(existing.raw_json ?? {}),
      ...(payload.raw_json ?? {})
    }
  };
}

function createInitialProducts(): SourcedProduct[] {
  if (!isLocalDemoModeEnabled()) return [];

  return demoCatalog.map((item) =>
    makeProduct({
      ...item,
      sourcing_status: "published",
      is_published: true,
      raw_json: {
        provider: "expanded_demo_catalog",
        demo_seed: item.source_product_id,
        web_return_info: {
          is_return_candidate: true,
          condition_grade: item.condition_grade,
          return_price: item.return_price,
          stock_count: item.stock_count,
          evidence: ["데모 카탈로그의 반품등급과 반품가가 입력되어 있습니다."],
          confidence: item.return_price ? 90 : 50
        }
      }
    })
  );
}

function removeDemoProductsFromMemoryState(state: MemoryState): MemoryState {
  if (isLocalDemoModeEnabled()) return state;

  const demoProductIds = new Set(state.products.filter(isDemoProduct).map((product) => product.id));
  if (!demoProductIds.size) return state;

  state.products = state.products.filter((product) => !demoProductIds.has(product.id));
  state.scores = state.scores.filter((score) => !demoProductIds.has(score.product_id));
  state.snapshots = state.snapshots.filter((snapshot) => !demoProductIds.has(snapshot.product_id));
  state.telegramLogs = state.telegramLogs.filter((log) => !log.product_id || !demoProductIds.has(log.product_id));
  state.affiliateEvents = state.affiliateEvents.filter((event) => !event.product_id || !demoProductIds.has(event.product_id));
  return state;
}

type MemoryState = {
  keywords: SourcingKeyword[];
  products: SourcedProduct[];
  scores: DealScore[];
  snapshots: ProductSnapshot[];
  runs: SourcingRun[];
  telegramLogs: TelegramLog[];
  affiliateEvents: AffiliateEvent[];
};

declare global {
  // eslint-disable-next-line no-var
  var __returnpickMemory: MemoryState | undefined;
}

type SnapshotOrigin = "bootstrap" | "manual" | "sourcing" | "admin" | "unknown";

function makeSnapshot(product: SourcedProduct, changeFlags: SnapshotChangeFlag[] = [], observationOrigin: SnapshotOrigin = "unknown"): ProductSnapshot {
  return {
    id: randomUUID(),
    product_id: product.id,
    observed_at: now(),
    source_price: product.source_price,
    return_price: product.return_price,
    new_price: product.new_price,
    naver_lowest_price: product.naver_lowest_price,
    stock_count: product.stock_count,
    condition_grade: product.condition_grade,
    change_flags: changeFlags,
    raw_json: {
      source: product.source,
      source_product_id: product.source_product_id,
      status: product.sourcing_status,
      observation_origin: observationOrigin
    }
  };
}

function getSnapshotChangeFlags(previous: SourcedProduct | null | undefined, next: SourcedProduct): SnapshotChangeFlag[] {
  if (!previous) return ["NEW_PRODUCT"];
  const flags: SnapshotChangeFlag[] = [];
  if (previous.source_price !== next.source_price) flags.push("SOURCE_PRICE_CHANGED");
  if (previous.return_price !== next.return_price) flags.push("RETURN_PRICE_CHANGED");
  if (previous.new_price !== next.new_price) flags.push("NEW_PRICE_CHANGED");
  if (previous.naver_lowest_price !== next.naver_lowest_price) flags.push("NAVER_PRICE_CHANGED");
  if (previous.stock_count !== next.stock_count) flags.push("STOCK_CHANGED");
  if (previous.condition_grade !== next.condition_grade) flags.push("CONDITION_CHANGED");
  if ((previous.stock_count ?? 1) > 0 && next.stock_count === 0) flags.push("SOLD_OUT");
  if (previous.stock_count === 0 && (next.stock_count ?? 0) > 0) flags.push("BACK_IN_STOCK");
  return Array.from(new Set(flags));
}

function createMemoryState(): MemoryState {
  const products = createInitialProducts();
  return hydrateBootstrapCatalog(hydrateDemoCatalog({
    keywords: createInitialKeywords(),
    products,
    scores: products.map((product) => ({
      ...calculateDealScore(product),
      id: randomUUID(),
      product_id: product.id
    })),
    snapshots: products.map((product) => makeSnapshot(product, ["NEW_PRODUCT"])),
    runs: [],
    telegramLogs: [],
    affiliateEvents: []
  }));
}

const localDbPath = path.join(process.cwd(), ".returnpick", "local-db.json");

function hydrateDemoCatalog(state: MemoryState): MemoryState {
  const seeds = createInitialProducts();
  for (const seed of seeds) {
    const existing = state.products.find((product) => product.source === seed.source && product.source_product_id === seed.source_product_id);
    if (!existing) {
      state.products.unshift(seed);
      state.scores.unshift({
        ...calculateDealScore(seed),
        id: randomUUID(),
        product_id: seed.id
      });
      state.snapshots.unshift(makeSnapshot(seed, ["NEW_PRODUCT"]));
      continue;
    }

    if (existing.source_product_id?.startsWith("seed-")) {
      const previousId = existing.id;
      if (previousId !== seed.id) {
        existing.id = seed.id;
        state.scores = state.scores.map((score) => (score.product_id === previousId ? { ...score, product_id: seed.id } : score));
        state.snapshots = state.snapshots.map((snapshot) => (snapshot.product_id === previousId ? { ...snapshot, product_id: seed.id } : snapshot));
        state.telegramLogs = state.telegramLogs.map((log) => (log.product_id === previousId ? { ...log, product_id: seed.id } : log));
        state.affiliateEvents = state.affiliateEvents.map((event) => (event.product_id === previousId ? { ...event, product_id: seed.id } : event));
      }
      existing.sourcing_status = "published";
      existing.is_published = true;
      existing.is_rejected = false;
      existing.rejection_reason = null;
      const hasPlaceholderAffiliateUrl = !isUsableAffiliateUrl(existing.affiliate_url);
      existing.affiliate_url = hasPlaceholderAffiliateUrl ? seed.affiliate_url : existing.affiliate_url;
      existing.source_url =
        !existing.source_url || existing.source_url.includes("example.com") || isGenericCoupangLandingUrl(existing.source_url)
          ? seed.source_url
          : existing.source_url;
      existing.coupang_url =
        !existing.coupang_url || existing.coupang_url.includes("example.com") || isGenericCoupangLandingUrl(existing.coupang_url)
          ? seed.coupang_url
          : existing.coupang_url;
      existing.public_note = existing.public_note ?? seed.public_note;
      existing.image_url = existing.image_url ?? seed.image_url;
      if (!state.scores.some((score) => score.product_id === existing.id)) {
        state.scores.unshift({
          ...calculateDealScore(existing),
          id: randomUUID(),
          product_id: existing.id
        });
      }
      if (!state.snapshots.some((snapshot) => snapshot.product_id === existing.id)) {
        state.snapshots.unshift(makeSnapshot(existing, ["NEW_PRODUCT"]));
      }
    }
  }
  return state;
}

function hydrateBootstrapCatalog(state: MemoryState): MemoryState {
  const catalog = readBootstrapCatalog();
  if (!catalog.configured) return state;
  if (!catalog.ok) {
    console.error("RETURNPICK_BOOTSTRAP_CATALOG_REJECTED", {
      issue_count: catalog.issues.length,
      issue_codes: Array.from(new Set(catalog.issues.map((issue) => issue.code))).slice(0, 8),
      byte_size: catalog.byte_size
    });
    return state;
  }

  for (const product of catalog.products) {
    const existingIndex = state.products.findIndex(
      (item) =>
        item.id === product.id ||
        (item.source === product.source && item.source_product_id === product.source_product_id)
    );
    if (existingIndex >= 0) state.products[existingIndex] = product;
    else state.products.unshift(product);

    state.scores = state.scores.filter((score) => score.product_id !== product.id);
    state.scores.unshift({
      ...calculateDealScore(product),
      id: randomUUID(),
      product_id: product.id
    });

    if (!state.snapshots.some((snapshot) => snapshot.product_id === product.id)) {
      const snapshot = makeSnapshot(product, ["NEW_PRODUCT"]);
      snapshot.observed_at = product.last_observed_at ?? product.updated_at;
      state.snapshots.unshift(snapshot);
    }
  }
  return state;
}

function loadMemoryState(): MemoryState {
  if (!existsSync(localDbPath)) return createMemoryState();
  try {
    const parsed = JSON.parse(readFileSync(localDbPath, "utf8")) as Partial<MemoryState>;
    const fallback = createMemoryState();
    return hydrateBootstrapCatalog(hydrateDemoCatalog(removeDemoProductsFromMemoryState({
      keywords: Array.isArray(parsed.keywords) ? (parsed.keywords as SourcingKeyword[]) : fallback.keywords,
      products: Array.isArray(parsed.products) ? (parsed.products as SourcedProduct[]) : fallback.products,
      scores: Array.isArray(parsed.scores) ? (parsed.scores as DealScore[]) : fallback.scores,
      snapshots: Array.isArray(parsed.snapshots) ? (parsed.snapshots as ProductSnapshot[]) : fallback.snapshots,
      runs: Array.isArray(parsed.runs) ? (parsed.runs as SourcingRun[]) : fallback.runs,
      telegramLogs: Array.isArray(parsed.telegramLogs) ? (parsed.telegramLogs as TelegramLog[]) : fallback.telegramLogs,
      affiliateEvents: Array.isArray(parsed.affiliateEvents) ? (parsed.affiliateEvents as AffiliateEvent[]) : fallback.affiliateEvents
    })));
  } catch {
    return createMemoryState();
  }
}

function persistMemoryState() {
  try {
    mkdirSync(path.dirname(localDbPath), { recursive: true });
    const tmpPath = `${localDbPath}.tmp`;
    writeFileSync(tmpPath, `${JSON.stringify(memoryState, null, 2)}\n`, "utf8");
    renameSync(tmpPath, localDbPath);
  } catch {
    // Local persistence is a development convenience; Supabase remains the production store.
  }
}

const memoryState = globalThis.__returnpickMemory ?? (globalThis.__returnpickMemory = loadMemoryState());
const memoryKeywords = memoryState.keywords;
const memoryProducts = memoryState.products;
const memoryScores = memoryState.scores;
const memorySnapshots = memoryState.snapshots;
const memoryRuns = memoryState.runs;
const memoryTelegramLogs = memoryState.telegramLogs;
const memoryAffiliateEvents = memoryState.affiliateEvents;

function normalizeProductFromDb(product: ProductWithScore): ProductWithScore {
  const dealScores = [...(product.deal_scores ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const snapshots = [...(product.product_snapshots ?? product.snapshots ?? [])].sort((a, b) => b.observed_at.localeCompare(a.observed_at));
  const normalized = {
    ...product,
    latest_score: dealScores[0] ?? null,
    deal_scores: dealScores,
    snapshots,
    latest_snapshot: snapshots[0] ?? null
  };
  return { ...normalized, latest_score: getLatestScore(normalized) };
}

function attachMemoryScore(product: SourcedProduct): ProductWithScore {
  const dealScores = memoryScores.filter((score) => score.product_id === product.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const snapshots = memorySnapshots.filter((snapshot) => snapshot.product_id === product.id).sort((a, b) => b.observed_at.localeCompare(a.observed_at));
  const normalized = {
    ...product,
    deal_scores: dealScores,
    latest_score: dealScores[0] ?? null,
    snapshots,
    latest_snapshot: snapshots[0] ?? null
  };
  return { ...normalized, latest_score: getLatestScore(normalized) };
}

export async function listKeywords(options?: { activeOnly?: boolean }) {
  const client = getSupabaseServiceClient();
  if (client) {
    let query = client.from("sourcing_keywords").select("*").order("created_at", { ascending: false });
    if (options?.activeOnly) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as SourcingKeyword[];
  }

  return memoryKeywords
    .filter((keyword) => (options?.activeOnly ? keyword.is_active : true))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function ensureDefaultSourcingKeywords() {
  const existing = await listKeywords();
  const existingKeys = new Set(existing.map((keyword) => `${keyword.category}:${normalizeKeywordKey(keyword.keyword)}`));
  const missingDefaults = DEFAULT_SOURCING_KEYWORDS.filter(
    (keyword) => !existingKeys.has(`${keyword.category}:${normalizeKeywordKey(keyword.keyword)}`)
  );
  if (!missingDefaults.length) return { inserted_count: 0, skipped: true, keyword_count: existing.length };

  const client = getSupabaseServiceClient();
  if (client) {
    const { data, error } = await client
      .from("sourcing_keywords")
      .upsert(missingDefaults.map((keyword) => ({ ...keyword, is_active: keyword.is_active ?? true })), {
        onConflict: "keyword_key,category",
        ignoreDuplicates: true
      })
      .select("*");
    if (error) throw error;
    return { inserted_count: data?.length ?? 0, skipped: false, keyword_count: existing.length + (data?.length ?? 0) };
  }

  const created = missingDefaults.map((input) =>
    makeKeyword(input.keyword, input.category, input.min_price ?? null, input.max_price ?? null, input.min_discount_rate ?? null)
  );
  memoryKeywords.unshift(...created);
  persistMemoryState();
  return { inserted_count: created.length, skipped: false, keyword_count: existing.length + created.length };
}

export async function createKeyword(input: KeywordInput) {
  const normalizedInput = {
    ...input,
    keyword: input.keyword.trim()
  };
  const client = getSupabaseServiceClient();
  if (client) {
    const { data, error } = await client.from("sourcing_keywords").insert(normalizedInput).select("*").single();
    if (error) {
      if (error.code === "23505") {
        const { data: keywords, error: selectError } = await client.from("sourcing_keywords").select("*").eq("category", input.category);
        if (selectError) throw selectError;
        const existing = (keywords ?? []).find((keyword) => normalizeKeywordKey(String(keyword.keyword ?? "")) === normalizeKeywordKey(normalizedInput.keyword));
        if (existing) return existing as SourcingKeyword;
      }
      throw error;
    }
    return data as SourcingKeyword;
  }

  const existing = memoryKeywords.find(
    (keyword) => keyword.category === normalizedInput.category && normalizeKeywordKey(keyword.keyword) === normalizeKeywordKey(normalizedInput.keyword)
  );
  if (existing) return existing;

  const keyword = makeKeyword(normalizedInput.keyword, normalizedInput.category, normalizedInput.min_price ?? null, normalizedInput.max_price ?? null, normalizedInput.min_discount_rate ?? null);
  keyword.is_active = normalizedInput.is_active ?? true;
  memoryKeywords.unshift(keyword);
  persistMemoryState();
  return keyword;
}

export async function updateKeyword(id: string, patch: Partial<KeywordInput>) {
  const client = getSupabaseServiceClient();
  if (client) {
    const { data, error } = await client.from("sourcing_keywords").update(patch).eq("id", id).select("*").single();
    if (error) throw error;
    return data as SourcingKeyword;
  }

  const index = memoryKeywords.findIndex((keyword) => keyword.id === id);
  if (index < 0) throw new Error("KEYWORD_NOT_FOUND");
  memoryKeywords[index] = {
    ...memoryKeywords[index],
    ...patch,
    updated_at: now()
  };
  persistMemoryState();
  return memoryKeywords[index];
}

export async function listProducts(filters?: ProductFilters) {
  const client = getSupabaseServiceClient();
  if (client) {
    let query = client.from("sourced_products").select("*, deal_scores(*), product_snapshots(*)").order("created_at", { ascending: false });
    if (filters?.status) query = query.eq("sourcing_status", filters.status);
    if (typeof filters?.published === "boolean") query = query.eq("is_published", filters.published);
    if (filters?.category) query = query.eq("category", filters.category);
    if (filters?.search) query = query.ilike("title", `%${filters.search}%`);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as ProductWithScore[]).map(normalizeProductFromDb);
  }

  return memoryProducts
    .filter((product) => (filters?.status ? product.sourcing_status === filters.status : true))
    .filter((product) => (typeof filters?.published === "boolean" ? product.is_published === filters.published : true))
    .filter((product) => (filters?.category ? product.category === filters.category : true))
    .filter((product) => (filters?.search ? product.title.toLowerCase().includes(filters.search.toLowerCase()) : true))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(attachMemoryScore);
}

export async function getProductById(id: string) {
  const client = getSupabaseServiceClient();
  if (client) {
    const { data, error } = await client.from("sourced_products").select("*, deal_scores(*), product_snapshots(*)").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? normalizeProductFromDb(data as ProductWithScore) : null;
  }

  const product = memoryProducts.find((item) => item.id === id);
  return product ? attachMemoryScore(product) : null;
}

export async function createProductSnapshot(product: SourcedProduct, changeFlags: SnapshotChangeFlag[] = [], observationOrigin: SnapshotOrigin = "manual") {
  const snapshot = makeSnapshot(product, changeFlags, observationOrigin);
  const client = getSupabaseServiceClient();
  if (client) {
    const { data, error } = await client.from("product_snapshots").insert(snapshot).select("*").single();
    if (error) throw error;
    return data as ProductSnapshot;
  }

  memorySnapshots.unshift(snapshot);
  persistMemoryState();
  return snapshot;
}

function snapshotErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message.slice(0, 300) : "PRODUCT_SNAPSHOT_SAVE_FAILED";
}

async function createProductSnapshotSafely(
  product: SourcedProduct,
  changeFlags: SnapshotChangeFlag[] = [],
  observationOrigin: SnapshotOrigin = "manual"
) {
  if (changeFlags.length === 0) return;
  try {
    await createProductSnapshot(product, changeFlags, observationOrigin);
  } catch (error) {
    console.warn("PRODUCT_SNAPSHOT_SAVE_FAILED", {
      product_id: product.id,
      flags: changeFlags,
      error: snapshotErrorMessage(error)
    });
  }
}

export async function listProductSnapshots(productId: string, limit = 12) {
  const client = getSupabaseServiceClient();
  if (client) {
    const { data, error } = await client
      .from("product_snapshots")
      .select("*")
      .eq("product_id", productId)
      .order("observed_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as ProductSnapshot[];
  }

  return memorySnapshots
    .filter((snapshot) => snapshot.product_id === productId)
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at))
    .slice(0, limit);
}

export async function insertSourcedProduct(input: ProductInput) {
  const client = getSupabaseServiceClient();
  const payload = makeProduct(input);
  const insertPayload = { ...payload, id: input.id ?? undefined };

  if (client) {
    const { data, error } = await client.from("sourced_products").insert(insertPayload).select("*").single();
    if (error) throw error;
    const product = data as SourcedProduct;
    await createProductSnapshotSafely(product, ["NEW_PRODUCT"], "manual");
    return { product, inserted: true as const };
  }

  const existing = memoryProducts.find(
    (product) =>
      (payload.source_product_id && product.source === payload.source && product.source_product_id === payload.source_product_id) ||
      (product.category === payload.category && product.title.toLowerCase() === payload.title.toLowerCase())
  );
  if (existing) throw new Error("EXISTING_PRODUCT_CONFLICT");

  memoryProducts.unshift(payload);
  memorySnapshots.unshift(makeSnapshot(payload, ["NEW_PRODUCT"], "manual"));
  persistMemoryState();
  return { product: payload, inserted: true as const };
}

export async function upsertSourcedProduct(input: ProductInput) {
  const client = getSupabaseServiceClient();
  const payload = makeProduct(input);
  const insertPayload = { ...payload, id: input.id ?? undefined };

  if (client) {
    let existing: SourcedProduct | null = null;
    if (payload.source_product_id) {
      const { data, error } = await client
        .from("sourced_products")
        .select("*")
        .eq("source", payload.source)
        .eq("source_product_id", payload.source_product_id)
        .maybeSingle();
      if (error) throw error;
      existing = data as SourcedProduct | null;
    }
    if (!existing) {
      const { data, error } = await client
        .from("sourced_products")
        .select("*")
        .eq("category", payload.category)
        .ilike("title", payload.title)
        .maybeSingle();
      if (error) throw error;
      existing = data as SourcedProduct | null;
    }

    if (existing) {
      const updatePayload = {
        ...insertPayload,
        id: undefined,
        created_at: undefined,
        sourcing_status: existing.sourcing_status,
        is_published: existing.is_published,
        is_rejected: existing.is_rejected,
        rejection_reason: existing.rejection_reason,
        ...preserveExistingReviewFields(existing, payload)
      };
      const { data, error } = await client
        .from("sourced_products")
        .update(updatePayload)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      const product = data as SourcedProduct;
      await createProductSnapshotSafely(product, getSnapshotChangeFlags(existing, product), "sourcing");
      return { product, inserted: false };
    }

    const { data, error } = await client.from("sourced_products").insert(insertPayload).select("*").single();
    if (error) throw error;
    const product = data as SourcedProduct;
    await createProductSnapshotSafely(product, ["NEW_PRODUCT"], "sourcing");
    return { product, inserted: true };
  }

  const existingIndex = memoryProducts.findIndex((product) => {
    const sameSourceId =
      payload.source_product_id && product.source === payload.source && product.source_product_id === payload.source_product_id;
    const sameTitle = product.category === payload.category && product.title.toLowerCase() === payload.title.toLowerCase();
    return sameSourceId || sameTitle;
  });

  if (existingIndex >= 0) {
    const previous = memoryProducts[existingIndex];
    memoryProducts[existingIndex] = {
      ...memoryProducts[existingIndex],
      ...payload,
      ...preserveExistingReviewFields(memoryProducts[existingIndex], payload),
      id: memoryProducts[existingIndex].id,
      created_at: memoryProducts[existingIndex].created_at,
      sourcing_status: memoryProducts[existingIndex].sourcing_status,
      is_published: memoryProducts[existingIndex].is_published,
      is_rejected: memoryProducts[existingIndex].is_rejected,
      rejection_reason: memoryProducts[existingIndex].rejection_reason,
      updated_at: now()
    };
    memorySnapshots.unshift(makeSnapshot(memoryProducts[existingIndex], getSnapshotChangeFlags(previous, memoryProducts[existingIndex]), "sourcing"));
    persistMemoryState();
    return { product: memoryProducts[existingIndex], inserted: false };
  }

  memoryProducts.unshift(payload);
  memorySnapshots.unshift(makeSnapshot(payload, ["NEW_PRODUCT"], "sourcing"));
  persistMemoryState();
  return { product: payload, inserted: true };
}

export async function updateProduct(id: string, patch: Partial<SourcedProduct>, options?: { snapshotOrigin?: SnapshotOrigin }) {
  const client = getSupabaseServiceClient();
  const normalizedPatch = {
    ...patch,
    updated_at: now()
  };

  if (client) {
    const { data: beforeData, error: beforeError } = await client.from("sourced_products").select("*").eq("id", id).maybeSingle();
    if (beforeError) throw beforeError;
    const { data, error } = await client.from("sourced_products").update(normalizedPatch).eq("id", id).select("*").single();
    if (error) throw error;
    const product = data as SourcedProduct;
    const changeFlags = getSnapshotChangeFlags(beforeData as SourcedProduct | null, product);
    await createProductSnapshotSafely(product, changeFlags, options?.snapshotOrigin ?? "admin");
    return product;
  }

  const index = memoryProducts.findIndex((product) => product.id === id);
  if (index < 0) throw new Error("PRODUCT_NOT_FOUND");
  const previous = memoryProducts[index];
  memoryProducts[index] = {
    ...memoryProducts[index],
    ...normalizedPatch,
    id,
    category: (normalizedPatch.category ?? memoryProducts[index].category) as Category,
    condition_grade: (normalizedPatch.condition_grade ?? memoryProducts[index].condition_grade) as ConditionGrade,
    sourcing_status: (normalizedPatch.sourcing_status ?? memoryProducts[index].sourcing_status) as SourcingStatus
  };
  const changeFlags = getSnapshotChangeFlags(previous, memoryProducts[index]);
  if (changeFlags.length > 0) memorySnapshots.unshift(makeSnapshot(memoryProducts[index], changeFlags, options?.snapshotOrigin ?? "admin"));
  persistMemoryState();
  return memoryProducts[index];
}

export async function createDealScore(score: DealScore) {
  const withId = {
    ...score,
    id: score.id || randomUUID(),
    created_at: score.created_at || now(),
    updated_at: now()
  };
  const client = getSupabaseServiceClient();
  if (client) {
    const { data, error } = await client.from("deal_scores").insert(withId).select("*").single();
    if (error) throw error;
    return data as DealScore;
  }

  memoryScores.unshift(withId);
  persistMemoryState();
  return withId;
}

export async function createSourcingRun(input: Partial<SourcingRun> & Pick<SourcingRun, "status">) {
  const run: SourcingRun = {
    id: input.id ?? randomUUID(),
    status: input.status,
    started_at: input.started_at ?? now(),
    finished_at: input.finished_at ?? null,
    keyword_count: input.keyword_count ?? 0,
    found_count: input.found_count ?? 0,
    inserted_count: input.inserted_count ?? 0,
    updated_count: input.updated_count ?? 0,
    error_count: input.error_count ?? 0,
    error_message: input.error_message ?? null,
    log_json: input.log_json ?? {}
  };

  const client = getSupabaseServiceClient();
  if (client) {
    const { data, error } = await client.from("sourcing_runs").insert(run).select("*").single();
    if (error) throw error;
    return data as SourcingRun;
  }

  memoryRuns.unshift(run);
  persistMemoryState();
  return run;
}

export async function updateSourcingRun(id: string, patch: Partial<SourcingRun>) {
  const client = getSupabaseServiceClient();
  if (client) {
    const { data, error } = await client.from("sourcing_runs").update(patch).eq("id", id).select("*").single();
    if (error) throw error;
    return data as SourcingRun;
  }

  const index = memoryRuns.findIndex((run) => run.id === id);
  if (index < 0) throw new Error("SOURCING_RUN_NOT_FOUND");
  memoryRuns[index] = { ...memoryRuns[index], ...patch };
  persistMemoryState();
  return memoryRuns[index];
}

export async function listSourcingRuns(limit = 10) {
  const client = getSupabaseServiceClient();
  if (client) {
    const { data, error } = await client.from("sourcing_runs").select("*").order("started_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []) as SourcingRun[];
  }

  return memoryRuns.slice(0, limit);
}

export async function listSourcingExecutionRuns(limit = 10) {
  const client = getSupabaseServiceClient();
  if (client) {
    const { data, error } = await client.from("sourcing_runs").select("*").order("started_at", { ascending: false }).limit(Math.max(limit * 3, limit));
    if (error) throw error;
    return ((data ?? []) as SourcingRun[]).filter(isSourcingExecutionRun).slice(0, limit);
  }

  return memoryRuns.filter(isSourcingExecutionRun).slice(0, limit);
}

export async function getLatestSourcingRunByStatus(status: string) {
  const client = getSupabaseServiceClient();
  if (client) {
    const { data, error } = await client.from("sourcing_runs").select("*").eq("status", status).order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return (data as SourcingRun | null) ?? null;
  }

  return memoryRuns
    .filter((run) => run.status === status)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null;
}

export async function createTelegramLog(input: Omit<TelegramLog, "id" | "created_at">) {
  const log: TelegramLog = {
    id: randomUUID(),
    product_id: input.product_id,
    target_type: input.target_type ?? (input.product_id ? "product" : null),
    target_key: input.target_key ?? input.product_id ?? null,
    message: input.message,
    status: input.status,
    error: input.error,
    created_at: now()
  };

  const client = getSupabaseServiceClient();
  if (client) {
    const { data, error } = await client.from("telegram_logs").insert(log).select("*").single();
    if (error) throw error;
    return data as TelegramLog;
  }

  memoryTelegramLogs.unshift(log);
  persistMemoryState();
  return log;
}

export async function listTelegramLogs(limit = 100) {
  const client = getSupabaseServiceClient();
  if (client) {
    const { data, error } = await client.from("telegram_logs").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []) as TelegramLog[];
  }

  return [...memoryTelegramLogs].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
}

function safeEventText(value: string | null | undefined, maxLength = 300) {
  if (!value) return null;
  return value.trim().slice(0, maxLength) || null;
}

export async function createAffiliateEvent(input: AffiliateEventInput) {
  const event: AffiliateEvent = {
    id: randomUUID(),
    product_id: input.product_id ?? null,
    event_type: input.event_type,
    channel: safeEventText(input.channel, 80),
    context: safeEventText(input.context, 80),
    anon_session_id: safeEventText(input.anon_session_id, 120),
    referrer: safeEventText(input.referrer, 500),
    utm_source: safeEventText(input.utm_source, 120),
    created_at: now()
  };

  const client = getSupabaseServiceClient();
  if (client) {
    const { data, error } = await client.from("affiliate_events").insert(event).select("*").single();
    if (error) {
      if (event.product_id && error.code === "23503") {
        const fallbackEvent = { ...event, product_id: null };
        const fallback = await client.from("affiliate_events").insert(fallbackEvent).select("*").single();
        if (fallback.error) throw fallback.error;
        return fallback.data as AffiliateEvent;
      }
      throw error;
    }
    return data as AffiliateEvent;
  }

  memoryAffiliateEvents.unshift(event);
  persistMemoryState();
  return event;
}

export async function listAffiliateEvents(limit = 5000) {
  const client = getSupabaseServiceClient();
  if (client) {
    const { data, error } = await client.from("affiliate_events").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []) as AffiliateEvent[];
  }

  return memoryAffiliateEvents.slice(0, limit);
}

function ratio(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function uniqueSessionCount(events: AffiliateEvent[]) {
  const sessions = new Set<string>();
  for (const event of events) {
    const sessionId = event.anon_session_id?.trim();
    if (sessionId) sessions.add(sessionId);
  }
  return sessions.size;
}

function attributionSource(event: AffiliateEvent) {
  const utmSource = event.utm_source?.trim().toLowerCase();
  if (utmSource) return utmSource;
  if (event.channel?.startsWith("telegram")) return "telegram";
  return "direct";
}

export type RevenueMetricsPeriodDays = 7 | 30 | 90 | "all";

type RevenueMetricsPeriod = {
  days: number | null;
  start_at: string | null;
  end_at: string;
};

export async function getRevenueMetrics(periodDays: RevenueMetricsPeriodDays = "all") {
  const [products, events] = await Promise.all([listProducts({ published: true }), listAffiliateEvents()]);
  const periodEnd = new Date();
  const periodStart = periodDays === "all" ? null : new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const period: RevenueMetricsPeriod = {
    days: periodDays === "all" ? null : periodDays,
    start_at: periodStart?.toISOString() ?? null,
    end_at: periodEnd.toISOString()
  };
  const periodEvents = periodStart
    ? events.filter((event) => {
      const createdAt = new Date(event.created_at);
      return Number.isFinite(createdAt.getTime()) && createdAt >= periodStart && createdAt <= periodEnd;
    })
    : events;
  const publishedProducts = products.filter((product) => product.sourcing_status === "published");
  const productMap = new Map(publishedProducts.map((product) => [product.id, product]));
  const impressionEvents = periodEvents.filter((event) => event.event_type === "impression");
  const detailEvents = periodEvents.filter((event) => event.event_type === "detail_view" || event.event_type === "telegram_detail_click");
  const affiliateClickEvents = periodEvents.filter((event) => event.event_type === "affiliate_click");
  const totals = {
    impression: impressionEvents.length,
    detail_view: periodEvents.filter((event) => event.event_type === "detail_view").length,
    affiliate_click: affiliateClickEvents.length,
    telegram_detail_click: periodEvents.filter((event) => event.event_type === "telegram_detail_click").length,
    share_copy: periodEvents.filter((event) => event.event_type === "share_copy").length
  };
  const uniqueVisitors = uniqueSessionCount([...impressionEvents, ...detailEvents]);
  const uniqueDetailVisitors = uniqueSessionCount(detailEvents);
  const uniqueAffiliateClickers = uniqueSessionCount(affiliateClickEvents);

  const allProductMetrics = publishedProducts
    .map((product) => {
      const productEvents = periodEvents.filter((event) => event.product_id === product.id);
      const impressions = productEvents.filter((event) => event.event_type === "impression").length;
      const productDetailEvents = productEvents.filter((event) => event.event_type === "detail_view" || event.event_type === "telegram_detail_click");
      const productAffiliateClickEvents = productEvents.filter((event) => event.event_type === "affiliate_click");
      const detailViews = productDetailEvents.length;
      const affiliateClicks = productAffiliateClickEvents.length;
      const telegramClicks = productEvents.filter((event) => event.event_type === "telegram_detail_click").length;
      const uniqueProductDetailVisitors = uniqueSessionCount(productDetailEvents);
      const uniqueProductAffiliateClickers = uniqueSessionCount(productAffiliateClickEvents);
      return {
        product_id: product.id,
        title: product.title,
        category: product.category,
        score: product.latest_score?.total_score ?? 0,
        has_affiliate_url: isUsableAffiliateUrl(product.affiliate_url),
        impressions,
        detail_views: detailViews,
        affiliate_clicks: affiliateClicks,
        telegram_clicks: telegramClicks,
        share_copies: productEvents.filter((event) => event.event_type === "share_copy").length,
        detail_ctr: ratio(detailViews, impressions),
        affiliate_ctr: ratio(affiliateClicks, detailViews),
        unique_detail_visitors: uniqueProductDetailVisitors,
        unique_affiliate_clickers: uniqueProductAffiliateClickers,
        session_affiliate_ctr: ratio(uniqueProductAffiliateClickers, uniqueProductDetailVisitors),
        cta_ready: getCustomerPublishReadiness(product).ready && product.is_published && product.sourcing_status === "published"
      };
    })
    .sort((a, b) => b.affiliate_clicks - a.affiliate_clicks || b.detail_views - a.detail_views);

  const productMetrics = allProductMetrics.slice(0, 30);
  const conversionOpportunities = allProductMetrics
    .filter((item) => item.cta_ready && item.detail_views > 0 && item.affiliate_clicks === 0)
    .sort((a, b) => b.detail_views - a.detail_views || b.impressions - a.impressions)
    .slice(0, 8);

  const categoryMetrics = Array.from(new Set(publishedProducts.map((product) => product.category))).map((category) => {
    const categoryProductIds = new Set(publishedProducts.filter((product) => product.category === category).map((product) => product.id));
    const categoryEvents = periodEvents.filter((event) => event.product_id && categoryProductIds.has(event.product_id));
    const impressions = categoryEvents.filter((event) => event.event_type === "impression").length;
    const detailViews = categoryEvents.filter((event) => event.event_type === "detail_view" || event.event_type === "telegram_detail_click").length;
    const affiliateClicks = categoryEvents.filter((event) => event.event_type === "affiliate_click").length;
    return {
      category,
      product_count: categoryProductIds.size,
      impressions,
      detail_views: detailViews,
      affiliate_clicks: affiliateClicks,
      detail_ctr: ratio(detailViews, impressions),
      affiliate_ctr: ratio(affiliateClicks, detailViews)
    };
  });

  const channelMetrics = Array.from(new Set(periodEvents.map((event) => event.channel ?? "unknown"))).map((channel) => {
    const channelEvents = periodEvents.filter((event) => (event.channel ?? "unknown") === channel);
    return {
      channel,
      impressions: channelEvents.filter((event) => event.event_type === "impression").length,
      detail_views: channelEvents.filter((event) => event.event_type === "detail_view" || event.event_type === "telegram_detail_click").length,
      affiliate_clicks: channelEvents.filter((event) => event.event_type === "affiliate_click").length,
      telegram_clicks: channelEvents.filter((event) => event.event_type === "telegram_detail_click").length,
      share_copies: channelEvents.filter((event) => event.event_type === "share_copy").length
    };
  }).sort((a, b) => b.affiliate_clicks - a.affiliate_clicks || b.detail_views - a.detail_views || b.impressions - a.impressions);

  const sourceMetrics = Array.from(new Set(periodEvents.map(attributionSource))).map((source) => {
    const sourceEvents = periodEvents.filter((event) => attributionSource(event) === source);
    const sourceDetailEvents = sourceEvents.filter((event) => event.event_type === "detail_view" || event.event_type === "telegram_detail_click");
    const sourceAffiliateClickEvents = sourceEvents.filter((event) => event.event_type === "affiliate_click");
    const detailViews = sourceDetailEvents.length;
    const affiliateClicks = sourceAffiliateClickEvents.length;
    const uniqueSourceDetailVisitors = uniqueSessionCount(sourceDetailEvents);
    const uniqueSourceAffiliateClickers = uniqueSessionCount(sourceAffiliateClickEvents);
    return {
      source,
      detail_views: detailViews,
      affiliate_clicks: affiliateClicks,
      share_copies: sourceEvents.filter((event) => event.event_type === "share_copy").length,
      affiliate_ctr: ratio(affiliateClicks, detailViews),
      unique_detail_visitors: uniqueSourceDetailVisitors,
      unique_affiliate_clickers: uniqueSourceAffiliateClickers,
      session_affiliate_ctr: ratio(uniqueSourceAffiliateClickers, uniqueSourceDetailVisitors)
    };
  }).sort((a, b) => b.affiliate_clicks - a.affiliate_clicks || b.detail_views - a.detail_views);

  const surfaceMetrics = Array.from(new Set(periodEvents.map((event) => event.context).filter((context): context is string => Boolean(context)))).map((context) => {
    const surfaceEvents = periodEvents.filter((event) => event.context === context);
    const impressions = surfaceEvents.filter((event) => event.event_type === "impression").length;
    const detailViews = surfaceEvents.filter((event) => event.event_type === "detail_view" || event.event_type === "telegram_detail_click").length;
    const affiliateClicks = surfaceEvents.filter((event) => event.event_type === "affiliate_click").length;
    return {
      context,
      impressions,
      detail_views: detailViews,
      affiliate_clicks: affiliateClicks,
      telegram_clicks: surfaceEvents.filter((event) => event.event_type === "telegram_detail_click").length,
      share_copies: surfaceEvents.filter((event) => event.event_type === "share_copy").length,
      detail_ctr: ratio(detailViews, impressions),
      affiliate_ctr: ratio(affiliateClicks, detailViews)
    };
  }).sort((a, b) => b.affiliate_clicks - a.affiliate_clicks || b.detail_views - a.detail_views || b.impressions - a.impressions);

  const missingAffiliateUrl = publishedProducts.filter((product) => !isUsableAffiliateUrl(product.affiliate_url)).length;
  const publicQualityBlocked = publishedProducts.filter((product) => !getCustomerPublishReadiness(product).ready).length;
  const ctaReady = publishedProducts.length - publicQualityBlocked;

  return {
    period,
    totals,
    funnel: {
      impressions: totals.impression,
      detail_views: totals.detail_view + totals.telegram_detail_click,
      affiliate_clicks: totals.affiliate_click,
      share_copies: totals.share_copy,
      detail_ctr: ratio(totals.detail_view + totals.telegram_detail_click, totals.impression),
      affiliate_ctr: ratio(totals.affiliate_click, totals.detail_view + totals.telegram_detail_click),
      unique_visitors: uniqueVisitors,
      unique_detail_visitors: uniqueDetailVisitors,
      unique_affiliate_clickers: uniqueAffiliateClickers,
      session_affiliate_ctr: ratio(uniqueAffiliateClickers, uniqueDetailVisitors)
    },
    ctaReady,
    missingAffiliateUrl,
    publicQualityBlocked,
    productMetrics,
    categoryMetrics,
    channelMetrics,
    sourceMetrics,
    surfaceMetrics,
    conversionOpportunities,
    knownProductEventCount: periodEvents.filter((event) => event.product_id && productMap.has(event.product_id)).length
  };
}

export async function getAdminMetrics() {
  const products = await listProducts();
  const runs = await listSourcingExecutionRuns(5);
  const latestRun = runs[0] ?? null;
  const total = products.length;
  const publishedProducts = products.filter((product) => product.is_published && product.sourcing_status === "published");
  const publicReady = publishedProducts.filter((product) => getCustomerPublishReadiness(product).ready).length;
  const publishedStatusCount = publishedProducts.length;
  const published = publicReady;
  const hiddenPublishedWithoutAffiliate = publishedProducts.filter((product) => !isUsableAffiliateUrl(product.affiliate_url)).length;
  const hiddenPublishedWithQualityBlockers = Math.max(0, publishedStatusCount - publicReady - hiddenPublishedWithoutAffiliate);
  const needsReview = products.filter((product) => product.sourcing_status === "needs_review").length;
  const approved = products.filter((product) => product.sourcing_status === "approved").length;
  const unknownCondition = products.filter((product) => product.condition_grade === "확인필요" || product.condition_grade === "알수없음").length;
  const missingReturnPrice = products.filter((product) => product.return_price == null).length;
  const missingAffiliateUrl = hiddenPublishedWithoutAffiliate;
  const badPrice = products.filter((product) => {
    const dealPrice = product.return_price ?? product.source_price ?? product.new_price;
    const trustedNaverPrice = getNaverPriceTrust(product).trustedPrice;
    return Boolean(trustedNaverPrice && dealPrice && dealPrice > trustedNaverPrice);
  }).length;
  const highScore = products.filter((product) => (product.latest_score?.total_score ?? 0) >= 75).length;
  const changedRecently = products.filter((product) => (product.latest_snapshot?.change_flags?.length ?? 0) > 0).length;
  const averageScore = total
    ? Math.round(products.reduce((sum, product) => sum + (product.latest_score?.total_score ?? 0), 0) / total)
    : 0;
  const qualityBuckets = products.reduce(
    (acc, product) => {
      const quality = getDealQuality(product);
      acc[quality.status] += 1;
      return acc;
    },
    { ready: 0, manual_check: 0, watch_price: 0, hold: 0 }
  );
  const priorityQueue = products
    .filter((product) => ["needs_review", "approved", "candidate"].includes(product.sourcing_status))
    .map((product) => ({ product, quality: getDealQuality(product) }))
    .sort((a, b) => b.quality.priority - a.quality.priority)
    .slice(0, 6)
    .map(({ product, quality }) => ({
      id: product.id,
      title: product.title,
      category: product.category,
      status: product.sourcing_status,
      score: product.latest_score?.total_score ?? 0,
      verdict: product.latest_score?.verdict ?? null,
      quality_label: quality.label,
      confidence: quality.confidence,
      blockers: quality.blockers,
      warnings: quality.warnings
    }));

  return {
    total,
    published,
    publishedStatusCount,
    publicReady,
    hiddenPublishedWithoutAffiliate,
    hiddenPublishedWithQualityBlockers,
    needsReview,
    approved,
    highScore,
    averageScore,
    unknownCondition,
    missingReturnPrice,
    missingAffiliateUrl,
    badPrice,
    changedRecently,
    qualityBuckets,
    latestRun,
    priorityQueue
  };
}
