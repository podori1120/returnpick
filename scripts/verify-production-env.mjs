#!/usr/bin/env node

import assert from "node:assert/strict";
import { blankEnvSources, envRawEntries, envSource, envValue, loadEnvFiles } from "./load-env-files.mjs";

const args = process.argv.slice(2);
const launchMode = args.includes("--launch");
const loadedFiles = loadEnvFiles();
const results = [];

function add(status, name, detail) {
  results.push({ status, name, detail });
}

function looksLikePlaceholderValue(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return (
    raw.includes("your_") ||
    raw.includes("your-") ||
    raw.includes("change_me") ||
    raw.includes("changeme") ||
    raw.includes("placeholder") ||
    raw.includes("todo") ||
    raw === "test" ||
    raw === "secret" ||
    raw === "password" ||
    raw.startsWith("<") ||
    raw.endsWith(">")
  );
}

function isVercelMaskedValue(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  return raw === "[SENSITIVE]" || raw === "[REDACTED]" || raw === "[ENCRYPTED]";
}

function validatePublicHttpsUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
    return url.protocol === "https:" && !url.username && !url.password && !localHosts.has(hostname) && !hostname.endsWith(".local");
  } catch {
    return false;
  }
}

function validateCoupangPartnersUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "link.coupang.com" && /^\/a\/[A-Za-z0-9]{6,16}$/.test(url.pathname);
  } catch {
    return false;
  }
}

function validateProviderSecret(value, minLength = 8) {
  return value.length >= minLength && !/\s/.test(value) && !looksLikePlaceholderValue(value);
}

function validateSupabaseKey(value) {
  return value.length >= 40 && !/\s/.test(value) && !looksLikePlaceholderValue(value);
}

function validateAdminPassword(value) {
  return (
    value.length >= 12 &&
    !/\s/.test(value) &&
    !looksLikePlaceholderValue(value) &&
    !["admin", "password", "test"].includes(value.toLowerCase())
  );
}

function validateTelegramBotToken(value) {
  return !looksLikePlaceholderValue(value) && /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(value);
}

function validateTelegramChatId(value) {
  return !looksLikePlaceholderValue(value) && (/^-?\d{5,}$/.test(value) || /^@[A-Za-z0-9_]{5,}$/.test(value));
}

function validateBooleanString(value) {
  return value === "true" || value === "false";
}

function validateBloggerBlogId(value) {
  return /^\d{5,30}$/.test(value);
}

function validateBloggerPublishMode(value) {
  return value === "draft" || value === "publish";
}

const BOOTSTRAP_CATALOG_MAX_BYTES = 28_000;
const BOOTSTRAP_CATALOG_MAX_PRODUCTS = 40;
const BOOTSTRAP_CATALOG_CATEGORIES = new Set(["laptop", "monitor", "robot_vacuum", "cordless_vacuum", "air_purifier", "dehumidifier"]);
const BOOTSTRAP_CATALOG_CONDITION_GRADES = new Set(["미개봉", "최상", "상", "중", "알수없음", "확인필요"]);
const BOOTSTRAP_CATALOG_GENERIC_PARTNER_CODES = new Set(["dpyguokdsm"]);
const BOOTSTRAP_CATALOG_SUSPICIOUS_PARTNER_CODE_PATTERN = /(test|sample|example|fake|dummy|dryrun|safecheck|nonexisting|readiness)/i;
const BOOTSTRAP_CATALOG_MANUAL_REVIEW_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
const BOOTSTRAP_CATALOG_AUTOMATIC_OBSERVATION_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
const BOOTSTRAP_CATALOG_NAVER_SKU_REASONS = new Set(["EXACT_MODEL_CODE", "EXACT_MODEL_NAME", "SPEC_IDENTITY"]);
const BOOTSTRAP_CATALOG_IDENTITY_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;

function isCoupangHostname(hostname) {
  const host = hostname.trim().toLowerCase();
  return host === "coupang.com" || host.endsWith(".coupang.com");
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPublicImageHostname(hostname) {
  const host = hostname.trim().toLowerCase();
  if (!host || !host.includes(".") || host.includes(":")) return false;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan")) {
    return false;
  }
  return !isPrivateIpv4(host);
}

function isApprovalSampleProductAffiliateUrl(value) {
  const approval = envValue("NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL");
  if (!approval || !validateCoupangPartnersUrl(approval)) return false;
  try {
    const url = new URL(value);
    const approvalUrl = new URL(approval);
    return url.hostname === approvalUrl.hostname && url.pathname === approvalUrl.pathname;
  } catch {
    return false;
  }
}

