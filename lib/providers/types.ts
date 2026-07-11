import type { Category, ConditionGrade, JsonValue } from "@/lib/types";

export interface ProviderProduct {
  source: string;
  source_product_id: string | null;
  category: Category;
  keyword: string;
  title: string;
  brand?: string | null;
  model_name?: string | null;
  image_url?: string | null;
  source_url?: string | null;
  coupang_url?: string | null;
  affiliate_url?: string | null;
  source_price?: number | null;
  return_price?: number | null;
  new_price?: number | null;
  condition_grade?: ConditionGrade;
  stock_count?: number | null;
  raw_json?: Record<string, JsonValue>;
}

export interface ProviderSearchResult {
  status:
    | "ok"
    | "API_NOT_CONFIGURED"
    | "DISABLED"
    | "ROBOTS_DISALLOWED"
    | "ROBOTS_UNAVAILABLE"
    | "INVALID_TEMPLATE"
    | "UNSUPPORTED_CONTENT_TYPE"
    | "CONTENT_TOO_LARGE"
    | "REDIRECT_BLOCKED"
    | "CRAWL_DELAY_TOO_HIGH"
    | "error";
  products: ProviderProduct[];
  error?: string;
  meta?: Record<string, JsonValue>;
}
