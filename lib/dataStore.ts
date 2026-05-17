import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import path from "path";
import { demoCatalog } from "@/lib/demoCatalog";
import { getDealQuality } from "@/lib/quality";
import { calculateDealScore } from "@/lib/scoring";
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
  return [
  makeKeyword("갤럭시북", "laptop", 400000, 1800000, 0.1),
  makeKeyword("LG 그램", "laptop", 600000, 2200000, 0.1),
  makeKeyword("레노버 아이디어패드", "laptop", 350000, 1400000, 0.12),
  makeKeyword("레노버 리전", "laptop", 700000, 2400000, 0.15),
  makeKeyword("HP 빅터스", "laptop", 600000, 1800000, 0.15),
  makeKeyword("ASUS TUF", "laptop", 700000, 2200000, 0.15),
  makeKeyword("맥북", "laptop", 700000, 2600000, 0.08),
  makeKeyword("MSI 노트북", "laptop", 600000, 2200000, 0.15),
  makeKeyword("QHD 모니터", "monitor", 150000, 800000, 0.12),
  makeKeyword("4K 모니터", "monitor", 200000, 1100000, 0.12),
  makeKeyword("144Hz 모니터", "monitor", 150000, 900000, 0.12),
  makeKeyword("27인치 모니터", "monitor", 100000, 700000, 0.1),
  makeKeyword("로보락", "robot_vacuum", 300000, 1600000, 0.12),
  makeKeyword("드리미 로봇청소기", "robot_vacuum", 250000, 1500000, 0.12),
  makeKeyword("샤오미 로봇청소기", "robot_vacuum", 150000, 900000, 0.12),
  makeKeyword("다이슨 무선청소기", "cordless_vacuum", 250000, 1200000, 0.1),
  makeKeyword("삼성 제트", "cordless_vacuum", 200000, 1000000, 0.12),
  makeKeyword("LG 코드제로", "cordless_vacuum", 250000, 1200000, 0.12),
  makeKeyword("삼성 공기청정기", "air_purifier", 100000, 900000, 0.1),
  makeKeyword("LG 공기청정기", "air_purifier", 150000, 1000000, 0.1),
  makeKeyword("위닉스 공기청정기", "air_purifier", 80000, 600000, 0.1),
  makeKeyword("위닉스 제습기", "dehumidifier", 100000, 700000, 0.1),
  makeKeyword("LG 제습기", "dehumidifier", 150000, 900000, 0.1),
  makeKeyword("삼성 제습기", "dehumidifier", 150000, 900000, 0.1)
  ];
}

function makeProduct(input: ProductInput): SourcedProduct {
  const stamp = now();
  return {
    id: input.id ?? randomUUID(),
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
    created_at: input.created_at ?? stamp,
    updated_at: input.updated_at ?? stamp
  };
}