function isUsableBootstrapAffiliateUrl(value) {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/a\/([A-Za-z0-9]{6,16})$/);
    if (url.protocol !== "https:" || url.hostname !== "link.coupang.com" || url.username || url.password || url.port || !match) return false;
    if (BOOTSTRAP_CATALOG_GENERIC_PARTNER_CODES.has(match[1].toLowerCase())) return false;
    if (BOOTSTRAP_CATALOG_SUSPICIOUS_PARTNER_CODE_PATTERN.test(match[1])) return false;
    return !isApprovalSampleProductAffiliateUrl(value);
  } catch {
    return false;
  }
}

function isUsableBootstrapProductUrl(value) {
  try {
    const url = new URL(value);
    return Boolean(
      url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !url.port &&
        isCoupangHostname(url.hostname) &&
        /^\/vp\/products\/\d+\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function isUsableBootstrapImageUrl(value) {
  try {
    const url = new URL(value);
    return Boolean(url.protocol === "https:" && !url.username && !url.password && !url.port && isPublicImageHostname(url.hostname));
  } catch {
    return false;
  }
}

function bootstrapRecordOf(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function bootstrapPositivePrice(value) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? Math.round(price) : null;
}

function bootstrapProductId(value) {
  return typeof value === "string" && /^\d+$/.test(value.trim()) ? value.trim() : null;
}

function bootstrapNormalizedText(value) {
  return typeof value === "string" ? value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim() : "";
}

function bootstrapStableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(bootstrapStableJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${bootstrapStableJson(value[key])}`)
    .join(",")}}`;
}

function bootstrapNaverProductFingerprint(product) {
  const identity = bootstrapStableJson({
    category: product.category,
    title: bootstrapNormalizedText(product.title),
    brand: bootstrapNormalizedText(product.brand),
    model_name: bootstrapNormalizedText(product.model_name),
    spec_json: product.spec_json ?? {}
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `v1:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function isBootstrapNaverPriceTrusted(product) {
  const price = bootstrapPositivePrice(product.naver_lowest_price);
  if (price == null) return false;
  const fingerprint = bootstrapNaverProductFingerprint(product);
  const candidates = [
    { record: bootstrapRecordOf(product.raw_json?.naver_price_manual), manual: true },
    { record: bootstrapRecordOf(product.raw_json?.naver_price_backfill), manual: false },
    { record: bootstrapRecordOf(product.raw_json?.naver_price_lookup), manual: false }
  ];
  for (const candidate of candidates) {
    const record = candidate.record;
    if (!record || bootstrapPositivePrice(record.price) !== price || record.product_fingerprint !== fingerprint) continue;
    if (candidate.manual && record.status === "confirmed") return true;
    if (!candidate.manual && record.status === "ok") {
      const match = bootstrapRecordOf(record.match);
      if (
        match &&
        (match.sku_confidence === "strong" || match.sku_confidence === "moderate") &&
        typeof match.sku_reason_code === "string" &&
        BOOTSTRAP_CATALOG_NAVER_SKU_REASONS.has(match.sku_reason_code) &&
        Number(match.sku_score) > 0
      ) {
        return true;
      }
    }
  }
  return false;
}

function isFreshBootstrapObservation(value, nowMs = Date.now()) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return false;
  const observationMs = Date.parse(value);
  return observationMs <= nowMs && nowMs - observationMs <= BOOTSTRAP_CATALOG_AUTOMATIC_OBSERVATION_MAX_AGE_MS;
}

function isBootstrapIdentityTimestamp(value) {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  const match = normalized.match(BOOTSTRAP_CATALOG_IDENTITY_TIMESTAMP_PATTERN);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , offsetText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetMatch = offsetText === "Z" ? null : offsetText.match(/^[+-](\d{2}):(\d{2})$/);
  const offsetHour = offsetMatch ? Number(offsetMatch[1]) : 0;
  const offsetMinute = offsetMatch ? Number(offsetMatch[2]) : 0;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    (!offsetMatch || (offsetHour <= 23 && offsetMinute <= 59)) &&
    Number.isFinite(Date.parse(normalized))
  );
}

function extractBootstrapProductId(value) {
  try {
    const url = new URL(value);
    if (!isUsableBootstrapProductUrl(value)) return null;
    return url.pathname.match(/^\/vp\/products\/(\d+)(?:\/|$)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function inspectBootstrapProductShape(product, index) {
  if (!product || typeof product !== "object" || Array.isArray(product)) return `product ${index + 1} is not an object`;

  const requiredTextFields = ["id", "source", "source_product_id", "title", "category", "condition_grade", "affiliate_url", "coupang_url", "image_url"];
  const missingField = requiredTextFields.find((field) => typeof product[field] !== "string" || !product[field].trim());
  if (missingField) return `product ${index + 1} is missing ${missingField}`;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(product.id)) return `product ${index + 1} has an invalid UUID`;
  if (!BOOTSTRAP_CATALOG_CATEGORIES.has(product.category)) return `product ${index + 1} has an unsupported category`;
  if (!BOOTSTRAP_CATALOG_CONDITION_GRADES.has(product.condition_grade)) return `product ${index + 1} has an invalid condition grade`;
  if (!isUsableBootstrapAffiliateUrl(product.affiliate_url)) return `product ${index + 1} has an invalid or unbound affiliate URL`;
  if (!isUsableBootstrapProductUrl(product.coupang_url)) return `product ${index + 1} has an invalid Coupang product URL`;
  if (!isUsableBootstrapImageUrl(product.image_url)) return `product ${index + 1} has an invalid public image URL`;
  const source = product.source.trim().toLowerCase();
  const provider = typeof product.raw_json?.provider === "string" ? product.raw_json.provider.toLowerCase() : "";
  if (source === "mock" || source.includes("mock") || source.includes("demo") || provider.includes("mock") || provider.includes("demo") || product.source_product_id.trim().toLowerCase().startsWith("seed-") || product.raw_json?.demo_seed === true || typeof product.raw_json?.demo_seed === "string") {
    return `product ${index + 1} is synthetic or demo data`;
  }
  if (product.sourcing_status !== "published" || product.is_published !== true) return `product ${index + 1} is not marked published`;
  const dealPrice = [product.return_price, product.source_price, product.new_price].find((value) => Number.isFinite(value) && value > 0);
  if (!dealPrice) return `product ${index + 1} is missing a usable selling price`;
  if (product.stock_count === 0) return `product ${index + 1} is explicitly sold out`;
  if (Number.isFinite(product.naver_lowest_price) && product.naver_lowest_price > 0 && isBootstrapNaverPriceTrusted(product) && dealPrice > product.naver_lowest_price) {
    return `product ${index + 1} is priced above the trusted Naver reference`;
  }
  if (product.condition_grade === "중" && dealPrice >= 1_000_000) return `product ${index + 1} is a high-price grade-middle return`;
  if (!product.raw_json || typeof product.raw_json !== "object" || Array.isArray(product.raw_json)) return `product ${index + 1} is missing raw evidence`;
  if (!product.raw_json.affiliate_verification || typeof product.raw_json.affiliate_verification !== "object" || Array.isArray(product.raw_json.affiliate_verification)) {
    return `product ${index + 1} is missing affiliate identity evidence`;
  }
  const identity = product.raw_json.affiliate_verification;
  const expectedProductId = extractBootstrapProductId(product.coupang_url);
  const validIdentityStatuses = new Set(["MATCH", "MANUAL_CONFIRMED"]);
  if (
    typeof identity.affiliate_url !== "string" ||
    identity.affiliate_url !== product.affiliate_url ||
    typeof identity.status !== "string" ||
    !validIdentityStatuses.has(identity.status) ||
    bootstrapProductId(identity.expected_product_id) !== expectedProductId ||
    identity.expected_id_source !== "coupang_url" ||
    (identity.status === "MATCH" && bootstrapProductId(identity.resolved_product_id) !== expectedProductId) ||
    (identity.status === "MANUAL_CONFIRMED" && identity.resolved_product_id !== null && bootstrapProductId(identity.resolved_product_id) !== expectedProductId) ||
    typeof identity.resolution_code !== "string" ||
    !identity.resolution_code.trim() ||
    typeof identity.checked_at !== "string" ||
    !isBootstrapIdentityTimestamp(identity.checked_at) ||
    !["automatic", "manual"].includes(identity.method) ||
    (identity.status === "MANUAL_CONFIRMED" ? identity.method !== "manual" : identity.method !== "automatic")
  ) {
    return `product ${index + 1} has unverified affiliate identity binding`;
  }
  const hasObservationTimestamp = typeof product.last_observed_at === "string" && Number.isFinite(Date.parse(product.last_observed_at));
  if (hasObservationTimestamp && !isFreshBootstrapObservation(product.last_observed_at)) return `product ${index + 1} has stale or future catalog observation`;
  const hasObservation = isFreshBootstrapObservation(product.last_observed_at);
  const manualReview = product.raw_json.manual_catalog_review;
  const reviewedAt = typeof manualReview?.reviewed_at === "string" ? Date.parse(manualReview.reviewed_at) : NaN;
  const normalizedSource = source;
  const hasManualReview =
    (normalizedSource === "manual_admin" || normalizedSource === "manual_affiliate_link") &&
    manualReview &&
    typeof manualReview === "object" &&
    !Array.isArray(manualReview) &&
    manualReview.status === "approved" &&
    manualReview.method === "manual" &&
    Number.isFinite(reviewedAt) &&
    reviewedAt <= Date.now() &&
    Date.now() - reviewedAt <= BOOTSTRAP_CATALOG_MANUAL_REVIEW_MAX_AGE_MS;
  const requiresManualReview = normalizedSource === "manual_admin" || normalizedSource === "manual_affiliate_link";
  if ((requiresManualReview && !hasManualReview) || (!requiresManualReview && !hasObservation)) {
    return requiresManualReview
      ? `product ${index + 1} is missing a fresh manual catalog review`
      : `product ${index + 1} is missing fresh catalog provenance`;
  }
  return null;
}

function inspectBootstrapCatalog(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return { status: "missing", detail: "not set; optional temporary catalog bridge" };
  if (isVercelMaskedValue(raw)) return { status: "masked", detail: "Vercel env pull masked the catalog value; use the live readiness card" };

  const byteSize = Buffer.byteLength(raw, "utf8");
  if (byteSize > BOOTSTRAP_CATALOG_MAX_BYTES) {
    return { status: "invalid", detail: `JSON is ${byteSize} bytes; maximum is ${BOOTSTRAP_CATALOG_MAX_BYTES} bytes` };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "invalid", detail: "value is not valid JSON" };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || parsed.version !== 1 || !Array.isArray(parsed.products)) {
    return { status: "invalid", detail: "expected {version:1, exported_at, products:[]}" };
  }
  if (parsed.products.length > BOOTSTRAP_CATALOG_MAX_PRODUCTS) {
    return { status: "invalid", detail: `catalog has ${parsed.products.length} products; maximum is ${BOOTSTRAP_CATALOG_MAX_PRODUCTS}` };
  }
  if (!parsed.products.length) return { status: "empty", detail: "valid JSON but products is empty" };
  const invalidProduct = parsed.products.map(inspectBootstrapProductShape).find(Boolean);
  if (invalidProduct) return { status: "invalid", detail: `${invalidProduct}; full runtime validation would reject this catalog` };
  const productIds = new Set();
  const sourceKeys = new Set();
  for (const product of parsed.products) {
    const sourceKey = `${product.source.trim().toLowerCase()}::${product.source_product_id.trim().toLowerCase()}`;
    if (productIds.has(product.id) || sourceKeys.has(sourceKey)) {
      return { status: "invalid", detail: "catalog contains duplicate product or source-product identities" };
    }
    productIds.add(product.id);
    sourceKeys.add(sourceKey);
  }
  if (typeof parsed.exported_at !== "string" || !Number.isFinite(Date.parse(parsed.exported_at))) {
    return { status: "invalid", detail: "exported_at must be a valid timestamp" };
  }
  return { status: "valid", detail: `${parsed.products.length} products, ${byteSize} bytes; full product validation runs at runtime` };
}

function runBootstrapCatalogSelfTest() {
  const approvalPath = (() => {
    try {
      return new URL(envValue("NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL")).pathname;
    } catch {
      return "";
    }
  })();
  const affiliateUrl = approvalPath === "/a/AbCd123" ? "https://link.coupang.com/a/ZyXw987" : "https://link.coupang.com/a/AbCd123";
  const now = new Date().toISOString();
  const baseProduct = {
    id: "11111111-1111-4111-8111-111111111111",
    source: "public_web",
    source_product_id: "preflight-9200000001",
    title: "ReturnPick preflight monitor",
    category: "monitor",
    condition_grade: "최상",
    affiliate_url: affiliateUrl,
    coupang_url: "https://www.coupang.com/vp/products/9200000001?itemId=27000000001",
    image_url: "https://images.example.com/returnpick-preflight.jpg",
    source_price: 150000,
    stock_count: 2,
    sourcing_status: "published",
    is_published: true,
    last_observed_at: now,
    raw_json: {
      affiliate_verification: {
        affiliate_url: affiliateUrl,
        status: "MATCH",
        expected_product_id: "9200000001",
        expected_id_source: "coupang_url",
        resolved_product_id: "9200000001",
        resolution_code: "RESOLVED_PRODUCT",
        checked_at: now,
        method: "automatic"
      }
    }
  };
  const inspect = (product) => inspectBootstrapCatalog(JSON.stringify({ version: 1, exported_at: now, products: [product] }));
  const inspectWithApprovalEnv = (product) => {
    const previous = process.env.NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL;
    process.env.NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL = product.affiliate_url;
    try {
      return inspect(product);
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL;
      else process.env.NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL = previous;
    }
  };

  assert.equal(inspect(baseProduct).status, "valid");
  assert.equal(inspect(null).status, "invalid");
  assert.equal(inspect({}).status, "invalid");
  assert.equal(inspect({ ...baseProduct, source_price: null }).status, "invalid");
  assert.equal(inspect({ ...baseProduct, stock_count: 0 }).status, "invalid");
  assert.equal(inspect({ ...baseProduct, sourcing_status: "needs_review", is_published: false }).status, "invalid");
  assert.equal(inspect({ ...baseProduct, last_observed_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000).toISOString() }).status, "invalid");
  assert.equal(inspect({ ...baseProduct, last_observed_at: new Date(Date.now() + 60 * 60 * 1_000).toISOString() }).status, "invalid");
  assert.equal(
    inspect({
      ...baseProduct,
      raw_json: { ...baseProduct.raw_json, provider: "demo_provider", demo_seed: true }
    }).status,
    "invalid"
  );
  assert.equal(
    inspect({
      ...baseProduct,
      raw_json: {
        affiliate_verification: {
          ...baseProduct.raw_json.affiliate_verification,
          expected_id_source: null,
          checked_at: null,
          method: "bogus"
        }
      }
    }).status,
    "invalid"
  );
  assert.equal(inspect({ ...baseProduct, raw_json: { affiliate_verification: { ...baseProduct.raw_json.affiliate_verification, checked_at: "1" } } }).status, "invalid");
  assert.equal(inspect({ ...baseProduct, raw_json: { affiliate_verification: { ...baseProduct.raw_json.affiliate_verification, checked_at: "2026-02-30T00:00:00.000Z" } } }).status, "invalid");
  assert.equal(inspect({ ...baseProduct, raw_json: { affiliate_verification: { ...baseProduct.raw_json.affiliate_verification, method: "manual" } } }).status, "invalid");
  assert.equal(inspect({ ...baseProduct, raw_json: { affiliate_verification: { ...baseProduct.raw_json.affiliate_verification, expected_product_id: "not-numeric" } } }).status, "invalid");
  assert.equal(inspect({ ...baseProduct, raw_json: { affiliate_verification: { ...baseProduct.raw_json.affiliate_verification, status: "MISMATCH", resolved_product_id: null } } }).status, "invalid");
  assert.equal(inspect({ ...baseProduct, raw_json: { affiliate_verification: { ...baseProduct.raw_json.affiliate_verification, status: "MANUAL_CONFIRMED", method: "manual", expected_product_id: null, expected_id_source: null, resolved_product_id: null } } }).status, "invalid");
  assert.equal(inspect({ ...baseProduct, raw_json: { affiliate_verification: { ...baseProduct.raw_json.affiliate_verification, resolution_code: "" } } }).status, "invalid");
  assert.equal(inspect({ ...baseProduct, source: "manual_admin" }).status, "invalid");
  assert.equal(inspect({ ...baseProduct, source: " manual_admin " }).status, "invalid");
  const untrustedNaverProduct = { ...baseProduct, naver_lowest_price: 100000 };
  assert.equal(inspect(untrustedNaverProduct).status, "valid");
  const trustedNaverProduct = {
    ...untrustedNaverProduct,
    raw_json: {
      ...baseProduct.raw_json,
      naver_price_manual: {
        status: "confirmed",
        price: 100000,
        product_fingerprint: bootstrapNaverProductFingerprint(untrustedNaverProduct)
      }
    }
  };
  assert.equal(inspect(trustedNaverProduct).status, "invalid");
  assert.equal(inspect({ ...baseProduct, last_observed_at: null, raw_json: { ...baseProduct.raw_json, manual_catalog_review: { status: "approved", method: "manual", reviewed_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000).toISOString() } }, source: "manual_admin" }).status, "invalid");
  assert.equal(inspectBootstrapCatalog(JSON.stringify({ version: 1, exported_at: now, products: [] })).status, "empty");
  assert.equal(inspectBootstrapCatalog(JSON.stringify({ version: 1, exported_at: now, products: Array.from({ length: BOOTSTRAP_CATALOG_MAX_PRODUCTS + 1 }, () => baseProduct) })).status, "invalid");
  assert.equal(inspectBootstrapCatalog(JSON.stringify({ version: 1, exported_at: now, products: [baseProduct], padding: "x".repeat(BOOTSTRAP_CATALOG_MAX_BYTES) })).status, "invalid");
  assert.equal(inspectBootstrapCatalog(JSON.stringify({ version: 1, exported_at: now, products: [baseProduct, { ...baseProduct, id: "22222222-2222-4222-8222-222222222222" }] })).status, "invalid");
  assert.equal(inspect({ ...baseProduct, coupang_url: "https://evil.example/vp/products/9200000001" }).status, "invalid");
  assert.equal(inspect({ ...baseProduct, coupang_url: "https://www.coupang.com/vp/products/not-a-number" }).status, "invalid");
  assert.equal(inspect({ ...baseProduct, coupang_url: "https://www.coupang.com/vp/products/9200000001/extra" }).status, "invalid");
  assert.equal(inspect({ ...baseProduct, coupang_url: "https://user:pass@www.coupang.com/vp/products/9200000001" }).status, "invalid");
  assert.equal(inspect({ ...baseProduct, coupang_url: "https://www.coupang.com:8443/vp/products/9200000001" }).status, "invalid");
  assert.equal(inspect({ ...baseProduct, image_url: "https://127.0.0.1/private.jpg" }).status, "invalid");
  assert.equal(inspect({ ...baseProduct, image_url: "https://user:pass@images.example.com/private.jpg" }).status, "invalid");
  assert.equal(inspect({ ...baseProduct, affiliate_url: "https://link.coupang.com/a/sample123" }).status, "invalid");
  assert.equal(inspect({ ...baseProduct, affiliate_url: "https://link.coupang.com/a/dpyguokdsm" }).status, "invalid");
  assert.equal(inspectWithApprovalEnv(baseProduct).status, "invalid");
  assert.equal(inspect({ ...baseProduct, raw_json: { affiliate_verification: { ...baseProduct.raw_json.affiliate_verification, status: "MISMATCH", resolved_product_id: "9999999999" } } }).status, "invalid");
}

if (process.argv.includes("--self-test-bootstrap-catalog")) {
  runBootstrapCatalogSelfTest();
  console.log("Bootstrap catalog environment preflight checks passed.");
  process.exit(0);
}

function validatePositiveInteger(value) {
  return /^\d+$/.test(value) && Number(value) > 0;
}

function validateAffiliateBackfillLimit(value) {
  return validatePositiveInteger(value) && Number(value) <= 20;
}

function validateSourcingEnrichmentConcurrency(value) {
  return validatePositiveInteger(value) && Number(value) <= 4;
}

function splitList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isPublicWebHost(host) {
  const raw = host.trim().toLowerCase();
  if (!raw) return false;
  if (raw.includes("://") || raw.includes("/") || raw.includes("?") || raw.includes("#")) return false;
  if (raw === "*" || raw.includes("*")) return false;
  if (raw === "localhost" || raw === "127.0.0.1" || raw === "0.0.0.0" || raw === "::1" || raw.endsWith(".local")) return false;
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(raw);
}

function isPublicWebTemplate(template, allowedHosts) {
  if (!template.includes("{keyword}")) return false;
  try {
    const url = new URL(template.replace("{keyword}", "returnpick-test"));
    const hostname = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (url.username || url.password) return false;
    return allowedHosts.has(hostname);
  } catch {
    return false;
  }
}

const checks = [
  { name: "NEXT_PUBLIC_SITE_URL", required: true, validate: validatePublicHttpsUrl, hint: "external HTTPS URL" },
  { name: "NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL", required: true, validate: validateCoupangPartnersUrl, hint: "Coupang Partners short URL" },
  { name: "ADMIN_PASSWORD", required: true, validate: validateAdminPassword, hint: "12+ chars, non-placeholder, no whitespace" },
  { name: "CRON_SECRET", required: true, validate: (value) => validateProviderSecret(value, 16), hint: "16+ chars, non-placeholder" },
  { name: "NEXT_PUBLIC_SUPABASE_URL", required: true, validate: validatePublicHttpsUrl, hint: "Supabase project HTTPS URL" },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true, validate: validateSupabaseKey, hint: "complete anon key" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", required: true, validate: validateSupabaseKey, hint: "complete service role key" },
  { name: "COUPANG_ACCESS_KEY", required: false, validate: (value) => validateProviderSecret(value, 8), hint: "optional official API key for automated sourcing" },
  { name: "COUPANG_SECRET_KEY", required: false, validate: (value) => validateProviderSecret(value, 8), hint: "optional official API secret for automated sourcing" },
  { name: "COUPANG_PARTNER_ID", required: false, validate: (value) => validateProviderSecret(value, 2), hint: "optional partner ID for automated sourcing" },
  { name: "NAVER_CLIENT_ID", required: false, validate: (value) => validateProviderSecret(value, 5), hint: "optional Naver client ID for price comparison" },
  { name: "NAVER_CLIENT_SECRET", required: false, validate: (value) => validateProviderSecret(value, 5), hint: "optional Naver client secret for price comparison" },
  { name: "TELEGRAM_BOT_TOKEN", required: false, validate: validateTelegramBotToken, hint: "optional 123456:bot-token for Telegram delivery" },
  { name: "TELEGRAM_CHAT_ID", required: false, validate: validateTelegramChatId, hint: "optional numeric chat ID or @channel for Telegram delivery" },
  { name: "BLOGGER_BLOG_ID", required: false, validate: validateBloggerBlogId, hint: "optional numeric Blogger blog ID" },
  { name: "BLOGGER_BLOG_URL", required: false, validate: validatePublicHttpsUrl, hint: "optional public Blogger HTTPS URL" },
  { name: "GOOGLE_OAUTH_CLIENT_ID", required: false, validate: (value) => validateProviderSecret(value, 12), hint: "optional server-only Google OAuth client ID" },
  { name: "GOOGLE_OAUTH_CLIENT_SECRET", required: false, validate: (value) => validateProviderSecret(value, 12), hint: "optional server-only Google OAuth client secret" },
  { name: "GOOGLE_OAUTH_REFRESH_TOKEN", required: false, validate: (value) => validateProviderSecret(value, 20), hint: "optional server-only Google OAuth refresh token" },
  { name: "BLOGGER_DISTRIBUTION_ENABLED", required: false, validate: validateBooleanString, hint: "true or false" },
  { name: "BLOGGER_PUBLISH_MODE", required: false, validate: validateBloggerPublishMode, hint: "draft or publish" },
  { name: "CRON_USE_MOCK_FALLBACK", required: false, validate: validateBooleanString, hint: "true or false" },
  { name: "SOURCING_TIME_BUDGET_MS", required: false, validate: validatePositiveInteger, hint: "positive integer milliseconds" },
  { name: "SOURCING_KEYWORD_LIMIT", required: false, validate: validatePositiveInteger, hint: "positive integer" },
  { name: "SOURCING_ENRICHMENT_CONCURRENCY", required: false, validate: validateSourcingEnrichmentConcurrency, hint: "integer from 1 to 4" },
  { name: "AFFILIATE_BACKFILL_LIMIT", required: false, validate: validateAffiliateBackfillLimit, hint: "positive integer up to 20" },
  { name: "PUBLIC_WEB_CRAWL_ENABLED", required: false, validate: validateBooleanString, hint: "true or false" }
];

const envGroups = [
  {
    label: "site and approval",
    names: ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL"]
  },
  {
    label: "admin and scheduler",
    names: ["ADMIN_PASSWORD", "CRON_SECRET", "CRON_USE_MOCK_FALLBACK", "SOURCING_TIME_BUDGET_MS", "SOURCING_KEYWORD_LIMIT", "SOURCING_ENRICHMENT_CONCURRENCY", "AFFILIATE_BACKFILL_LIMIT"]
  },
  {
    label: "Supabase",
    names: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
  },
  {
    label: "preapproval catalog bridge",
    names: ["RETURNPICK_BOOTSTRAP_CATALOG_JSON"]
  },
  {
    label: "Coupang Partners API",
    names: ["COUPANG_ACCESS_KEY", "COUPANG_SECRET_KEY", "COUPANG_PARTNER_ID"]
  },
  {
    label: "Naver Shopping API",
    names: ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"]
  },
  {
    label: "Telegram",
    names: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]
  },
  {
    label: "Blogger distribution",
    names: [
      "BLOGGER_BLOG_ID",
      "BLOGGER_BLOG_URL",
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "GOOGLE_OAUTH_REFRESH_TOKEN",
      "BLOGGER_DISTRIBUTION_ENABLED",
      "BLOGGER_PUBLISH_MODE"
    ]
  },
  {
    label: "public web optional source",
    names: ["PUBLIC_WEB_CRAWL_ENABLED", "PUBLIC_WEB_ALLOWED_HOSTS", "PUBLIC_WEB_SEARCH_TEMPLATES"]
  }
];

function outerWhitespaceSource(name) {
  return envRawEntries(name).find((entry) => {
    const raw = String(entry.value ?? "");
    return raw.length > 0 && raw !== raw.trim();
  })?.source ?? "";
}

function invalidValueStatus(check) {
  return launchMode && !check.required ? "WARN" : "FAIL";
}

function checkEnvItem(check) {
  const value = envValue(check.name);
  const blankSources = blankEnvSources(check.name);
  const source = envSource(check.name);
  const mustHave = launchMode && check.required;

  if (!value) {
    const detail = blankSources.length ? `blank in ${blankSources.join(", ")}` : "not set";
    if (mustHave) add("FAIL", check.name, `${detail}; expected ${check.hint}`);
    else add("WARN", check.name, `${detail}; expected ${check.hint}`);
    return;
  }

  if (isVercelMaskedValue(value)) {
    add(
      launchMode && check.required ? "FAIL" : "WARN",
      check.name,
      "Vercel env pull masks this secret locally; use the live Vercel readiness check or provide the real value in a local-only env file"
    );
    return;
  }

  const whitespaceSource = outerWhitespaceSource(check.name);
  if (whitespaceSource) {
    add(invalidValueStatus(check), check.name, `value has leading or trailing whitespace in ${whitespaceSource}; paste the value again without spaces`);
    return;
  }

  if (!check.validate(value)) {
    add(invalidValueStatus(check), check.name, `invalid format from ${source || "unknown source"}; expected ${check.hint}`);
    return;
  }

  add("PASS", check.name, `set and valid from ${source || "env"}`);
}

for (const check of checks) checkEnvItem(check);

const bootstrapCatalogInspection = inspectBootstrapCatalog(envValue("RETURNPICK_BOOTSTRAP_CATALOG_JSON"));
if (bootstrapCatalogInspection.status === "valid") {
  add("PASS", "RETURNPICK_BOOTSTRAP_CATALOG_JSON", bootstrapCatalogInspection.detail);
} else if (bootstrapCatalogInspection.status === "missing") {
  add("WARN", "RETURNPICK_BOOTSTRAP_CATALOG_JSON", bootstrapCatalogInspection.detail);
} else if (bootstrapCatalogInspection.status === "empty") {
  add("WARN", "RETURNPICK_BOOTSTRAP_CATALOG_JSON", bootstrapCatalogInspection.detail);
} else if (bootstrapCatalogInspection.status === "masked") {
  add("WARN", "RETURNPICK_BOOTSTRAP_CATALOG_JSON", bootstrapCatalogInspection.detail);
} else {
  add("WARN", "RETURNPICK_BOOTSTRAP_CATALOG_JSON", bootstrapCatalogInspection.detail);
}

const anon = envValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const service = envValue("SUPABASE_SERVICE_ROLE_KEY");
if (anon && service) {
  if (isVercelMaskedValue(anon) || isVercelMaskedValue(service)) {
    add(
      launchMode ? "FAIL" : "WARN",
      "SUPABASE_KEYS_DIFFER",
      "Vercel env pull masked one or both Supabase keys locally; compare the actual key fields in Supabase or use the live readiness check"
    );
  } else {
    add(anon === service ? "FAIL" : "PASS", "SUPABASE_KEYS_DIFFER", anon === service ? "anon and service role keys must be different" : "anon and service role keys differ");
  }
}

if (envValue("PUBLIC_WEB_CRAWL_ENABLED") === "true") {
  const hosts = splitList(envValue("PUBLIC_WEB_ALLOWED_HOSTS"));
  const templates = splitList(envValue("PUBLIC_WEB_SEARCH_TEMPLATES"));
  const hostSet = new Set(hosts.map((host) => host.toLowerCase()));
  add(hosts.length > 0 && hosts.length <= 5 && hosts.every(isPublicWebHost) ? "PASS" : "FAIL", "PUBLIC_WEB_ALLOWED_HOSTS", "1-5 public hostnames without protocol/path/wildcards");
  add(
    templates.length > 0 && templates.length <= 5 && templates.every((template) => isPublicWebTemplate(template, hostSet)) ? "PASS" : "FAIL",
    "PUBLIC_WEB_SEARCH_TEMPLATES",
    "1-5 http(s) templates with {keyword} and allowed hosts"
  );
}

console.log("ReturnPick production env check");
console.log(`mode: ${launchMode ? "launch" : "report"}`);
console.log(`env files: ${loadedFiles.length ? loadedFiles.join(", ") : "none"}`);
console.log("=".repeat(44));

for (const item of results) {
  console.log(`${item.status} ${item.name} - ${item.detail}`);
}

const failures = results.filter((item) => item.status === "FAIL");
const warnings = results.filter((item) => item.status === "WARN");
console.log("=".repeat(44));
console.log(`summary: ${results.length - failures.length - warnings.length} pass, ${warnings.length} warn, ${failures.length} fail`);

function printNextActions() {
  const blockingNames = new Set(
    results
      .filter((item) => item.status === "FAIL")
      .map((item) => item.name)
      .filter((name) => name !== "SUPABASE_KEYS_DIFFER")
  );
  const blankRequiredNames = checks
    .filter((check) => launchMode && check.required && blockingNames.has(check.name))
    .map((check) => check.name);

  if (!blankRequiredNames.length && !failures.length) return;

  console.log("");
  console.log("Next action checklist");
  console.log("1. Open Vercel > returnpick > Settings > Environment Variables > Production.");

  for (const group of envGroups) {
    const names = group.names.filter((name) => blockingNames.has(name));
    if (names.length) console.log(`- ${group.label}: ${names.join(", ")}`);
  }

  if (blockingNames.has("SUPABASE_KEYS_DIFFER")) {
    console.log("- Supabase: NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be copied from different Supabase key fields.");
  }

  console.log("2. Save the values, redeploy production, then run `npm run env:vercel:launch` again.");
  console.log("3. After it passes, run `npm run doctor:production:launch` before first live sourcing.");
}

printNextActions();

if (launchMode && warnings.length) {
  console.log("launch mode: site, manual partner link, Supabase, admin, and scheduler values are required; Coupang API, Naver, and Telegram gaps remain warnings.");
} else {
  console.log("report mode: missing post-approval provider keys are warnings; invalid present values are failures.");
}

if (failures.length) process.exitCode = 1;
