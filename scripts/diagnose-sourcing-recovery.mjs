#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { envValue, loadEnvFiles } from "./load-env-files.mjs";

loadEnvFiles();

const categories = ["laptop", "monitor", "robot_vacuum", "cordless_vacuum", "air_purifier", "dehumidifier"];
const firstLaunchMarker = "post_approval_first_launch";
const partnerShortPathPattern = /^\/a\/([A-Za-z0-9]{6,16})$/;
const suspiciousPartnerCodePattern = /(test|sample|example|fake|dummy|dryrun|safecheck|nonexisting|readiness)/i;
const results = [];
const actions = [];

function add(status, name, detail) {
  results.push({ status, name, detail });
}

function action(text) {
  if (!actions.includes(text)) actions.push(text);
}

function hasEnv(name) {
  return Boolean(envValue(name));
}

function numberValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function recordValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function stringValue(value) {
  return typeof value === "string" ? value : "";
}

function parseUrl(value) {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isStrictPartnersLink(value) {
  const url = parseUrl(value);
  if (!url) return false;
  if (url.protocol !== "https:" || url.hostname !== "link.coupang.com") return false;
  const match = url.pathname.match(partnerShortPathPattern);
  return Boolean(match && !suspiciousPartnerCodePattern.test(match[1]));
}

function isApprovalSampleLink(value) {
  const url = parseUrl(value);
  const approvalUrl = parseUrl(envValue("NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL"));
  if (!url || !approvalUrl) return false;
  return url.protocol === approvalUrl.protocol && url.hostname === approvalUrl.hostname && url.pathname === approvalUrl.pathname;
}

function isProductAffiliateReady(value) {
  return isStrictPartnersLink(value) && !isApprovalSampleLink(value);
}

function isSourcingExecutionRun(run) {
  return !(run?.status === "launch_confirmed" && recordValue(run?.log_json)?.kind === firstLaunchMarker);
}

function summarizeProviderLogs(run) {
  const logs = arrayValue(recordValue(run?.log_json)?.logs).map(recordValue).filter(Boolean);
  const stats = new Map();
  let providerErrors = 0;
  let apiNotConfigured = 0;

  for (const log of logs) {
    const provider = stringValue(log.provider) || "unknown";
    const current = stats.get(provider) ?? { fetched: 0, accepted: 0, statuses: new Set() };
    current.fetched += numberValue(log.fetched) ?? 0;
    current.accepted += numberValue(log.accepted) ?? 0;
    const status = stringValue(log.provider_status) || stringValue(log.status);
    if (status) current.statuses.add(status);
    if (stringValue(log.status) === "provider_error") providerErrors += 1;
    if (status === "API_NOT_CONFIGURED") apiNotConfigured += 1;

    for (const issue of arrayValue(log.provider_issues)) {
      const record = recordValue(issue);
      const issueStatus = stringValue(record?.provider_status);
      if (issueStatus === "API_NOT_CONFIGURED") apiNotConfigured += 1;
    }

    stats.set(provider, current);
  }

  return {
    logs,
    providerErrors,
    apiNotConfigured,
    stats: Array.from(stats.entries()).map(([provider, stat]) => ({
      provider,
      fetched: stat.fetched,
      accepted: stat.accepted,
      statuses: Array.from(stat.statuses)
    }))
  };
}

function publicBlockersForProduct(product) {
  const blockers = [];
  const affiliateUrl = stringValue(product.affiliate_url);
  const conditionGrade = stringValue(product.condition_grade);
  const returnPrice = numberValue(product.return_price);
  const sourcePrice = numberValue(product.source_price);
  const naverPrice = numberValue(product.naver_lowest_price);
  const dealPrice = returnPrice ?? sourcePrice;

  if (!isProductAffiliateReady(affiliateUrl)) {
    blockers.push(isApprovalSampleLink(affiliateUrl) ? "승인용 샘플 링크 사용 중" : "상품별 파트너스 링크 필요");
  }
  if (!returnPrice) blockers.push("반품가 확인 필요");
  if (conditionGrade === "확인필요" || conditionGrade === "알수없음") blockers.push("반품등급 확인 필요");
  if (!stringValue(product.image_url)) blockers.push("상품 이미지 확인 필요");
  if (naverPrice && dealPrice && dealPrice > naverPrice) blockers.push("네이버 최저가 대비 가격 불리");
  if (conditionGrade === "중" && (dealPrice ?? 0) >= 1_000_000) blockers.push("고가 반품-중 조합");

  return blockers;
}

function topCounts(values, limit = 5) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

function printResults() {
  console.log("=".repeat(44));
  for (const item of results) console.log(`${item.status} ${item.name} - ${item.detail}`);
  console.log("=".repeat(44));
  const failures = results.filter((item) => item.status === "FAIL");
  const warnings = results.filter((item) => item.status === "WARN");
  console.log(`summary: ${results.length - failures.length - warnings.length} pass, ${warnings.length} warn, ${failures.length} fail`);
  if (actions.length) {
    console.log("");
    console.log("Recommended next actions");
    for (const item of actions.slice(0, 8)) console.log(`- ${item}`);
  }
  if (failures.length) process.exitCode = 1;
}

async function inspectKeywords(client) {
  const { data, error } = await client
    .from("sourcing_keywords")
    .select("id,keyword,category,is_active,min_price,max_price,min_discount_rate,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    add("FAIL", "sourcing_keywords query", error.message);
    action("Apply sql/schema.sql, verify SUPABASE_SERVICE_ROLE_KEY, then run npm run schema:production.");
    return [];
  }

  const keywords = data ?? [];
  const active = keywords.filter((keyword) => keyword.is_active);
  const categoryCounts = new Map(categories.map((category) => [category, 0]));
  const strictPrice = [];
  const strictDiscount = [];

  for (const keyword of active) {
    categoryCounts.set(keyword.category, (categoryCounts.get(keyword.category) ?? 0) + 1);
    const min = numberValue(keyword.min_price);
    const max = numberValue(keyword.max_price);
    const discount = numberValue(keyword.min_discount_rate);
    if (min != null && max != null && max >= min && max - min < 150000) strictPrice.push(keyword.keyword);
    if (discount != null && discount > 0.2) strictDiscount.push(keyword.keyword);
    if (min != null && max != null && min > max) {
      add("FAIL", `keyword price range:${keyword.keyword}`, `min_price ${min} is greater than max_price ${max}`);
    }
  }

  add(keywords.length ? "PASS" : "WARN", "keyword count", `${keywords.length} total, ${active.length} active`);
  if (!keywords.length) action("Run sourcing once or seed sql/seed.sql; the app can auto-insert default keywords on an empty DB.");
  if (active.length < 12) {
    add("WARN", "active keyword coverage", `${active.length} active keywords is thin for first launch`);
    action("Keep at least 20-24 active keywords across laptop, monitor, robot vacuum, cordless vacuum, air purifier, and dehumidifier.");
  } else {
    add("PASS", "active keyword coverage", `${active.length} active keywords`);
  }

  const missingCategories = categories.filter((category) => !categoryCounts.get(category));
  if (missingCategories.length) {
    add("WARN", "category coverage", `missing active categories: ${missingCategories.join(", ")}`);
    action("Add or reactivate at least one keyword for every launch category before wide sourcing.");
  } else {
    add("PASS", "category coverage", "all launch categories have active keywords");
  }

  if (strictPrice.length) {
    add("WARN", "strict price filters", `${strictPrice.slice(0, 8).join(", ")}${strictPrice.length > 8 ? "..." : ""}`);
    action("If first sourcing finds 0 candidates, widen narrow min/max price ranges before changing API keys.");
  } else {
    add("PASS", "strict price filters", "no very narrow active price ranges detected");
  }

  if (strictDiscount.length) {
    add("WARN", "strict discount filters", `${strictDiscount.slice(0, 8).join(", ")}${strictDiscount.length > 8 ? "..." : ""}`);
    action("Keep min_discount_rate around 0.10-0.15 for launch; tighten after real inventory exists.");
  } else {
    add("PASS", "strict discount filters", "active discount filters are launch-friendly");
  }

  return keywords;
}

async function inspectLatestRun(client) {
  const { data, error } = await client
    .from("sourcing_runs")
    .select("id,status,started_at,finished_at,keyword_count,found_count,inserted_count,updated_count,error_count,error_message,log_json")
    .order("started_at", { ascending: false })
    .limit(12);

  if (error) {
    add("FAIL", "sourcing_runs query", error.message);
    action("Verify sourcing_runs exists by running npm run schema:production after applying sql/schema.sql.");
    return;
  }

  const latestRun = (data ?? []).find(isSourcingExecutionRun);
  if (!latestRun) {
    add("WARN", "latest sourcing run", "no real sourcing execution run found");
    action("After env and schema pass, run npm run launch:production -- standard confirm or use /admin first launch.");
    return;
  }

  add("PASS", "latest sourcing run", `${latestRun.status} at ${latestRun.started_at}`);
  const summary = summarizeProviderLogs(latestRun);
  const fetched = summary.stats.reduce((sum, stat) => sum + stat.fetched, 0);
  const accepted = summary.stats.reduce((sum, stat) => sum + stat.accepted, 0);
  const priceFiltered = Math.max(0, fetched - accepted);

  add(latestRun.found_count > 0 ? "PASS" : "WARN", "latest candidates", `${latestRun.found_count} found, ${latestRun.inserted_count} inserted, ${latestRun.updated_count} updated`);
  if (latestRun.found_count === 0) {
    action("Run /admin API readiness first; if providers pass, widen keyword price/discount filters and use the wider first-launch preset.");
  }

  if (summary.stats.length) {
    const providerText = summary.stats
      .slice(0, 5)
      .map((stat) => `${stat.provider} ${stat.accepted}/${stat.fetched}${stat.statuses.length ? ` (${stat.statuses.slice(0, 3).join(",")})` : ""}`)
      .join("; ");
    add("PASS", "provider summary", providerText);
  } else {
    add("WARN", "provider summary", "no provider log rows found");
    action("Check whether the sourcing run failed before provider calls; inspect /admin sourcing diagnostics.");
  }

  if (priceFiltered > 0 && accepted === 0) {
    add("WARN", "price filter impact", `${priceFiltered} fetched products were filtered out before saving`);
    action("Temporarily relax min_price, max_price, and min_discount_rate for the affected active keywords.");
  } else if (priceFiltered > 0) {
    add("PASS", "price filter impact", `${priceFiltered} fetched products filtered, ${accepted} accepted`);
  }

  if (summary.providerErrors) {
    add("WARN", "provider errors", `${summary.providerErrors} provider error log row(s)`);
    action("Provider errors with fallback candidates are warnings; provider errors with 0 candidates need API readiness and credential checks.");
  }

  if (summary.apiNotConfigured) {
    add("WARN", "provider API_NOT_CONFIGURED", `${summary.apiNotConfigured} API_NOT_CONFIGURED signal(s)`);
    action("Add post-approval Coupang/Naver keys to Vercel Production, redeploy, then run npm run env:vercel:launch.");
  }
}

async function inspectProductVisibility(client) {
  const { data, error } = await client
    .from("sourced_products")
    .select("id,title,sourcing_status,is_published,affiliate_url,return_price,source_price,naver_lowest_price,condition_grade,image_url,created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    add("FAIL", "sourced_products query", error.message);
    action("Verify sourced_products exists and sql/schema.sql was applied, then run npm run schema:production.");
    return;
  }

  const products = data ?? [];
  const needsReview = products.filter((product) => product.sourcing_status === "needs_review");
  const published = products.filter((product) => product.is_published && product.sourcing_status === "published");
  const publicReady = published.filter((product) => publicBlockersForProduct(product).length === 0);
  const hiddenPublished = Math.max(0, published.length - publicReady.length);
  const missingAffiliate = products.filter((product) => !isProductAffiliateReady(stringValue(product.affiliate_url)));
  const approvalSampleReuse = products.filter((product) => isApprovalSampleLink(stringValue(product.affiliate_url)));
  const blockerPairs = published.flatMap((product) => publicBlockersForProduct(product));
  const blockerSummary = topCounts(blockerPairs).map(([label, count]) => `${label} ${count}`).join("; ");

  add(products.length ? "PASS" : "WARN", "product inventory", `${products.length} recent products inspected, ${needsReview.length} needs_review, ${published.length} published`);
  if (!products.length) {
    action("환경변수와 Supabase 스키마 점검이 통과한 뒤 첫 가동 또는 관리자 수집을 실행하세요. 아직 게시할 sourced_products 행이 없습니다.");
    return;
  }

  add(publicReady.length ? "PASS" : "WARN", "public deal visibility", `${publicReady.length} customer-visible published deal(s), ${hiddenPublished} hidden published row(s)`);
  if (!publicReady.length) {
    if (needsReview.length) action("관리자 후보 검토 큐에서 상품별 파트너스 링크가 준비된 후보부터 승인·게시하세요.");
    if (published.length) action("게시 상태인데 고객 화면에서 숨겨진 상품은 /deals나 텔레그램을 기대하기 전에 공개 차단 사유부터 보강하세요.");
  }

  if (blockerPairs.length) {
    add("WARN", "public blockers", blockerSummary || "published rows have public quality blockers");
  } else if (published.length) {
    add("PASS", "public blockers", "no blockers found on published rows");
  }

  if (missingAffiliate.length) {
    add("WARN", "affiliate link repair queue", `${missingAffiliate.length} inspected product(s) need a product-level Partners link`);
    action("/admin의 링크 보강 큐를 사용하거나 승인 후 쿠팡 API 링크 보강을 실행해 상품별 파트너스 링크를 채우세요.");
  } else {
    add("PASS", "affiliate link repair queue", "inspected products have strict product-level Partners links");
  }

  if (approvalSampleReuse.length) {
    add("WARN", "approval sample link reuse", `${approvalSampleReuse.length} inspected product(s) still use the approval sample link`);
    action("실제 딜 게시 전 승인용 샘플 링크를 상품별 쿠팡 파트너스 링크로 교체하세요.");
  }
}

async function main() {
  console.log("ReturnPick sourcing recovery diagnosis");
  console.log("=".repeat(44));
  console.log("secret values: never printed");

  const supabaseUrl = envValue("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = envValue("SUPABASE_SERVICE_ROLE_KEY");
  const coupangReady = hasEnv("COUPANG_ACCESS_KEY") && hasEnv("COUPANG_SECRET_KEY") && hasEnv("COUPANG_PARTNER_ID");
  const naverReady = hasEnv("NAVER_CLIENT_ID") && hasEnv("NAVER_CLIENT_SECRET");

  add(coupangReady ? "PASS" : "WARN", "Coupang API env", coupangReady ? "all three env names have values" : "optional automation values are missing");
  add(naverReady ? "PASS" : "WARN", "Naver API env", naverReady ? "client id and secret have values" : "optional price-comparison values are missing");
  if (!coupangReady) action("Manual product-level Partners links can operate now; add the Coupang API values after final approval to enable automatic sourcing.");
  if (!naverReady) action("Add the Naver API values when you want verified lowest-price comparison; they do not block Coupang sourcing or site publishing.");

  const keywordLimit = envValue("SOURCING_KEYWORD_LIMIT");
  if (keywordLimit) {
    const parsed = Number(keywordLimit);
    if (!Number.isFinite(parsed) || parsed < 1) {
      add("FAIL", "SOURCING_KEYWORD_LIMIT", "must be a positive integer or blank");
    } else if (parsed < 6) {
      add("WARN", "SOURCING_KEYWORD_LIMIT", `${parsed} may be too low for first launch`);
      action("Use blank or at least 6-10 keywords for the first live sourcing pass.");
    } else {
      add("PASS", "SOURCING_KEYWORD_LIMIT", `${parsed}`);
    }
  } else {
    add("PASS", "SOURCING_KEYWORD_LIMIT", "blank; full active keyword rotation allowed");
  }

  const enrichmentConcurrency = envValue("SOURCING_ENRICHMENT_CONCURRENCY");
  if (enrichmentConcurrency) {
    const parsed = Number(enrichmentConcurrency);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) {
      add("FAIL", "SOURCING_ENRICHMENT_CONCURRENCY", "must be an integer from 1 to 4 or blank");
    } else {
      add("PASS", "SOURCING_ENRICHMENT_CONCURRENCY", `${parsed} concurrent product enrichments`);
    }
  } else {
    add("PASS", "SOURCING_ENRICHMENT_CONCURRENCY", "blank; sourcing defaults to 2 concurrent product enrichments");
  }

  const affiliateBackfillLimit = envValue("AFFILIATE_BACKFILL_LIMIT");
  if (affiliateBackfillLimit) {
    const parsed = Number(affiliateBackfillLimit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
      add("FAIL", "AFFILIATE_BACKFILL_LIMIT", "must be an integer from 1 to 20 or blank");
    } else {
      add("PASS", "AFFILIATE_BACKFILL_LIMIT", `${parsed} product links per run`);
    }
  } else {
    add("PASS", "AFFILIATE_BACKFILL_LIMIT", "blank; scheduler defaults to 10 product links per run");
  }

  if (envValue("CRON_USE_MOCK_FALLBACK") === "true") {
    add("WARN", "CRON_USE_MOCK_FALLBACK", "true");
    action("Set CRON_USE_MOCK_FALLBACK=false for production after API keys are approved.");
  } else {
    add("PASS", "CRON_USE_MOCK_FALLBACK", envValue("CRON_USE_MOCK_FALLBACK") || "not set; production code defaults to real-source mode after API keys");
  }

  if (envValue("PUBLIC_WEB_CRAWL_ENABLED") === "true") {
    add("WARN", "PUBLIC_WEB_CRAWL_ENABLED", "enabled; run npm run public-web:check before launch");
    action("Run npm run public-web:check and fix allowlist/template/robots failures before first launch.");
  } else {
    add("PASS", "PUBLIC_WEB_CRAWL_ENABLED", "disabled");
  }

  if (!supabaseUrl || !serviceRoleKey) {
    add("WARN", "Supabase live diagnosis", "skipped because NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
    action("After Vercel env values are filled, run npm run env:vercel:launch, npm run schema:production, then npm run sourcing:diagnose.");
    printResults();
    return;
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  await inspectKeywords(client);
  await inspectLatestRun(client);
  await inspectProductVisibility(client);
  printResults();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