function createInitialProducts(): SourcedProduct[] {
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

  return [
  makeProduct({
    source: "mock",
    source_product_id: "seed-ideapad",
    category: "laptop",
    keyword: "레노버 아이디어패드",
    title: "레노버 아이디어패드 5 16GB 512GB Ryzen 7 Win11 반품-최상",
    brand: "Lenovo",
    model_name: "IdeaPad 5",
    image_url: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?q=80&w=900&auto=format&fit=crop",
    source_url: "https://www.coupang.com/np/goldbox",
    coupang_url: "https://www.coupang.com/np/goldbox",
    affiliate_url: "https://link.coupang.com/a/dPyGuoKdSm",
    source_price: 742000,
    return_price: 742000,
    new_price: 969000,
    naver_lowest_price: 965000,
    condition_grade: "최상",
    stock_count: 1,
    sourcing_status: "published",
    is_published: true,
    public_note: "사무, 대학생, 재택용으로 균형이 좋은 샘플 딜입니다."
  }),
  makeProduct({
    source: "mock",
    source_product_id: "seed-monitor",
    category: "monitor",
    keyword: "QHD 모니터",
    title: "LG 27인치 QHD 모니터 144Hz IPS 반품-상",
    brand: "LG",
    model_name: "27QHD144",
    image_url: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?q=80&w=900&auto=format&fit=crop",
    source_url: "https://www.coupang.com/np/goldbox",
    coupang_url: "https://www.coupang.com/np/goldbox",
    affiliate_url: "https://link.coupang.com/a/dPyGuoKdSm",
    source_price: 249000,
    return_price: 229000,
    new_price: 319000,
    naver_lowest_price: 312000,
    condition_grade: "상",
    stock_count: 3,
    sourcing_status: "published",
    is_published: true
  }),
  makeProduct({
    source: "mock",
    source_product_id: "seed-roborock",
    category: "robot_vacuum",
    keyword: "로보락",
    title: "로보락 로봇청소기 자동먼지비움 물걸레 도킹스테이션 반품-최상",
    brand: "Roborock",
    model_name: "Q Revo",
    image_url: "https://images.unsplash.com/photo-1603618090561-412154b4bd1b?q=80&w=900&auto=format&fit=crop",
    source_url: "https://www.coupang.com/np/goldbox",
    coupang_url: "https://www.coupang.com/np/goldbox",
    affiliate_url: "https://link.coupang.com/a/dPyGuoKdSm",
    source_price: 689000,
    return_price: 649000,
    new_price: 849000,
    naver_lowest_price: 835000,
    condition_grade: "최상",
    stock_count: 1,
    sourcing_status: "published",
    is_published: true
  }),
  makeProduct({
    source: "mock",
    source_product_id: "seed-galaxybook",
    category: "laptop",
    keyword: "갤럭시북",
    title: "삼성 갤럭시북4 16GB 512GB Core Ultra 5 Win11 반품-최상",
    brand: "Samsung",
    model_name: "Galaxy Book4",
    image_url: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?q=80&w=900&auto=format&fit=crop",
    source_url: "https://www.coupang.com/np/goldbox",
    coupang_url: "https://www.coupang.com/np/goldbox",
    affiliate_url: "https://link.coupang.com/a/dPyGuoKdSm",
    source_price: 879000,
    return_price: 859000,
    new_price: 1199000,
    naver_lowest_price: 1168000,
    condition_grade: "최상",
    stock_count: 2,
    sourcing_status: "published",
    is_published: true,
    public_note: "반품등급과 가격 차이가 모두 확인된 사무·학습용 후보입니다."
  }),
  makeProduct({
    source: "mock",
    source_product_id: "seed-monitor-4k",
    category: "monitor",
    keyword: "4K 모니터",
    title: "삼성 32인치 4K UHD 모니터 60Hz 반품-미개봉",
    brand: "Samsung",
    model_name: "U32",
    image_url: "https://images.unsplash.com/photo-1527443195645-1133f7f28990?q=80&w=900&auto=format&fit=crop",
    source_url: "https://www.coupang.com/np/goldbox",
    coupang_url: "https://www.coupang.com/np/goldbox",
    affiliate_url: "https://link.coupang.com/a/dPyGuoKdSm",
    source_price: 289000,
    return_price: 279000,
    new_price: 389000,
    naver_lowest_price: 374000,
    condition_grade: "미개봉",
    stock_count: 1,
    sourcing_status: "published",
    is_published: true,
    public_note: "문서 작업과 콘솔 연결용으로 무난한 4K 모니터 후보입니다."
  }),
  makeProduct({
    source: "mock",
    source_product_id: "seed-dyson-vacuum",
    category: "cordless_vacuum",
    keyword: "다이슨 무선청소기",
    title: "다이슨 V12 무선청소기 배터리 거치대 필터 포함 반품-상",
    brand: "Dyson",
    model_name: "V12",
    image_url: "https://images.unsplash.com/photo-1558317374-067fb5f30001?q=80&w=900&auto=format&fit=crop",
    source_url: "https://www.coupang.com/np/goldbox",
    coupang_url: "https://www.coupang.com/np/goldbox",
    affiliate_url: "https://link.coupang.com/a/dPyGuoKdSm",
    source_price: 519000,
    return_price: 489000,
    new_price: 699000,
    naver_lowest_price: 679000,
    condition_grade: "상",
    stock_count: 2,
    sourcing_status: "published",
    is_published: true,
    public_note: "배터리와 필터 구성품 확인이 된 경우에만 추천하는 무선청소기 딜입니다."
  }),
  makeProduct({
    source: "mock",
    source_product_id: "seed-air-winix",
    category: "air_purifier",
    keyword: "위닉스 공기청정기",
    title: "위닉스 공기청정기 21평형 HEPA 필터 반품-미개봉",
    brand: "Winix",
    model_name: "Tower Prime",
    image_url: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?q=80&w=900&auto=format&fit=crop",
    source_url: "https://www.coupang.com/np/goldbox",
    coupang_url: "https://www.coupang.com/np/goldbox",
    affiliate_url: "https://link.coupang.com/a/dPyGuoKdSm",
    source_price: 189000,
    return_price: 179000,
    new_price: 249000,
    naver_lowest_price: 239000,
    condition_grade: "미개봉",
    stock_count: 4,
    sourcing_status: "published",
    is_published: true,
    public_note: "필터 비용까지 감안해도 가격 차이가 의미 있는 생활가전 후보입니다."
  }),
  makeProduct({
    source: "mock",
    source_product_id: "seed-lg-dehumidifier",
    category: "dehumidifier",
    keyword: "LG 제습기",
    title: "LG 제습기 20L 연속배수 반품-최상",
    brand: "LG",
    model_name: "D20",
    image_url: "https://images.unsplash.com/photo-1586208958839-06c17cacdf08?q=80&w=900&auto=format&fit=crop",
    source_url: "https://www.coupang.com/np/goldbox",
    coupang_url: "https://www.coupang.com/np/goldbox",
    affiliate_url: "https://link.coupang.com/a/dPyGuoKdSm",
    source_price: 399000,
    return_price: 369000,
    new_price: 489000,
    naver_lowest_price: 469000,
    condition_grade: "최상",
    stock_count: 2,
    sourcing_status: "published",
    is_published: true,
    public_note: "여름철 수요가 오르기 전 가격 차이가 좋은 제습기 후보입니다."
  })
  ];
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

function makeSnapshot(product: SourcedProduct, changeFlags: SnapshotChangeFlag[] = []): ProductSnapshot {
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
      status: product.sourcing_status
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
  return hydrateDemoCatalog({
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
  });
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
      existing.sourcing_status = "published";
      existing.is_published = true;
      existing.is_rejected = false;
      existing.rejection_reason = null;
      const hasPlaceholderAffiliateUrl = !existing.affiliate_url || existing.affiliate_url.includes("example.com");
      existing.affiliate_url = hasPlaceholderAffiliateUrl ? seed.affiliate_url : existing.affiliate_url;
      existing.source_url = !existing.source_url || existing.source_url.includes("example.com") ? seed.source_url : existing.source_url;
      existing.coupang_url = !existing.coupang_url || existing.coupang_url.includes("example.com") ? seed.coupang_url : existing.coupang_url;
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

function loadMemoryState(): MemoryState {
  if (!existsSync(localDbPath)) return createMemoryState();
  try {
    const parsed = JSON.parse(readFileSync(localDbPath, "utf8")) as Partial<MemoryState>;
    const fallback = createMemoryState();
    return hydrateDemoCatalog({
      keywords: Array.isArray(parsed.keywords) ? (parsed.keywords as SourcingKeyword[]) : fallback.keywords,
      products: Array.isArray(parsed.products) ? (parsed.products as SourcedProduct[]) : fallback.products,
      scores: Array.isArray(parsed.scores) ? (parsed.scores as DealScore[]) : fallback.scores,
      snapshots: Array.isArray(parsed.snapshots) ? (parsed.snapshots as ProductSnapshot[]) : fallback.snapshots,
      runs: Array.isArray(parsed.runs) ? (parsed.runs as SourcingRun[]) : fallback.runs,
      telegramLogs: Array.isArray(parsed.telegramLogs) ? (parsed.telegramLogs as TelegramLog[]) : fallback.telegramLogs,
      affiliateEvents: Array.isArray(parsed.affiliateEvents) ? (parsed.affiliateEvents as AffiliateEvent[]) : fallback.affiliateEvents
    });
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
  return {
    ...product,
    latest_score: dealScores[0] ?? null,
    deal_scores: dealScores,
    snapshots,
    latest_snapshot: snapshots[0] ?? null
  };
}

function attachMemoryScore(product: SourcedProduct): ProductWithScore {
  const dealScores = memoryScores.filter((score) => score.product_id === product.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const snapshots = memorySnapshots.filter((snapshot) => snapshot.product_id === product.id).sort((a, b) => b.observed_at.localeCompare(a.observed_at));
  return {
    ...product,
    deal_scores: dealScores,
    latest_score: dealScores[0] ?? null,
    snapshots,
    latest_snapshot: snapshots[0] ?? null
  };
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

export async function createKeyword(input: KeywordInput) {
  const client = getSupabaseServiceClient();
  if (client) {
    const { data, error } = await client.from("sourcing_keywords").insert(input).select("*").single();
    if (error) throw error;
    return data as SourcingKeyword;
  }

  const keyword = makeKeyword(input.keyword, input.category, input.min_price ?? null, input.max_price ?? null, input.min_discount_rate ?? null);
  keyword.is_active = input.is_active ?? true;
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

export async function createProductSnapshot(product: SourcedProduct, changeFlags: SnapshotChangeFlag[] = []) {
  const snapshot = makeSnapshot(product, changeFlags);
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
        admin_memo: existing.admin_memo,
        public_note: existing.public_note,
        affiliate_url: existing.affiliate_url ?? payload.affiliate_url
      };
      const { data, error } = await client
        .from("sourced_products")
        .update(updatePayload)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      const product = data as SourcedProduct;
      await createProductSnapshot(product, getSnapshotChangeFlags(existing, product));
      return { product, inserted: false };
    }

    const { data, error } = await client.from("sourced_products").insert(insertPayload).select("*").single();
    if (error) throw error;
    const product = data as SourcedProduct;
    await createProductSnapshot(product, ["NEW_PRODUCT"]);
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
      id: memoryProducts[existingIndex].id,
      created_at: memoryProducts[existingIndex].created_at,
      sourcing_status: memoryProducts[existingIndex].sourcing_status,
      is_published: memoryProducts[existingIndex].is_published,
      is_rejected: memoryProducts[existingIndex].is_rejected,
      rejection_reason: memoryProducts[existingIndex].rejection_reason,
      admin_memo: memoryProducts[existingIndex].admin_memo,
      public_note: memoryProducts[existingIndex].public_note,
      affiliate_url: memoryProducts[existingIndex].affiliate_url ?? payload.affiliate_url,
      updated_at: now()
    };
    memorySnapshots.unshift(makeSnapshot(memoryProducts[existingIndex], getSnapshotChangeFlags(previous, memoryProducts[existingIndex])));
    persistMemoryState();
    return { product: memoryProducts[existingIndex], inserted: false };
  }

  memoryProducts.unshift(payload);
  memorySnapshots.unshift(makeSnapshot(payload, ["NEW_PRODUCT"]));
  persistMemoryState();
  return { product: payload, inserted: true };
}

export async function updateProduct(id: string, patch: Partial<SourcedProduct>) {
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
    if (changeFlags.length > 0) await createProductSnapshot(product, changeFlags);
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
  if (changeFlags.length > 0) memorySnapshots.unshift(makeSnapshot(memoryProducts[index], changeFlags));
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

export async function createTelegramLog(input: Omit<TelegramLog, "id" | "created_at">) {
  const log: TelegramLog = {
    id: randomUUID(),
    product_id: input.product_id,
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
    anon_session_id: safeEventText(input.anon_session_id, 120),
    referrer: safeEventText(input.referrer, 500),
    utm_source: safeEventText(input.utm_source, 120),
    created_at: now()
  };

  const client = getSupabaseServiceClient();
  if (client) {
    const { data, error } = await client.from("affiliate_events").insert(event).select("*").single();
    if (error) throw error;
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

export async function getRevenueMetrics() {
  const [products, events] = await Promise.all([listProducts({ published: true }), listAffiliateEvents()]);
  const publishedProducts = products.filter((product) => product.sourcing_status === "published");
  const productMap = new Map(publishedProducts.map((product) => [product.id, product]));
  const totals = {
    impression: events.filter((event) => event.event_type === "impression").length,
    detail_view: events.filter((event) => event.event_type === "detail_view").length,
    affiliate_click: events.filter((event) => event.event_type === "affiliate_click").length,
    telegram_detail_click: events.filter((event) => event.event_type === "telegram_detail_click").length
  };

  const productMetrics = publishedProducts
    .map((product) => {
      const productEvents = events.filter((event) => event.product_id === product.id);
      const impressions = productEvents.filter((event) => event.event_type === "impression").length;
      const detailViews = productEvents.filter((event) => event.event_type === "detail_view" || event.event_type === "telegram_detail_click").length;
      const affiliateClicks = productEvents.filter((event) => event.event_type === "affiliate_click").length;
      const telegramClicks = productEvents.filter((event) => event.event_type === "telegram_detail_click").length;
      return {
        product_id: product.id,
        title: product.title,
        category: product.category,
        score: product.latest_score?.total_score ?? 0,
        has_affiliate_url: Boolean(product.affiliate_url),
        impressions,
        detail_views: detailViews,
        affiliate_clicks: affiliateClicks,
        telegram_clicks: telegramClicks,
        detail_ctr: ratio(detailViews, impressions),
        affiliate_ctr: ratio(affiliateClicks, detailViews),
        cta_ready: Boolean(product.affiliate_url && product.is_published && product.sourcing_status === "published")
      };
    })
    .sort((a, b) => b.affiliate_clicks - a.affiliate_clicks || b.detail_views - a.detail_views)
    .slice(0, 30);

  const categoryMetrics = Array.from(new Set(publishedProducts.map((product) => product.category))).map((category) => {
    const categoryProductIds = new Set(publishedProducts.filter((product) => product.category === category).map((product) => product.id));
    const categoryEvents = events.filter((event) => event.product_id && categoryProductIds.has(event.product_id));
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

  const channelMetrics = Array.from(new Set(events.map((event) => event.channel ?? "unknown"))).map((channel) => {
    const channelEvents = events.filter((event) => (event.channel ?? "unknown") === channel);
    return {
      channel,
      impressions: channelEvents.filter((event) => event.event_type === "impression").length,
      detail_views: channelEvents.filter((event) => event.event_type === "detail_view" || event.event_type === "telegram_detail_click").length,
      affiliate_clicks: channelEvents.filter((event) => event.event_type === "affiliate_click").length,
      telegram_clicks: channelEvents.filter((event) => event.event_type === "telegram_detail_click").length
    };
  });

  const missingAffiliateUrl = publishedProducts.filter((product) => !product.affiliate_url).length;
  const ctaReady = publishedProducts.length - missingAffiliateUrl;

  return {
    totals,
    funnel: {
      impressions: totals.impression,
      detail_views: totals.detail_view + totals.telegram_detail_click,
      affiliate_clicks: totals.affiliate_click,
      detail_ctr: ratio(totals.detail_view + totals.telegram_detail_click, totals.impression),
      affiliate_ctr: ratio(totals.affiliate_click, totals.detail_view + totals.telegram_detail_click)
    },
    ctaReady,
    missingAffiliateUrl,
    productMetrics,
    categoryMetrics,
    channelMetrics,
    knownProductEventCount: events.filter((event) => event.product_id && productMap.has(event.product_id)).length
  };
}

export async function getAdminMetrics() {
  const products = await listProducts();
  const runs = await listSourcingRuns(5);
  const latestRun = runs[0] ?? null;
  const total = products.length;
  const published = products.filter((product) => product.is_published && product.sourcing_status === "published").length;
  const needsReview = products.filter((product) => product.sourcing_status === "needs_review").length;
  const approved = products.filter((product) => product.sourcing_status === "approved").length;
  const unknownCondition = products.filter((product) => product.condition_grade === "확인필요" || product.condition_grade === "알수없음").length;
  const missingReturnPrice = products.filter((product) => product.return_price == null).length;
  const missingAffiliateUrl = products.filter((product) => product.is_published && !product.affiliate_url).length;
  const badPrice = products.filter((product) => {
    const dealPrice = product.return_price ?? product.source_price;
    return Boolean(product.naver_lowest_price && dealPrice && dealPrice > product.naver_lowest_price);
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
