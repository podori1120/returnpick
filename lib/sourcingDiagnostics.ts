import type { JsonValue, SourcingRun } from "@/lib/types";

export type SourcingProviderStat = {
  provider: string;
  keywords: number;
  fetched: number;
  accepted: number;
  statuses: string[];
};

export type SourcingDiagnosis = {
  severity: "ok" | "info" | "warning" | "error";
  title: string;
  summary: string;
  actionItems: string[];
  providerStats: SourcingProviderStat[];
  signals: {
    activeKeywordCount: number | null;
    targetKeywordCount: number | null;
    processedKeywordCount: number | null;
    fetchedCount: number;
    acceptedCount: number;
    rejectedByPriceFilterCount: number;
    stoppedByTimeBudget: boolean;
    useMockFallback: boolean;
    robotsDisallowedCount: number;
    robotsUnavailableCount: number;
    invalidTemplateCount: number;
    unsupportedContentTypeCount: number;
    contentTooLargeCount: number;
    redirectBlockedCount: number;
    crawlDelayTooHighCount: number;
    productErrorCount: number;
    keywordErrorCount: number;
    providerErrorCount: number;
    nonProviderErrorCount: number;
    providerIssueProviders: string[];
    publicWebDiagnosticCount: number;
    publicWebDiagnosticStatuses: string[];
  };
};

function asRecord(value: JsonValue): Record<string, JsonValue> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function asNumber(value: JsonValue | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: JsonValue | undefined) {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: JsonValue | undefined) {
  return typeof value === "boolean" ? value : false;
}

function asArray(value: JsonValue | undefined) {
  return Array.isArray(value) ? value : [];
}

