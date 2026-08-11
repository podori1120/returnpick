import { NextResponse } from "next/server";
import { backfillCoupangAffiliateLinks } from "@/lib/affiliateLinkBackfill";
import { getApiReadinessSummary, runApiConnectionChecks, type ApiConnectionCheck, type ApiReadinessSummary } from "@/lib/apiReadiness";
import { listProducts } from "@/lib/dataStore";
import { getNextSourcingKeywordOffset } from "@/lib/sourcingCursor";
import { isUsableAffiliateUrl } from "@/lib/coupangLink";
import { hasBlockingLaunchError } from "@/lib/launchCapabilityPolicy";
import { markFirstLaunchConfirmed } from "@/lib/launchState";
import { backfillNaverLowestPrices } from "@/lib/naverPriceBackfill";
import { getNaverPriceTrust } from "@/lib/naverPriceTrust";
import { isPublicDealReady } from "@/lib/publicDeal";
import { isSourcingRunConflict, runSourcing } from "@/lib/sourcing";
import { requireAdmin, requirePersistentStorage } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const LAUNCH_RESPONSE_BUDGET_MS = 52_000;
const MIN_ENRICHMENT_BUDGET_MS = 1_000;

function remainingLaunchBudget(startedAt: number) {
  return Math.max(0, LAUNCH_RESPONSE_BUDGET_MS - (Date.now() - startedAt));
}

function enrichmentBudget(startedAt: number, ceilingMs: number, reserveMs: number) {
  const remaining = remainingLaunchBudget(startedAt) - reserveMs;
  return remaining >= MIN_ENRICHMENT_BUDGET_MS ? Math.min(ceilingMs, remaining) : 0;
}

function launchErrorResponse(error: unknown) {
  const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_LAUNCH_ERROR";
  return NextResponse.json({ error: "LAUNCH_RUN_FAILED", message }, { status: 500 });
}

type LaunchStep = {
  id: string;
  label: string;
  status: "ok" | "skipped" | "error";
  message: string;
  detail?: unknown;
  blocking?: boolean;
};

type ProductSummary = {
  total: number;
  needs_review: number;
  published: number;
  affiliate_ready: number;
  published_affiliate_ready: number;
  published_public_ready: number;
  missing_affiliate: number;
  missing_naver_lowest_price: number;
};

function recordFromUnknown(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getReadinessBlockingActions(readiness: ApiReadinessSummary) {
  const itemById = new Map(readiness.items.map((item) => [item.id, item]));
  return readiness.blockingItemIds
    .map((id) => itemById.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      id: item.id,
      label: item.label,
      message: item.message,
      next_action: item.nextAction,
      missing_or_invalid_env: item.missingEnv
    }));
}

function getConnectionFailureActions(checks: ApiConnectionCheck[]) {
  return checks.map((check) => {
    const detail = recordFromUnknown(check.detail);
    const operatorNextAction = detail?.operator_next_action ?? detail?.next_action;
    return {
      id: check.id,
      label: check.label,
      message: check.message,
      next_action:
        typeof operatorNextAction === "string" && operatorNextAction.trim()
          ? operatorNextAction
          : "해당 연결 테스트 카드의 메시지와 환경변수 값을 확인한 뒤 수정하고 다시 실행하세요."
    };
  });
}

function positiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

async function productSummary(): Promise<ProductSummary> {
  const products = await listProducts();
  const published = products.filter((product) => product.is_published && product.sourcing_status === "published");
  const affiliateReady = products.filter((product) => isUsableAffiliateUrl(product.affiliate_url));
  const publicReady = published.filter(isPublicDealReady);
  return {
    total: products.length,
    needs_review: products.filter((product) => product.sourcing_status === "needs_review").length,
    published: published.length,
    affiliate_ready: affiliateReady.length,
    published_affiliate_ready: publicReady.length,
    published_public_ready: publicReady.length,
    missing_affiliate: products.filter((product) => !isUsableAffiliateUrl(product.affiliate_url)).length,
    missing_naver_lowest_price: products.filter((product) => getNaverPriceTrust(product).trustedPrice == null).length
  };
}

