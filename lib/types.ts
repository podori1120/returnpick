export type Category =
  | "laptop"
  | "monitor"
  | "robot_vacuum"
  | "cordless_vacuum"
  | "air_purifier"
  | "dehumidifier";

export type SourcingStatus =
  | "candidate"
  | "needs_review"
  | "approved"
  | "published"
  | "rejected"
  | "sold_out"
  | "error";

export type ConditionGrade = "미개봉" | "최상" | "상" | "중" | "알수없음" | "확인필요";

export type Verdict = "강력추천" | "추천" | "조건부 추천" | "보류" | "비추";

export type RiskFlag =
  | "RISK_CONDITION_UNKNOWN"
  | "RISK_PRICE_UNKNOWN"
  | "RISK_BAD_PRICE_VS_NAVER"
  | "RISK_FREEDOS"
  | "RISK_LOW_RAM"
  | "RISK_GAMING_USED"
  | "RISK_HIGH_PRICE_RETURN"
  | "RISK_PANEL_DEFECT"
  | "RISK_DOCK_STATION_UNKNOWN"
  | "RISK_USED_BATTERY"
  | "RISK_CONSUMABLES_UNKNOWN"
  | "RISK_FILTER_COST"
  | "RISK_STOCK_ONE";

export type SnapshotChangeFlag =
  | "NEW_PRODUCT"
  | "SOURCE_PRICE_CHANGED"
  | "RETURN_PRICE_CHANGED"
  | "NEW_PRICE_CHANGED"
  | "NAVER_PRICE_CHANGED"
  | "STOCK_CHANGED"
  | "CONDITION_CHANGED"
  | "SOLD_OUT"
  | "BACK_IN_STOCK";

export type AffiliateEventType = "impression" | "detail_view" | "affiliate_click" | "telegram_detail_click";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface SourcingKeyword {
  id: string;
  keyword: string;
  category: Category;
  is_active: boolean;
  min_price: number | null;
  max_price: number | null;
  min_discount_rate: number | null;
  created_at: string;
  updated_at: string;
}

export interface SourcedProduct {
  id: string;
  source: string;
  source_product_id: string | null;
  category: Category;
  keyword: string | null;
  title: string;
  brand: string | null;
  model_name: string | null;
  image_url: string | null;
  source_url: string | null;
  coupang_url: string | null;
  affiliate_url: string | null;
  source_price: number | null;
  return_price: number | null;
  new_price: number | null;
  naver_lowest_price: number | null;
  condition_grade: ConditionGrade;
  stock_count: number | null;
  spec_json: Record<string, JsonValue>;
  raw_json: Record<string, JsonValue>;
  sourcing_status: SourcingStatus;
  is_published: boolean;
  is_rejected: boolean;
  rejection_reason: string | null;
  admin_memo: string | null;
  public_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealScore {
  id: string;
  product_id: string;
  total_score: number;
  price_score: number;
  condition_score: number;
  spec_score: number;
  category_risk_score: number;
  hidden_cost_score: number;
  as_score: number;
  timing_score: number;
  verdict: Verdict;
  reasons: string[];
  risk_flags: RiskFlag[];
  score_detail: Record<string, JsonValue>;
  created_at: string;
  updated_at: string;
}

export interface ProductWithScore extends SourcedProduct {
  deal_scores?: DealScore[];
  latest_score?: DealScore | null;
  product_snapshots?: ProductSnapshot[];
  snapshots?: ProductSnapshot[];
  latest_snapshot?: ProductSnapshot | null;
}

export interface AffiliateEvent {
  id: string;
  product_id: string | null;
  event_type: AffiliateEventType;
  channel: string | null;
  anon_session_id: string | null;
  referrer: string | null;
  utm_source: string | null;
  created_at: string;
}

export interface SourcingRun {
  id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  keyword_count: number;
  found_count: number;
  inserted_count: number;
  updated_count: number;
  error_count: number;
  error_message: string | null;
  log_json: Record<string, JsonValue>;
}

export interface TelegramLog {
  id: string;
  product_id: string | null;
  message: string | null;
  status: string | null;
  error: string | null;
  created_at: string;
}

export interface ProductSnapshot {
  id: string;
  product_id: string;
  observed_at: string;
  source_price: number | null;
  return_price: number | null;
  new_price: number | null;
  naver_lowest_price: number | null;
  stock_count: number | null;
  condition_grade: ConditionGrade;
  change_flags: SnapshotChangeFlag[];
  raw_json: Record<string, JsonValue>;
}