function getLogRows(run: SourcingRun) {
  const rawLogs = run.log_json?.logs;
  if (!Array.isArray(rawLogs)) return [];
  return rawLogs.map(asRecord).filter((log): log is Record<string, JsonValue> => Boolean(log));
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildProviderStats(logs: Array<Record<string, JsonValue>>) {
  const stats = new Map<string, SourcingProviderStat>();

  for (const log of logs) {
    const provider = asString(log.provider);
    if (!provider) continue;
    const current =
      stats.get(provider) ??
      ({
        provider,
        keywords: 0,
        fetched: 0,
        accepted: 0,
        statuses: []
      } satisfies SourcingProviderStat);

    current.keywords += asString(log.keyword) ? 1 : 0;
    current.fetched += asNumber(log.fetched) ?? 0;
    current.accepted += asNumber(log.accepted) ?? 0;
    const status = asString(log.provider_status) ?? asString(log.status);
    if (status) current.statuses = unique([...current.statuses, status]);
    stats.set(provider, current);
  }

  return Array.from(stats.values()).sort((a, b) => b.accepted - a.accepted || b.fetched - a.fetched);
}

function getProviderIssueProviders(logs: Array<Record<string, JsonValue>>) {
  const providers: string[] = [];

  for (const log of logs) {
    if (asString(log.status) === "provider_error") {
      const provider = asString(log.provider);
      if (provider) providers.push(provider);
    }

    for (const issue of asArray(log.provider_issues)) {
      const record = asRecord(issue);
      const provider = record ? asString(record.provider) : null;
      if (provider) providers.push(provider);
    }
  }

  return unique(providers);
}

function getPublicWebDiagnostics(logs: Array<Record<string, JsonValue>>) {
  const diagnostics: Array<Record<string, JsonValue>> = [];

  for (const log of logs) {
    const meta = asRecord(log.provider_meta);
    for (const item of asArray(meta?.public_web_diagnostics)) {
      const record = asRecord(item);
      if (record) diagnostics.push(record);
    }
  }

  return diagnostics;
}

export function diagnoseSourcingRun(run: SourcingRun | null | undefined): SourcingDiagnosis | null {
  if (!run) return null;

  const logs = getLogRows(run);
  const providerStats = buildProviderStats(logs);
  const fetchedCount = providerStats.reduce((sum, stat) => sum + stat.fetched, 0);
  const acceptedCount = providerStats.reduce((sum, stat) => sum + stat.accepted, 0);
  const rejectedByPriceFilterCount = Math.max(0, fetchedCount - acceptedCount);
  const stoppedByTimeBudget = asBoolean(run.log_json?.stopped_by_time_budget);
  const useMockFallback = asBoolean(run.log_json?.use_mock_fallback);
  const robotsDisallowedCount = logs.filter((log) => asString(log.status) === "ROBOTS_DISALLOWED").length;
  const robotsUnavailableCount = logs.filter((log) => asString(log.status) === "ROBOTS_UNAVAILABLE").length;
  const invalidTemplateCount = logs.filter((log) => asString(log.status) === "INVALID_TEMPLATE").length;
  const unsupportedContentTypeCount = logs.filter((log) => asString(log.status) === "UNSUPPORTED_CONTENT_TYPE").length;
  const contentTooLargeCount = logs.filter((log) => asString(log.status) === "CONTENT_TOO_LARGE").length;
  const redirectBlockedCount = logs.filter((log) => asString(log.status) === "REDIRECT_BLOCKED").length;
  const crawlDelayTooHighCount = logs.filter((log) => asString(log.status) === "CRAWL_DELAY_TOO_HIGH").length;
  const productErrorCount = logs.filter((log) => asString(log.status) === "product_error").length;
  const keywordErrorCount = logs.filter((log) => asString(log.status) === "keyword_error").length;
  const providerErrorCount = logs.filter((log) => asString(log.status) === "provider_error").length;
  const nonProviderErrorCount = Math.max(0, run.error_count - providerErrorCount);
  const providerIssueProviders = getProviderIssueProviders(logs);
  const publicWebDiagnostics = getPublicWebDiagnostics(logs);
  const publicWebDiagnosticStatuses = unique(publicWebDiagnostics.map((item) => asString(item.status) ?? ""));
  const activeKeywordCount = asNumber(run.log_json?.active_keyword_count);
  const targetKeywordCount = asNumber(run.log_json?.target_keyword_count);
  const processedKeywordCount = asNumber(run.log_json?.processed_keyword_count);
  const actionItems: string[] = [];
  let severity: SourcingDiagnosis["severity"] = "ok";
  let title = "후보 수집 정상";
  let summary = `${run.keyword_count}개 키워드에서 ${run.found_count}개 후보를 발견했습니다.`;

  if (run.status === "error" || nonProviderErrorCount > 0 || productErrorCount > 0 || keywordErrorCount > 0) {
    severity = "error";
    title = "수집 오류 확인 필요";
    summary = `${nonProviderErrorCount || run.error_count}개 오류가 기록되었습니다. 키워드별 오류와 상품 저장 오류를 먼저 확인하세요.`;
    actionItems.push("관리자 API 준비도에서 Supabase 쓰기와 쿠팡/네이버 연결 테스트를 다시 실행하세요.");
  }

  if (providerErrorCount > 0) {
    if (severity !== "error") {
      severity = acceptedCount > 0 ? "warning" : "error";
      title = acceptedCount > 0 ? "일부 공급원 오류, 후보 수집은 진행됨" : "공급원 오류 확인 필요";
    }
    summary = `공급원 오류 ${providerErrorCount}건이 기록되었습니다. ${
      providerIssueProviders.length ? providerIssueProviders.join(", ") : "실패 공급원"
    } 상태를 확인하세요.${acceptedCount > 0 ? ` 허용된 보조 소스로 ${acceptedCount}개 후보는 통과했습니다.` : ""}`;
    actionItems.push("공급원 오류가 있어도 허용된 보조 소스는 계속 시도합니다. 최근 실행 표에서 후보가 실제로 들어온 공급원을 함께 확인하세요.");
  }

  if (run.found_count === 0 && run.error_count === 0) {
    severity = severity === "error" ? severity : "warning";
    title = useMockFallback ? "목업 포함 실행에서도 후보가 없습니다" : "실제 소스 후보가 없습니다";
    summary = `${run.keyword_count}개 키워드를 처리했지만 저장 가능한 후보가 없었습니다.`;
    actionItems.push("API 키를 넣은 직후라면 관리자 API 준비도의 실제 연결 테스트를 먼저 확인하세요.");
    actionItems.push(
      useMockFallback
        ? "키워드 가격 필터와 카테고리 매칭을 완화한 뒤 다시 실행하세요."
        : "승인 전 화면 확인 목적이면 목업 대체 허용을 켜고 다시 실행하세요."
    );
  }

  if (fetchedCount > 0 && acceptedCount === 0) {
    severity = severity === "error" ? severity : "warning";
    title = "가격 필터가 후보를 모두 제외했습니다";
    summary = `${fetchedCount}개 원천 상품을 찾았지만 가격 조건을 통과한 후보가 없습니다.`;
    actionItems.push("키워드의 최소/최대 가격과 최소 할인율을 완화한 뒤 다시 실행하세요.");
  }

  if (stoppedByTimeBudget) {
    severity = severity === "error" ? severity : "info";
    title = "시간 예산 안에서 부분 완료";
    summary = `${processedKeywordCount ?? run.keyword_count}개 키워드까지 처리했고 다음 실행에서 이어갑니다.`;
    actionItems.push("그대로 한 번 더 실행하거나, API 응답이 느리면 SOURCING_KEYWORD_LIMIT 값을 낮추세요.");
  }

  if (robotsDisallowedCount > 0) {
    actionItems.push("공개 웹 참고 수집은 robots.txt에서 허용한 호스트만 사용하세요. 차단된 호스트는 allowlist에서 제외하세요.");
  }

  if (robotsUnavailableCount > 0) {
    actionItems.push("robots.txt를 확인할 수 없는 호스트는 수집하지 않습니다. 접근 가능한 robots.txt가 있는 호스트만 allowlist에 남기세요.");
  }

  if (invalidTemplateCount > 0) {
    actionItems.push("PUBLIC_WEB_SEARCH_TEMPLATES의 URL 형식, http/https 프로토콜, {keyword} 자리표시자를 확인하세요.");
  }

  if (unsupportedContentTypeCount > 0) {
    actionItems.push("공개 웹 참고 수집은 HTML 응답만 읽습니다. 검색 템플릿이 실제 HTML 페이지를 가리키는지 확인하세요.");
  }

  if (contentTooLargeCount > 0) {
    actionItems.push("공개 웹 참고 수집 페이지가 너무 큽니다. 더 작고 구체적인 검색 결과 페이지로 템플릿을 바꾸세요.");
  }

  if (redirectBlockedCount > 0) {
    actionItems.push("리다이렉트가 발생한 공개 웹 주소는 자동 추적하지 않습니다. 최종 HTML 주소를 검색 템플릿으로 직접 등록하세요.");
  }

  if (crawlDelayTooHighCount > 0) {
    actionItems.push("robots.txt의 Crawl-delay가 너무 긴 호스트는 서버리스 수집에서 건너뜁니다. 요청 간격이 짧은 허용 호스트를 쓰거나 allowlist에서 제외하세요.");
  }

  if (publicWebDiagnostics.length > 0 && acceptedCount === 0) {
    actionItems.push(
      `공개 웹 참고 수집 진단 ${publicWebDiagnostics.length}건이 기록됐습니다. 상태: ${publicWebDiagnosticStatuses.slice(0, 4).join(", ") || "unknown"}. allowlist와 검색 템플릿을 조정하세요.`
    );
  }

  if (!providerStats.length) {
    actionItems.push("활성 키워드가 있는지 확인하고, 기본 키워드가 생성되지 않았다면 키워드를 하나 추가하세요.");
  }

  return {
    severity,
    title,
    summary,
    actionItems: unique(actionItems).slice(0, 4),
    providerStats,
    signals: {
      activeKeywordCount,
      targetKeywordCount,
      processedKeywordCount,
      fetchedCount,
      acceptedCount,
      rejectedByPriceFilterCount,
      stoppedByTimeBudget,
      useMockFallback,
      robotsDisallowedCount,
      robotsUnavailableCount,
      invalidTemplateCount,
      unsupportedContentTypeCount,
      contentTooLargeCount,
      redirectBlockedCount,
      crawlDelayTooHighCount,
      productErrorCount,
      keywordErrorCount,
      providerErrorCount,
      nonProviderErrorCount,
      providerIssueProviders,
      publicWebDiagnosticCount: publicWebDiagnostics.length,
      publicWebDiagnosticStatuses
    }
  };
}