function deltaSummary(before: ProductSummary, after: ProductSummary) {
  return {
    total_added: after.total - before.total,
    needs_review_delta: after.needs_review - before.needs_review,
    affiliate_ready_added: after.affiliate_ready - before.affiliate_ready,
    published_affiliate_ready_delta: after.published_affiliate_ready - before.published_affiliate_ready,
    missing_affiliate_reduced: before.missing_affiliate - after.missing_affiliate,
    naver_missing_reduced: before.missing_naver_lowest_price - after.missing_naver_lowest_price
  };
}

type LaunchProgressSignal = {
  sourcing_found_count: number;
  sourcing_inserted_count: number;
  sourcing_updated_count: number;
  affiliate_updated_count: number;
  naver_updated_count: number;
};

type LaunchRecoveryAction = {
  id: string;
  label: string;
  target_anchor: string;
  next_action: string;
};

function getLaunchRecoveryActions(before: ProductSummary, after: ProductSummary, progress: LaunchProgressSignal): LaunchRecoveryAction[] {
  const actions: LaunchRecoveryAction[] = [];

  if (after.needs_review > 0) {
    actions.push({
      id: "review_existing_candidates",
      label: "검토 대기 후보 확인",
      target_anchor: "admin-candidate-review",
      next_action: `검토 대기 후보 ${after.needs_review.toLocaleString("ko-KR")}건이 있으므로 먼저 반품가·등급·링크를 확인해 게시 가능한 상품부터 승인하세요.`
    });
  }

  if (after.missing_affiliate > 0 && after.total > 0) {
    actions.push({
      id: "repair_affiliate_links",
      label: "상품별 파트너스 링크 보강",
      target_anchor: "admin-affiliate-links",
      next_action: `상품별 쿠팡 파트너스 링크가 비어 있거나 약한 후보 ${after.missing_affiliate.toLocaleString("ko-KR")}건을 링크 보강 큐에서 먼저 처리하세요.`
    });
  }

  if (after.missing_naver_lowest_price > 0 && after.total > 0) {
    actions.push({
      id: "repair_naver_prices",
      label: "네이버 최저가 보강",
      target_anchor: "admin-price-backfill",
      next_action: `동일 상품으로 검증된 네이버 최저가가 없는 후보 ${after.missing_naver_lowest_price.toLocaleString("ko-KR")}건을 가격 보강 패널에서 다시 검색하세요.`
    });
  }

  const noSourcingSignal =
    progress.sourcing_found_count === 0 &&
    progress.sourcing_inserted_count === 0 &&
    progress.sourcing_updated_count === 0 &&
    before.total === after.total;

  if (noSourcingSignal) {
    actions.push({
      id: "widen_sourcing",
      label: "키워드와 가격 조건 확대",
      target_anchor: "admin-sourcing-runner",
      next_action: "넉넉한 런칭으로 다시 실행하거나 소싱 키워드의 최소 할인율·가격 범위를 완화한 뒤 목업 없이 후보 수집을 재시도하세요."
    });
  }

  if (!actions.length) {
    actions.push({
      id: "inspect_sourcing_logs",
      label: "소싱 진단 확인",
      target_anchor: "admin-sourcing-runner",
      next_action: "최근 소싱 실행의 공급원별 진단과 가격 필터 제외 수를 확인한 뒤 키워드 조건 또는 API 설정을 조정하세요."
    });
  }

  return actions.slice(0, 4);
}

function launchRecoveryNextAction(actions: LaunchRecoveryAction[]) {
  return actions.map((action, index) => `${index + 1}. ${action.next_action}`).join(" ");
}

