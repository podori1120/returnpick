import { listProducts, listSourcingRuns, listTelegramLogs } from "@/lib/dataStore";
import { isUsableAffiliateUrl } from "@/lib/coupangLink";
import { getDiscountRate } from "@/lib/dealIntelligence";
import { getApiReadinessSummary } from "@/lib/apiReadiness";
import { getCustomerPublishReadiness } from "@/lib/quality";
import { isPublicDealReady } from "@/lib/publicDeal";
import { getLatestScore } from "@/lib/scoring";
import { getScheduledAutomationGate, getScheduledMockFallback, getSchedulerBlockingItems, getSchedulerOperatorAction } from "@/lib/scheduler";
import { isSourcingExecutionRun } from "@/lib/sourcingRunKinds";
import { getRunNextKeywordOffset, numberFromRunLog } from "@/lib/sourcingCursor";
import { hasSupabaseConfig } from "@/lib/supabase";
import type { ProductWithScore, SourcingRun } from "@/lib/types";

type SchedulerHealth = "healthy" | "stale" | "error" | "never_run";

function minutesSince(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.round((Date.now() - timestamp) / 60000));
}

function getRunFinishedAt(run: SourcingRun | null) {
  return run?.finished_at ?? run?.started_at ?? null;
}

function getSourcingHealth(latestRun: SourcingRun | null): SchedulerHealth {
  if (!latestRun) return "never_run";
  if (latestRun.status === "error") return "error";
  const age = minutesSince(getRunFinishedAt(latestRun));
  if (age == null) return "never_run";
  return age > 90 ? "stale" : "healthy";
}

function productIssueLabels(product: ProductWithScore) {
  const issues = [];
  const readiness = getCustomerPublishReadiness(product);
  if (!isUsableAffiliateUrl(product.affiliate_url)) issues.push("제휴 URL 필요");
  for (const blocker of readiness.blockers) {
    if (!issues.includes(blocker)) issues.push(blocker);
  }
  if (!product.return_price) issues.push("반품가 확인");
  if (["확인필요", "알수없음"].includes(product.condition_grade)) issues.push("반품등급 확인");
  if (product.stock_count === 0) issues.push("품절 처리");
  if ((getLatestScore(product)?.risk_flags.length ?? 0) > 2) issues.push("위험 플래그 재검토");
  return issues;
}

function scoreProductForQueue(product: ProductWithScore) {
  const score = getLatestScore(product)?.total_score ?? 0;
  const issues = productIssueLabels(product).length;
  const statusBoost = product.sourcing_status === "needs_review" ? 20 : product.sourcing_status === "approved" ? 12 : 0;
  return score + statusBoost + issues * 6;
}

