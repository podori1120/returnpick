import { NextResponse } from "next/server";
import { listSourcingExecutionRuns } from "@/lib/dataStore";
import { getApiReadinessSummary } from "@/lib/apiReadiness";
import { getPublicWebRuntimeProfile, matchesRequiredPublicWebProfile } from "@/lib/providers/publicWebProfile";
import { isSourcingRunConflict, runSourcing } from "@/lib/sourcing";
import { getNextSourcingKeywordOffset } from "@/lib/sourcingCursor";
import { diagnoseSourcingRun } from "@/lib/sourcingDiagnostics";
import { requireAdmin, requirePersistentStorage } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function positiveInteger(value: unknown) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const MOCK_FALLBACK_BLOCKED_AFTER_API_READY = "MOCK_FALLBACK_BLOCKED_AFTER_API_READY";

function sourcingErrorResponse(error: unknown) {
  const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_SOURCING_RUN_ERROR";
  return NextResponse.json({ error: "SOURCING_RUN_FAILED", message }, { status: 500 });
}

function sourcingConflictResponse(error: unknown) {
  if (!isSourcingRunConflict(error)) return null;
  return NextResponse.json(
    {
      error: "SOURCING_RUN_CONFLICT",
      message: "같은 소싱 모드의 짧은 실행 창에서 이미 작업이 시작되어 이번 요청은 안전하게 건너뛰었습니다.",
      status: "skipped",
      skipped: true,
      skipped_reason: "SOURCING_RUN_CONFLICT",
      source_mode: error.execution.sourceMode,
      conflict: {
        run_id: error.run.id,
        run_status: error.run.status,
        execution_key: error.execution.executionKey,
        execution_window_start: error.execution.windowStart,
        execution_window_end: error.execution.windowEnd
      }
    },
    { status: 409 }
  );
}

function getMockFallbackDecision(body: Record<string, unknown>) {
  const readiness = getApiReadinessSummary();
  const requestedMockFallback = typeof body.useMockFallback === "boolean" ? body.useMockFallback : null;

  if (readiness.apiKeysReady && process.env.NODE_ENV === "production") {
    return {
      useMockFallback: false,
      requestedMockFallback,
      mockFallbackBlockedReason: requestedMockFallback === true ? MOCK_FALLBACK_BLOCKED_AFTER_API_READY : null,
      apiKeysReady: readiness.apiKeysReady
    };
  }

  if (requestedMockFallback !== null) {
    return {
      useMockFallback: requestedMockFallback,
      requestedMockFallback,
      mockFallbackBlockedReason: null,
      apiKeysReady: readiness.apiKeysReady
    };
  }

  return {
    useMockFallback: readiness.apiKeysReady ? false : process.env.NODE_ENV !== "production",
    requestedMockFallback,
    mockFallbackBlockedReason: null,
    apiKeysReady: readiness.apiKeysReady
  };
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const runs = await listSourcingExecutionRuns(10);
    return NextResponse.json({ runs });
  } catch (error) {
    return sourcingErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const storageUnavailable = requirePersistentStorage();
  if (storageUnavailable) return storageUnavailable;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const readiness = getApiReadinessSummary();
    const publicWebOnlyRequested = body.sourceMode === "public_web_only";
    const publicWebProfile = getPublicWebRuntimeProfile();
    if (publicWebOnlyRequested && !matchesRequiredPublicWebProfile(body.requiredPublicWebProfile, publicWebProfile)) {
      return NextResponse.json(
        {
          error: "PUBLIC_WEB_PROFILE_MISMATCH",
          message: "요청한 공개 웹 수집 프로필과 현재 운영 설정이 일치하지 않아 후보 저장을 시작하지 않았습니다.",
          public_web_profile: publicWebProfile
        },
        { status: 409 }
      );
    }
    const publicWebReady = readiness.items.some((item) => item.id === "public_web" && item.state === "ready");
    const publicWebOnlyAllowed = publicWebOnlyRequested && publicWebReady && readiness.runtimeReady;
    if (process.env.NODE_ENV === "production" && !readiness.apiKeysReady && !publicWebOnlyAllowed) {
      return NextResponse.json({
        error: "COUPANG_API_NOT_READY",
        message: "쿠팡 API 권한이 없어 자동 후보 수집을 대기 중입니다. 상품별 쿠팡 파트너스 링크는 관리자 수동 등록으로 먼저 운영할 수 있습니다.",
        readiness: {
          mode: readiness.mode,
          apiKeysReady: readiness.apiKeysReady,
          launchReady: readiness.launchReady,
          publicWebOnlyAvailable: publicWebReady && readiness.runtimeReady,
          nextAction: "최종승인 후 발급된 쿠팡 API 키 3개를 등록하면 자동 후보 수집을 시작할 수 있습니다."
        }
      }, { status: 409 });
    }
    const keywordOffset = await getNextSourcingKeywordOffset();
    const mockFallbackDecision = publicWebOnlyAllowed
      ? {
          useMockFallback: false,
          requestedMockFallback: typeof body.useMockFallback === "boolean" ? body.useMockFallback : null,
          mockFallbackBlockedReason: "PUBLIC_WEB_ONLY_MODE",
          apiKeysReady: readiness.apiKeysReady
        }
      : getMockFallbackDecision(body);
    const run = await runSourcing({
      useMockFallback: mockFallbackDecision.useMockFallback,
      sourceMode: publicWebOnlyAllowed ? "public_web_only" : "auto",
      coordinateExecution: true,
      keywordLimit: positiveInteger(body.keywordLimit),
      keywordOffset,
      timeBudgetMs: positiveInteger(body.timeBudgetMs)
    });
    return NextResponse.json({
      run,
      source_mode: publicWebOnlyAllowed ? "public_web_only" : "auto",
      diagnosis: diagnoseSourcingRun(run),
      defaults: mockFallbackDecision
    });
  } catch (error) {
    const conflict = sourcingConflictResponse(error);
    if (conflict) return conflict;
    return sourcingErrorResponse(error);
  }
}