function getLaunchDataSignal(
  before: ProductSummary,
  after: ProductSummary,
  progress: LaunchProgressSignal,
  options: { manualMode?: boolean; approvalLinkReady?: boolean } = {}
) {
  const delta = deltaSummary(before, after);
  const recoveryActions = getLaunchRecoveryActions(before, after, progress);
  const currentLaunchProgress =
    progress.sourcing_found_count > 0 ||
    progress.sourcing_inserted_count > 0 ||
    progress.sourcing_updated_count > 0 ||
    progress.affiliate_updated_count > 0 ||
    progress.naver_updated_count > 0 ||
    delta.total_added > 0 ||
    delta.needs_review_delta > 0 ||
    delta.affiliate_ready_added > 0 ||
    delta.published_affiliate_ready_delta > 0 ||
    delta.missing_affiliate_reduced > 0 ||
    delta.naver_missing_reduced > 0;
  const existingPublicReadyInventory = after.published_public_ready > 0;
  const manualLaunchSurface = Boolean(options.manualMode && options.approvalLinkReady);
  return {
    ok: currentLaunchProgress || existingPublicReadyInventory || manualLaunchSurface,
    current_launch_progress: currentLaunchProgress,
    existing_public_affiliate_ready: existingPublicReadyInventory,
    existing_public_customer_ready: existingPublicReadyInventory,
    manual_launch_surface: manualLaunchSurface,
    progress,
    delta,
    recovery_actions: recoveryActions,
    operator_next_action: launchRecoveryNextAction(recoveryActions)
  };
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const storageUnavailable = requirePersistentStorage();
  if (storageUnavailable) return storageUnavailable;

  try {
  const launchStartedAt = Date.now();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const sourcingKeywordLimit = positiveInteger(body.sourcingKeywordLimit, 6, 12);
  const affiliateLimit = positiveInteger(body.affiliateLimit, 8, 20);
  const priceLimit = positiveInteger(body.priceLimit, 5, 12);
  const sourcingTimeBudgetMs = positiveInteger(body.sourcingTimeBudgetMs, 22000, 30000);
  const steps: LaunchStep[] = [];
  const readiness = getApiReadinessSummary();
  const beforeSummary = await productSummary();
  const manualMode = !readiness.apiKeysReady;
  const approvalLinkReady = readiness.items.some((item) => item.id === "approval_link" && item.state === "ready");
  const progressSignal: LaunchProgressSignal = {
    sourcing_found_count: 0,
    sourcing_inserted_count: 0,
    sourcing_updated_count: 0,
    affiliate_updated_count: 0,
    naver_updated_count: 0
  };

  if (!readiness.launchReady) {
    const blockingItems = getReadinessBlockingActions(readiness);
    steps.push({
      id: "preflight",
      label: "운영 준비 확인",
      status: "skipped",
      message: `운영 필수 설정이 아직 남아 있습니다: ${blockingItems.map((item) => item.label).join(", ") || "연결 테스트 필요"}`,
      detail: {
        mode: readiness.mode,
        blockingItemIds: readiness.blockingItemIds,
        blockingEnv: readiness.blockingEnv,
        blocking_items: blockingItems
      }
    });
    return NextResponse.json({
      status: "not_ready",
      readiness: {
        ...readiness,
        blockingItems
      },
      steps,
      before_summary: beforeSummary,
      summary: beforeSummary,
      delta_summary: deltaSummary(beforeSummary, beforeSummary)
    });
  }

  steps.push({
    id: "preflight",
    label: "운영 준비 확인",
    status: "ok",
    message: manualMode
      ? "수동 제휴 링크 출시 필수 설정이 준비되어 첫 가동을 시작합니다. 쿠팡 API 자동 수집은 권한이 열릴 때까지 대기합니다."
      : "운영 필수 환경변수가 모두 입력되어 첫 가동을 시작합니다.",
    detail: { mode: readiness.mode }
  });

  const connectionChecks = await runApiConnectionChecks();
  const requiredConnectionCheckIds = readiness.requiredConnectionCheckIds;
  const connectionCheckById = new Map(connectionChecks.map((check) => [check.id, check]));
  const missingRequiredConnectionCheckIds = requiredConnectionCheckIds.filter((id) => !connectionCheckById.has(id));
  const missingRequiredConnectionChecks = missingRequiredConnectionCheckIds.map((id) => ({
    id,
    label: `MISSING_REQUIRED_CONNECTION_CHECK:${id}`,
    status: "error" as const,
    message: "필수 연결 테스트 카드가 응답에 포함되지 않았습니다."
  }));
  const failedConnectionChecks = [
    ...connectionChecks.filter((check) => requiredConnectionCheckIds.includes(check.id) && check.status !== "ok"),
    ...missingRequiredConnectionChecks
  ];
  if (failedConnectionChecks.length > 0) {
    const failedConnectionActions = getConnectionFailureActions(failedConnectionChecks);
    steps.push({
      id: "connection_checks",
      label: "실제 연결 테스트",
      status: "error",
      message: `첫 가동 전 연결 테스트 ${failedConnectionChecks.length}건이 통과하지 못했습니다: ${failedConnectionChecks.map((check) => check.label).join(", ")}`,
      detail: {
        failed_connection_checks: failedConnectionActions,
        checks: connectionChecks,
        missing_required_connection_check_ids: missingRequiredConnectionCheckIds
      }
    });
    return NextResponse.json({
      status: "not_ready",
      readiness: {
        ...getApiReadinessSummary(),
        failedConnectionChecks: failedConnectionActions
      },
      steps,
      before_summary: beforeSummary,
      summary: beforeSummary,
      delta_summary: deltaSummary(beforeSummary, beforeSummary)
    });
  }

  steps.push({
    id: "connection_checks",
    label: "실제 연결 테스트",
    status: "ok",
    message: `${manualMode ? "Supabase, 공개 승인 페이지와 Cron" : "쿠팡, Supabase, 공개 승인 페이지와 Cron"} 연결이 확인되었습니다. ${manualMode ? "상품별 파트너스 링크는 관리자 수동 등록으로 운영하고 쿠팡 API는 대기합니다." : "쿠팡 API 자동 수집과 링크 보강을 실행할 수 있습니다."} 네이버와 텔레그램은 설정된 경우 별도 기능으로 동작합니다.`,
    detail: {
      required_check_ids: requiredConnectionCheckIds,
      optional_check_ids: readiness.optionalConnectionCheckIds,
      checks: connectionChecks
    }
  });

  if (manualMode) {
    steps.push({
      id: "sourcing",
      label: "쿠팡 API 자동 후보 수집",
      status: "skipped",
      message: "쿠팡 API 권한이 없어 자동 후보 수집은 대기합니다. 관리자에서 상품별 파트너스 링크를 확인한 후보만 수동으로 게시할 수 있습니다.",
      detail: {
        skipped_reason: "COUPANG_API_NOT_READY",
        operator_next_action: "최종승인 후 쿠팡 API 키를 등록하면 자동 후보 수집과 딥링크 보강을 시작할 수 있습니다."
      },
      blocking: false
    });
  } else {
    try {
      const keywordOffset = await getNextSourcingKeywordOffset();
      const run = await runSourcing({
        useMockFallback: false,
        coordinateExecution: true,
        keywordLimit: sourcingKeywordLimit,
        keywordOffset,
        timeBudgetMs: sourcingTimeBudgetMs
      });
      progressSignal.sourcing_found_count = run.found_count;
      progressSignal.sourcing_inserted_count = run.inserted_count;
      progressSignal.sourcing_updated_count = run.updated_count;
      steps.push({
        id: "sourcing",
        label: "목업 없는 첫 후보 수집",
        status: run.status === "error" ? "error" : "ok",
        message: `키워드 ${run.keyword_count}개 처리, 후보 ${run.found_count}개 발견, 추가 ${run.inserted_count}개, 갱신 ${run.updated_count}개`,
        detail: run
      });
    } catch (error) {
      if (isSourcingRunConflict(error)) {
        steps.push({
          id: "sourcing",
          label: "목업 없는 첫 후보 수집",
          status: "skipped",
          message: "같은 소싱 모드의 짧은 실행 창에서 이미 작업이 시작되어 이번 소싱은 안전하게 건너뛰었습니다.",
          detail: {
            skipped_reason: "SOURCING_RUN_CONFLICT",
            conflicting_run_id: error.run.id,
            conflicting_run_status: error.run.status,
            execution_key: error.execution.executionKey,
            execution_window_start: error.execution.windowStart,
            execution_window_end: error.execution.windowEnd
          },
          blocking: false
        });
      } else {
        steps.push({
          id: "sourcing",
          label: "목업 없는 첫 후보 수집",
          status: "error",
          message: error instanceof Error ? error.message : "SOURCING_LAUNCH_FAILED"
        });
      }
    }
  }

  let summary = await productSummary();
  let launchDelta = deltaSummary(beforeSummary, summary);
  let launchDataSignal = getLaunchDataSignal(beforeSummary, summary, progressSignal, { manualMode, approvalLinkReady });
  let launchConfirmation = null;
  if (!hasBlockingLaunchError(steps) && !launchDataSignal.ok) {
    steps.push({
      id: "launch_data_signal",
      label: "첫 가동 데이터 신호 확인",
      status: "error",
      message: manualMode
        ? "수동 출시 화면은 준비됐지만 실제 공개 상품이 없습니다. 관리자에서 상품별 쿠팡 파트너스 링크를 등록하고 검수 후 게시하세요."
        : "실제 연결은 통과했지만 새 후보, 검토 대기, 파트너스 링크, 네이버 가격 보강, 고객공개 가능 상품 변화가 없습니다. 키워드 조건이나 API 검색 결과를 확인한 뒤 다시 실행하세요.",
      detail: {
        reason: "NO_LAUNCH_DATA_SIGNAL",
        current_launch_progress: launchDataSignal.current_launch_progress,
        existing_public_affiliate_ready: launchDataSignal.existing_public_affiliate_ready,
        existing_public_customer_ready: launchDataSignal.existing_public_customer_ready,
        operator_next_action: launchDataSignal.operator_next_action,
        recovery_actions: launchDataSignal.recovery_actions,
        progress: launchDataSignal.progress,
        before_summary: beforeSummary,
        summary,
        delta_summary: launchDataSignal.delta
      }
    });
  }

  if (hasBlockingLaunchError(steps) || !launchDataSignal.ok) {
    return NextResponse.json({
      status: "completed_with_errors",
      readiness: getApiReadinessSummary(),
      steps,
      launch_confirmation: null,
      before_summary: beforeSummary,
      summary,
      delta_summary: launchDelta,
      launch_data_signal: launchDataSignal
    });
  }

  try {
    launchConfirmation = await markFirstLaunchConfirmed({
      summary,
      delta_summary: launchDelta,
      launch_data_signal: launchDataSignal,
      connection_check_ids: requiredConnectionCheckIds
    });
    steps.push({
      id: "launch_confirmed",
      label: "자동 운영 시작 확인",
      status: "ok",
      message: manualMode
        ? "수동 제휴 링크 출시 상태를 기록했습니다. 상품별 링크를 검수해 게시하고, 쿠팡 API 권한이 열리면 자동 소싱을 켜세요."
        : "핵심 후보 신호와 연결 테스트를 먼저 기록했습니다. 예약 소싱은 즉시 실행할 수 있고, 링크·가격 보강은 남은 시간 안에서 이어집니다.",
      detail: { run_id: launchConfirmation.id, confirmed_at: launchConfirmation.finished_at }
    });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "FIRST_LAUNCH_CONFIRMATION_FAILED";
    steps.push({
      id: "launch_confirmed",
      label: "자동 운영 시작 확인",
      status: "error",
      message: "첫 가동 핵심 작업은 끝났지만 자동 운영 시작 확인 기록을 저장하지 못했습니다. 예약 소싱은 이 확인 기록이 있어야 실행됩니다.",
      detail: {
        reason: "FIRST_LAUNCH_CONFIRMATION_FAILED",
        error: message,
        operator_next_action: "Supabase sourcing_runs 쓰기 권한과 최신 schema.sql 적용 상태를 확인한 뒤 첫 가동 실행을 다시 눌러 확인 기록을 남기세요."
      }
    });
    return NextResponse.json({
      status: "completed_with_errors",
      readiness: getApiReadinessSummary(),
      steps,
      launch_confirmation: null,
      before_summary: beforeSummary,
      summary,
      delta_summary: launchDelta,
      launch_data_signal: launchDataSignal
    });
  }

  const affiliateTimeBudgetMs = manualMode ? 0 : enrichmentBudget(launchStartedAt, 10_000, 4_000);
  if (!affiliateTimeBudgetMs) {
    steps.push({
      id: "affiliate_backfill",
      label: "쿠팡 파트너스 링크 자동 보강",
      status: "skipped",
      message: manualMode
        ? "쿠팡 API 권한이 없어 링크 자동 보강은 대기합니다. 관리자 링크 검수 큐에서 상품별 파트너스 링크를 등록하세요."
        : "자동 운영 시작 확인을 먼저 저장했습니다. 남은 실행 시간이 짧아 링크 보강은 다음 예약 작업으로 넘겼습니다.",
      detail: { deferred: true, operator_next_action: "다음 예약 링크 보강 또는 관리자 링크 검수 큐에서 처리하세요." },
      blocking: false
    });
  } else {
    try {
      const affiliate = await backfillCoupangAffiliateLinks({ limit: affiliateLimit, timeBudgetMs: affiliateTimeBudgetMs });
      progressSignal.affiliate_updated_count = affiliate.updated_count;
      const deferred = affiliate.timed_out;
      steps.push({
        id: "affiliate_backfill",
        label: "쿠팡 파트너스 링크 자동 보강",
        status: deferred ? "skipped" : affiliate.status === "error" ? "error" : affiliate.status === "API_NOT_CONFIGURED" ? "skipped" : "ok",
        message: `확인 ${affiliate.scanned_count}개, 업데이트 ${affiliate.updated_count}개, 건너뜀 ${affiliate.skipped_count}개, 오류 ${affiliate.error_count}개${deferred ? " · 남은 대상은 후속 보강으로 넘겼습니다" : ""}`,
        detail: affiliate,
        ...(deferred ? { blocking: false } : {})
      });
    } catch (error) {
      steps.push({
        id: "affiliate_backfill",
        label: "쿠팡 파트너스 링크 자동 보강",
        status: "error",
        message: error instanceof Error ? error.message : "AFFILIATE_BACKFILL_FAILED"
      });
    }
  }

  const naverTimeBudgetMs = enrichmentBudget(launchStartedAt, 10_000, 2_000);
  if (!naverTimeBudgetMs) {
    steps.push({
      id: "naver_backfill",
      label: "네이버 최저가 보강",
      status: "skipped",
      message: "자동 운영 시작 확인을 먼저 저장했습니다. 남은 실행 시간이 짧아 네이버 가격 보강은 후속 작업으로 넘겼습니다.",
      detail: { deferred: true, operator_next_action: "관리자 네이버 가격 보강 패널에서 다시 실행하세요." },
      blocking: false
    });
  } else {
    try {
      const naver = await backfillNaverLowestPrices({ publishedOnly: false, onlyMissing: true, limit: priceLimit, timeBudgetMs: naverTimeBudgetMs });
      progressSignal.naver_updated_count = naver.updated_count;
      steps.push({
        id: "naver_backfill",
        label: "네이버 최저가 보강",
        status: naver.timed_out ? "skipped" : naver.status === "API_NOT_CONFIGURED" ? "skipped" : naver.status === "completed_with_errors" ? "error" : "ok",
        message: `확인 ${naver.checked_count}개, 업데이트 ${naver.updated_count}개, 매칭 없음 ${naver.no_match_count}개, 오류 ${naver.error_count}개${naver.timed_out ? " · 남은 대상은 후속 보강으로 넘겼습니다" : ""}`,
        detail: naver,
        blocking: false
      });
    } catch (error) {
      steps.push({
        id: "naver_backfill",
        label: "네이버 최저가 보강",
        status: "error",
        message: error instanceof Error ? error.message : "NAVER_BACKFILL_FAILED",
        blocking: false
      });
    }
  }

  summary = await productSummary();
  launchDelta = deltaSummary(beforeSummary, summary);
  launchDataSignal = getLaunchDataSignal(beforeSummary, summary, progressSignal, { manualMode, approvalLinkReady });
  const finalHasError = hasBlockingLaunchError(steps);

  return NextResponse.json({
    status: finalHasError ? "completed_with_errors" : "completed",
    readiness: getApiReadinessSummary(),
    steps,
    launch_confirmation: launchConfirmation,
    before_summary: beforeSummary,
    summary,
    delta_summary: launchDelta,
    launch_data_signal: launchDataSignal
  });
  } catch (error) {
    return launchErrorResponse(error);
  }
}
