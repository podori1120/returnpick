import { listProducts, listTelegramLogs } from "@/lib/dataStore";
import { getDiscountRate } from "@/lib/dealIntelligence";
import { getApiReadinessSummary, type ApiReadinessSummary } from "@/lib/apiReadiness";
import { isCapabilityReady } from "@/lib/launchCapabilityPolicy";
import { getFirstLaunchConfirmation } from "@/lib/launchState";
import { isPublicDealReady } from "@/lib/publicDeal";
import { getLatestScore } from "@/lib/scoring";
import { runSourcing } from "@/lib/sourcing";
import { getNextSourcingKeywordOffset, getRunNextKeywordOffset } from "@/lib/sourcingCursor";
import { hasSupabaseConfig } from "@/lib/supabase";
import { sendTelegramForProduct } from "@/lib/telegram";
import { backfillCoupangAffiliateLinks } from "@/lib/affiliateLinkBackfill";

export function getScheduledMockFallback() {
  const value = process.env.CRON_USE_MOCK_FALLBACK;
  if (value === "true") return true;
  if (value === "false") return false;
  return process.env.NODE_ENV !== "production";
}

function positiveIntegerFromEnv(name: string) {
  const parsed = Math.floor(Number(process.env[name]));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getScheduledSourcingKeywordLimit() {
  return positiveIntegerFromEnv("SOURCING_KEYWORD_LIMIT");
}

export function getScheduledSourcingTimeBudgetMs() {
  return positiveIntegerFromEnv("SOURCING_TIME_BUDGET_MS") ?? 52000;
}

export function getScheduledAffiliateBackfillLimit() {
  return Math.min(20, positiveIntegerFromEnv("AFFILIATE_BACKFILL_LIMIT") ?? 10);
}

export type SchedulerBlockingItem = {
  id: string;
  label: string;
  state: string;
  missing_env: string[];
  message: string;
  next_action: string;
};

export type SchedulerOperatorAction = {
  code: string;
  label: string;
  target_anchor: string;
  message: string;
  next_action: string;
};

export function getSchedulerBlockingItems(readiness: ApiReadinessSummary, itemIds = readiness.blockingItemIds): SchedulerBlockingItem[] {
  const blockingIds = new Set(itemIds);
  return readiness.items
    .filter((item) => blockingIds.has(item.id))
    .map((item) => ({
      id: item.id,
      label: item.label,
      state: item.state,
      missing_env: item.missingEnv,
      message: item.message,
      next_action: item.nextAction
    }));
}

export function getSchedulerOperatorAction(skippedReason: string | null, readiness: ApiReadinessSummary): SchedulerOperatorAction | null {
  if (skippedReason === "COUPANG_API_NOT_READY") {
    const coupang = readiness.items.find((item) => item.id === "coupang");
    return {
      code: "CONFIGURE_COUPANG_API",
      label: "쿠팡 API 자동 수집 연동",
      target_anchor: "admin-api-readiness",
      message: coupang?.message ?? "쿠팡 API 권한이 아직 준비되지 않았습니다.",
      next_action: coupang?.nextAction ?? "상품별 파트너스 링크는 수동으로 운영하고, API 권한이 열리면 쿠팡 API 키를 등록하세요."
    };
  }

  if (skippedReason === "TELEGRAM_NOT_READY") {
    const telegram = readiness.items.find((item) => item.id === "telegram");
    return {
      code: "CONFIGURE_TELEGRAM",
      label: "텔레그램 발송 연동",
      target_anchor: "admin-api-readiness",
      message: telegram?.message ?? "텔레그램 발송 환경변수가 아직 준비되지 않았습니다.",
      next_action: telegram?.nextAction ?? "TELEGRAM_BOT_TOKEN과 TELEGRAM_CHAT_ID를 설정한 뒤 연결 테스트를 실행하세요."
    };
  }

  if (skippedReason === "FIRST_LAUNCH_NOT_CONFIRMED") {
    return {
      code: "RUN_FIRST_LAUNCH",
      label: "승인 후 첫 가동 실행",
      target_anchor: "admin-first-launch",
      message: "운영 환경변수는 준비됐지만 첫 가동 확인 기록이 아직 없습니다.",
      next_action: "관리자 페이지의 승인 후 첫 가동 실행에서 표준 런칭을 실행해 실제 연결 테스트, 첫 후보 수집, 파트너스 링크 보강, 네이버 가격 보강을 완료하세요."
    };
  }

  if (skippedReason === "LAUNCH_NOT_READY") {
    const firstBlockingItem = getSchedulerBlockingItems(readiness)[0];
    if (!firstBlockingItem) return null;
    return {
      code: "FIX_LAUNCH_BLOCKER",
      label: `${firstBlockingItem.label} 보완`,
      target_anchor: "admin-api-readiness",
      message: firstBlockingItem.message,
      next_action: firstBlockingItem.next_action
    };
  }

  return null;
}

export async function getScheduledAutomationGate() {
  const readiness = getApiReadinessSummary();
  if (process.env.NODE_ENV === "production" && !readiness.launchReady) {
    return {
      readiness,
      shouldGate: true,
      skippedReason: "LAUNCH_NOT_READY",
      firstLaunchConfirmed: false,
      launchConfirmation: null
    };
  }

  const launchConfirmation = process.env.NODE_ENV === "production" ? await getFirstLaunchConfirmation() : null;
  if (process.env.NODE_ENV === "production" && !launchConfirmation) {
    return {
      readiness,
      shouldGate: true,
      skippedReason: "FIRST_LAUNCH_NOT_CONFIRMED",
      firstLaunchConfirmed: false,
      launchConfirmation: null
    };
  }

  return {
    readiness,
    shouldGate: false,
    skippedReason: null,
    firstLaunchConfirmed: process.env.NODE_ENV !== "production" || Boolean(launchConfirmation),
    launchConfirmation
  };
}

export async function runScheduledSourcing() {
  const useMockFallback = getScheduledMockFallback();
  const keywordLimit = getScheduledSourcingKeywordLimit();
  const timeBudgetMs = getScheduledSourcingTimeBudgetMs();
  const gate = await getScheduledAutomationGate();
  if (gate.shouldGate) {
    return {
      type: "sourcing",
      status: "not_ready",
      skipped_reason: gate.skippedReason,
      readiness_mode: gate.readiness.mode,
      blocking_item_ids: gate.readiness.blockingItemIds,
      blocking_items: getSchedulerBlockingItems(gate.readiness),
      blocking_env: gate.readiness.blockingEnv,
      operator_action: getSchedulerOperatorAction(gate.skippedReason, gate.readiness),
      first_launch_confirmed: gate.firstLaunchConfirmed,
      launch_confirmation_id: gate.launchConfirmation?.id ?? null,
      use_mock_fallback: useMockFallback,
      keyword_limit: keywordLimit,
      keyword_offset: null,
      next_keyword_offset: null,
      time_budget_ms: timeBudgetMs,
      persistent_storage: hasSupabaseConfig(),
      run_id: null,
      keyword_count: 0,
      found_count: 0,
      inserted_count: 0,
      updated_count: 0,
      error_count: 0
    };
  }

  const publicWebOnly =
    !gate.readiness.apiKeysReady &&
    gate.readiness.runtimeReady &&
    isCapabilityReady(gate.readiness.items, "public_web");

  if (!gate.readiness.apiKeysReady && !publicWebOnly) {
    return {
      type: "sourcing",
      status: "waiting_for_api",
      skipped_reason: "COUPANG_API_NOT_READY",
      readiness_mode: gate.readiness.mode,
      blocking_item_ids: [],
      blocking_items: [],
      blocking_env: [],
      operator_action: getSchedulerOperatorAction("COUPANG_API_NOT_READY", gate.readiness),
      first_launch_confirmed: gate.firstLaunchConfirmed,
      launch_confirmation_id: gate.launchConfirmation?.id ?? null,
      use_mock_fallback: false,
      keyword_limit: keywordLimit,
      keyword_offset: null,
      next_keyword_offset: null,
      time_budget_ms: timeBudgetMs,
      persistent_storage: hasSupabaseConfig(),
      run_id: null,
      keyword_count: 0,
      found_count: 0,
      inserted_count: 0,
      updated_count: 0,
      error_count: 0
    };
  }

  const keywordOffset = await getNextSourcingKeywordOffset();
  const run = await runSourcing({
    useMockFallback: publicWebOnly ? false : useMockFallback,
    sourceMode: publicWebOnly ? "public_web_only" : "auto",
    keywordLimit,
    keywordOffset,
    timeBudgetMs
  });

  return {
    type: "sourcing",
    status: run.status,
    first_launch_confirmed: gate.firstLaunchConfirmed,
    launch_confirmation_id: gate.launchConfirmation?.id ?? null,
    use_mock_fallback: publicWebOnly ? false : useMockFallback,
    source_mode: publicWebOnly ? "public_web_only" : "auto",
    keyword_limit: keywordLimit,
    keyword_offset: keywordOffset,
    next_keyword_offset: getRunNextKeywordOffset(run),
    time_budget_ms: timeBudgetMs,
    persistent_storage: hasSupabaseConfig(),
    run_id: run.id,
    keyword_count: run.keyword_count,
    found_count: run.found_count,
    inserted_count: run.inserted_count,
    updated_count: run.updated_count,
    error_count: run.error_count
  };
}

export async function runScheduledAffiliateBackfill() {
  const limit = getScheduledAffiliateBackfillLimit();
  const timeBudgetMs = 52_000;
  const gate = await getScheduledAutomationGate();
  if (gate.shouldGate) {
    return {
      type: "affiliate_backfill",
      status: "not_ready",
      skipped_reason: gate.skippedReason,
      readiness_mode: gate.readiness.mode,
      blocking_item_ids: gate.readiness.blockingItemIds,
      blocking_items: getSchedulerBlockingItems(gate.readiness),
      blocking_env: gate.readiness.blockingEnv,
      operator_action: getSchedulerOperatorAction(gate.skippedReason, gate.readiness),
      first_launch_confirmed: gate.firstLaunchConfirmed,
      launch_confirmation_id: gate.launchConfirmation?.id ?? null,
      limit,
      persistent_storage: hasSupabaseConfig(),
      scanned_count: 0,
      updated_count: 0,
      skipped_count: 0,
      error_count: 0,
      dry_run: false,
      time_budget_ms: timeBudgetMs,
      items: []
    };
  }

  if (!gate.readiness.apiKeysReady) {
    return {
      type: "affiliate_backfill",
      status: "waiting_for_api",
      skipped_reason: "COUPANG_API_NOT_READY",
      readiness_mode: gate.readiness.mode,
      blocking_item_ids: [],
      blocking_items: [],
      blocking_env: [],
      operator_action: getSchedulerOperatorAction("COUPANG_API_NOT_READY", gate.readiness),
      first_launch_confirmed: gate.firstLaunchConfirmed,
      launch_confirmation_id: gate.launchConfirmation?.id ?? null,
      limit,
      persistent_storage: hasSupabaseConfig(),
      scanned_count: 0,
      updated_count: 0,
      skipped_count: 0,
      error_count: 0,
      dry_run: false,
      time_budget_ms: timeBudgetMs,
      items: []
    };
  }

  const result = await backfillCoupangAffiliateLinks({ limit, dryRun: false, timeBudgetMs });
  return {
    type: "affiliate_backfill",
    ...result,
    first_launch_confirmed: gate.firstLaunchConfirmed,
    launch_confirmation_id: gate.launchConfirmation?.id ?? null,
    limit,
    time_budget_ms: timeBudgetMs,
    persistent_storage: hasSupabaseConfig()
  };
}

export async function runScheduledTelegramDigest(limit = 1) {
  const gate = await getScheduledAutomationGate();
  if (gate.shouldGate) {
    return {
      type: "telegram_digest",
      status: "not_ready",
      candidate_count: 0,
      sent_count: 0,
      skipped_reason: gate.skippedReason,
      readiness_mode: gate.readiness.mode,
      blocking_item_ids: gate.readiness.blockingItemIds,
      blocking_items: getSchedulerBlockingItems(gate.readiness),
      blocking_env: gate.readiness.blockingEnv,
      operator_action: getSchedulerOperatorAction(gate.skippedReason, gate.readiness),
      first_launch_confirmed: gate.firstLaunchConfirmed,
      launch_confirmation_id: gate.launchConfirmation?.id ?? null,
      error_count: 0,
      results: []
    };
  }

  const telegramReady = isCapabilityReady(gate.readiness.items, "telegram");
  if (!telegramReady) {
    const telegramBlockingItems = getSchedulerBlockingItems(gate.readiness, ["telegram"]);
    return {
      type: "telegram_digest",
      status: "not_ready",
      candidate_count: 0,
      sent_count: 0,
      skipped_reason: "TELEGRAM_NOT_READY",
      readiness_mode: gate.readiness.mode,
      blocking_item_ids: ["telegram"],
      blocking_items: telegramBlockingItems,
      blocking_env: telegramBlockingItems.flatMap((item) => item.missing_env),
      operator_action: getSchedulerOperatorAction("TELEGRAM_NOT_READY", gate.readiness),
      first_launch_confirmed: gate.firstLaunchConfirmed,
      launch_confirmation_id: gate.launchConfirmation?.id ?? null,
      error_count: 0,
      results: []
    };
  }

  const logs = await listTelegramLogs(2000);
  const sentProductIds = new Set(logs.filter((log) => log.status === "sent" && log.product_id).map((log) => log.product_id as string));
  const products = await listProducts({ published: true });
  const candidates = products
    .filter(isPublicDealReady)
    .filter((product) => product.stock_count !== 0)
    .filter((product) => !sentProductIds.has(product.id))
    .filter((product) => (getLatestScore(product)?.total_score ?? 0) >= 75)
    .sort((a, b) => {
      const scoreGap = (getLatestScore(b)?.total_score ?? 0) - (getLatestScore(a)?.total_score ?? 0);
      if (scoreGap) return scoreGap;
      return (getDiscountRate(b) ?? 0) - (getDiscountRate(a) ?? 0);
    })
    .slice(0, Math.max(1, Math.min(3, limit)));

  const results = [];
  for (const product of candidates) {
    try {
      const result = await sendTelegramForProduct(product.id);
      results.push({
        product_id: product.id,
        title: product.title,
        status: result.status
      });
    } catch (error) {
      results.push({
        product_id: product.id,
        title: product.title,
        status: "error",
        error: error instanceof Error ? error.message : "UNKNOWN_TELEGRAM_ERROR"
      });
    }
  }

  const sentCount = results.filter((item) => item.status === "sent").length;
  const errorCount = results.filter((item) => item.status === "error" || item.status === "API_NOT_CONFIGURED").length;
  const status = !candidates.length ? "skipped" : errorCount > 0 ? (sentCount > 0 ? "partial" : "error") : "ok";

  return {
    type: "telegram_digest",
    status,
    first_launch_confirmed: gate.firstLaunchConfirmed,
    launch_confirmation_id: gate.launchConfirmation?.id ?? null,
    candidate_count: candidates.length,
    sent_count: sentCount,
    error_count: errorCount,
    skipped_reason: candidates.length ? null : "NO_UNSENT_PUBLIC_CUSTOMER_READY_DEALS",
    results
  };
}