export async function getSchedulerInsights() {
  const [runs, logs, allProducts] = await Promise.all([listSourcingRuns(20), listTelegramLogs(500), listProducts()]);
  const readiness = getApiReadinessSummary();
  const automationGate = await getScheduledAutomationGate();
  const sourcingRuns = runs.filter(isSourcingExecutionRun);
  const latestRun = sourcingRuns[0] ?? null;
  const sourcingAgeMinutes = minutesSince(getRunFinishedAt(latestRun));
  const health = getSourcingHealth(latestRun);
  const now = Date.now();
  const sentProductIds = new Set(logs.filter((log) => log.status === "sent" && log.product_id).map((log) => log.product_id as string));
  const sentLast24h = logs.filter((log) => log.status === "sent" && now - new Date(log.created_at).getTime() <= 24 * 60 * 60 * 1000).length;
  const published = allProducts.filter((product) => product.is_published && product.sourcing_status === "published");
  const reviewQueue = allProducts.filter((product) => ["needs_review", "approved"].includes(product.sourcing_status));
  const missingAffiliate = published.filter((product) => !isUsableAffiliateUrl(product.affiliate_url));
  const qualityBlockedPublished = published.filter((product) => !isPublicDealReady(product));
  const stalePublished = published.filter((product) => {
    const snapshotAge = minutesSince(product.latest_snapshot?.observed_at ?? product.snapshots?.[0]?.observed_at);
    return snapshotAge == null || snapshotAge > 24 * 60;
  });
  const telegramCandidates = published
    .filter(isPublicDealReady)
    .filter((product) => product.stock_count !== 0)
    .filter((product) => !sentProductIds.has(product.id))
    .filter((product) => (getLatestScore(product)?.total_score ?? 0) >= 75)
    .sort((a, b) => {
      const scoreGap = (getLatestScore(b)?.total_score ?? 0) - (getLatestScore(a)?.total_score ?? 0);
      if (scoreGap) return scoreGap;
      return (getDiscountRate(b) ?? 0) - (getDiscountRate(a) ?? 0);
    })
    .slice(0, 8)
    .map((product) => ({
      id: product.id,
      title: product.title,
      category: product.category,
      score: getLatestScore(product)?.total_score ?? 0,
      discount_rate: getDiscountRate(product),
      stock_count: product.stock_count
    }));

  const actionQueue = [...reviewQueue, ...missingAffiliate, ...qualityBlockedPublished, ...stalePublished]
    .filter((product, index, array) => array.findIndex((item) => item.id === product.id) === index)
    .sort((a, b) => scoreProductForQueue(b) - scoreProductForQueue(a))
    .slice(0, 10)
    .map((product) => ({
      id: product.id,
      title: product.title,
      category: product.category,
      status: product.sourcing_status,
      score: getLatestScore(product)?.total_score ?? 0,
      issues: productIssueLabels(product),
      affiliate_ready: isUsableAffiliateUrl(product.affiliate_url),
      snapshot_age_minutes: minutesSince(product.latest_snapshot?.observed_at ?? product.snapshots?.[0]?.observed_at)
    }));

  return {
    sourcing: {
      health,
      mock_fallback_enabled: getScheduledMockFallback(),
      persistent_storage: hasSupabaseConfig(),
      launch_ready: readiness.launchReady,
      scheduler_ready: !automationGate.shouldGate,
      first_launch_confirmed: automationGate.firstLaunchConfirmed,
      automation_block_reason: automationGate.skippedReason,
      launch_confirmation: automationGate.launchConfirmation
        ? {
            id: automationGate.launchConfirmation.id,
            confirmed_at: automationGate.launchConfirmation.finished_at ?? automationGate.launchConfirmation.started_at
          }
        : null,
      readiness_mode: readiness.mode,
      blocking_item_ids: readiness.blockingItemIds,
      blocking_items: getSchedulerBlockingItems(readiness),
      operator_action: getSchedulerOperatorAction(automationGate.skippedReason, readiness),
      latest_run: latestRun
        ? {
            id: latestRun.id,
            status: latestRun.status,
            started_at: latestRun.started_at,
            finished_at: latestRun.finished_at,
            found_count: latestRun.found_count,
            inserted_count: latestRun.inserted_count,
            updated_count: latestRun.updated_count,
            error_count: latestRun.error_count,
            keyword_start_offset: numberFromRunLog(latestRun.log_json?.keyword_start_offset),
            next_keyword_offset: getRunNextKeywordOffset(latestRun),
            active_keyword_count: numberFromRunLog(latestRun.log_json?.active_keyword_count)
          }
        : null,
      age_minutes: sourcingAgeMinutes,
      expected_interval_minutes: 60,
      stale_after_minutes: 90,
      recent_runs: sourcingRuns.slice(0, 6).map((run) => ({
        id: run.id,
        status: run.status,
        started_at: run.started_at,
        found_count: run.found_count,
        inserted_count: run.inserted_count,
        updated_count: run.updated_count,
        error_count: run.error_count,
        next_keyword_offset: getRunNextKeywordOffset(run)
      }))
    },
    telegram: {
      configured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      sent_last_24h: sentLast24h,
      unsent_candidate_count: telegramCandidates.length,
      candidates: telegramCandidates
    },
    queues: {
      needs_review_count: reviewQueue.length,
      missing_affiliate_count: missingAffiliate.length,
      quality_blocked_published_count: qualityBlockedPublished.length,
      stale_published_count: stalePublished.length,
      action_queue: actionQueue
    }
  };
}
