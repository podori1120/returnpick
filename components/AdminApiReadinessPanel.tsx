"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, ClipboardCopy, KeyRound, ListChecks, PlugZap, RefreshCw, ShieldCheck } from "lucide-react";
import { scrollToAdminAnchor } from "@/lib/adminNavigation";
import { formatDate } from "@/lib/format";

type ApiReadinessItem = {
  id: string;
  label: string;
  state: "ready" | "missing" | "partial" | "disabled";
  configured: boolean;
  requiredEnv: string[];
  missingEnv: string[];
  message: string;
  nextAction: string;
};

type ApiReadinessSummary = {
  checkedAt: string;
  mode: "pre_approval" | "manual_launch_ready" | "api_ready" | "launch_ready";
  items: ApiReadinessItem[];
  requiredForApiLaunch: string[];
  apiKeysReady: boolean;
  runtimeReady: boolean;
  launchReady: boolean;
  blockingItemIds: string[];
  blockingEnv: string[];
  optionalItemIds: string[];
  optionalMissingItemIds: string[];
  optionalMissingEnv: string[];
  requiredConnectionCheckIds: string[];
  optionalConnectionCheckIds: string[];
};

type ApiConnectionCheck = {
  id: string;
  label: string;
  status: "ok" | "skipped" | "error";
  message: string;
  detail?: Record<string, unknown>;
};

const vercelEnvRows = [
  { group: "쿠팡 파트너스 API 자동화", name: "COUPANG_ACCESS_KEY", value: "", note: "API 권한 발급 후 자동 후보 수집에 사용" },
  { group: "쿠팡 파트너스 API 자동화", name: "COUPANG_SECRET_KEY", value: "", note: "API 권한 발급 후 딥링크 자동 보강에 사용" },
  { group: "쿠팡 파트너스 API 자동화", name: "COUPANG_PARTNER_ID", value: "", note: "API 권한 발급 후 사용하는 파트너스 계정 ID" },
  { group: "네이버 쇼핑 API", name: "NAVER_CLIENT_ID", value: "", note: "네이버 개발자 센터 애플리케이션 값" },
  { group: "네이버 쇼핑 API", name: "NAVER_CLIENT_SECRET", value: "", note: "네이버 개발자 센터 애플리케이션 값" },
  { group: "Supabase 운영 DB", name: "NEXT_PUBLIC_SUPABASE_URL", value: "", note: "Supabase Project URL" },
  { group: "Supabase 운영 DB", name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", value: "", note: "Supabase anon public key" },
  { group: "Supabase 운영 DB", name: "SUPABASE_SERVICE_ROLE_KEY", value: "", note: "서버 전용 service role key" },
  { group: "텔레그램", name: "TELEGRAM_BOT_TOKEN", value: "", note: "BotFather에서 발급한 bot token" },
  { group: "텔레그램", name: "TELEGRAM_CHAT_ID", value: "", note: "발송 대상 채널 또는 채팅 ID" },
  { group: "운영 보호", name: "ADMIN_PASSWORD", value: "", note: "12자 이상 랜덤 관리자 로그인 비밀번호" },
  { group: "운영 보호", name: "CRON_SECRET", value: "", note: "16자 이상 랜덤 문자열" },
  { group: "자동 운영", name: "CRON_USE_MOCK_FALLBACK", value: "false", note: "승인 후 운영에서는 false 유지" },
  { group: "자동 운영", name: "SOURCING_TIME_BUDGET_MS", value: "52000", note: "서버리스 시간 제한 전 안전 종료 예산" },
  { group: "자동 운영", name: "SOURCING_KEYWORD_LIMIT", value: "", note: "초기 운영에서 키워드 수를 제한할 때만 입력" },
  { group: "자동 운영", name: "SOURCING_ENRICHMENT_CONCURRENCY", value: "2", note: "가격·링크 보강 동시 처리 수, 1~4 범위" },
  { group: "자동 운영", name: "AFFILIATE_BACKFILL_LIMIT", value: "10", note: "매시 상품별 파트너스 링크 자동 보강 건수, 최대 20" },
  { group: "공개 URL", name: "NEXT_PUBLIC_SITE_URL", value: process.env.NEXT_PUBLIC_SITE_URL ?? "", note: "예: https://returnpick.vercel.app" },
  {
    group: "공개 URL",
    name: "NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL",
    value: process.env.NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL ?? "",
    note: "승인용 쿠팡 파트너스 링크"
  },
  { group: "공개 웹 참고 수집", name: "PUBLIC_WEB_CRAWL_ENABLED", value: "false", note: "allowlist·robots.txt를 통과한 검수 후보 수집을 쓸 때만 true; API 전에도 사용 가능" },
  { group: "공개 웹 참고 수집", name: "PUBLIC_WEB_ALLOWED_HOSTS", value: "", note: "허용할 공개 호스트명만 쉼표로 입력" },
  { group: "공개 웹 참고 수집", name: "PUBLIC_WEB_SEARCH_TEMPLATES", value: "", note: "{keyword}를 포함한 허용 호스트 검색 URL" }
];

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

function adminApiErrorMessage(error: unknown, fallback: string) {
  if (error === "ADMIN_PASSWORD_NOT_CONFIGURED") return "Vercel 환경변수에 ADMIN_PASSWORD가 없어 관리자 API가 닫혀 있습니다.";
  if (error === "ADMIN_PASSWORD_WEAK_CONFIGURATION") return "ADMIN_PASSWORD가 너무 짧거나 예시값입니다. 12자 이상 랜덤 문자열로 바꾼 뒤 재배포하세요.";
  return typeof error === "string" && error.trim() ? error : fallback;
}

function stateMeta(state: ApiReadinessItem["state"]) {
  if (state === "ready") return { label: "준비됨", className: "bg-pine/10 text-pine", icon: CheckCircle2 };
  if (state === "partial") return { label: "일부 누락", className: "bg-lemon/20 text-ink", icon: AlertTriangle };
  if (state === "disabled") return { label: "선택 꺼짐", className: "bg-mist text-steel", icon: ShieldCheck };
  return { label: "키 필요", className: "bg-coral/10 text-coral", icon: AlertTriangle };
}

function checkMeta(status: ApiConnectionCheck["status"]) {
  if (status === "ok") return "border-pine/30 bg-pine/5 text-pine";
  if (status === "error") return "border-coral/30 bg-coral/5 text-coral";
  return "border-line bg-mist text-steel";
}

function formatCheckDetailValue(value: unknown) {
  if (value == null || value === "") return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    const text = JSON.stringify(value);
    return text.length > 220 ? `${text.slice(0, 220)}...` : text;
  } catch {
    return "표시할 수 없는 값";
  }
}

function checkDetailEntries(detail?: Record<string, unknown>) {
  if (!detail) return [];
  const summarizedKeys = new Set([
    "published_count",
    "published_public_ready_count",
    "published_customer_hidden_count",
    "published_missing_affiliate_url",
    "published_non_partners_affiliate_url",
    "approval_sample_link_reuse",
    "public_affiliate_constraint"
  ]);
  return Object.entries(detail)
    .filter(([key, value]) => value != null && value !== "" && key !== "operator_next_action" && key !== "public_quality_blocker_summary" && !summarizedKeys.has(key))
    .slice(0, 8);
}

function createOperationalSecret(prefix: string) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_";
  const values = new Uint32Array(32);
  const cryptoSource = globalThis.crypto;

  if (cryptoSource?.getRandomValues) {
    cryptoSource.getRandomValues(values);
    return `${prefix}-${Array.from(values, (value) => alphabet[value % alphabet.length]).join("")}`;
  }

  const fallback = Array.from({ length: 32 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `${prefix}-${Date.now().toString(36)}-${fallback}`;
}

function getReadinessSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured?.startsWith("https://")) return configured.replace(/\/$/, "");

  if (typeof window !== "undefined" && window.location.origin.startsWith("https://")) {
    return window.location.origin.replace(/\/$/, "");
  }

  return "https://returnpick.vercel.app";
}

function githubSchedulerReadinessRunbook() {
  const siteUrl = getReadinessSiteUrl();
  return [
    "ReturnPick GitHub Actions 1시간 스케줄러 준비도 체크",
    "",
    "앱 서버는 GitHub Repository secret 값을 직접 읽을 수 없습니다. 아래 항목을 GitHub에서 수동 확인하세요.",
    "",
    "1. GitHub 저장소 > Settings > Secrets and variables > Actions",
    "2. Repository secret",
    "   Name: RETURNPICK_CRON_SECRET",
    "   Value: Vercel 환경변수 CRON_SECRET과 같은 값",
    "3. Repository variable",
    "   Name: RETURNPICK_SITE_URL",
    `   Value: ${siteUrl}`,
    "4. Actions > ReturnPick Hourly Scheduler > Run workflow",
    "5. 로그에서 두 요청이 200 응답인지 확인",
    `   ${siteUrl}/api/cron/sourcing`,
    `   ${siteUrl}/api/cron/telegram-digest?limit=1`,
    "",
    "정상 대기 응답: 승인 전 또는 첫 가동 전에는 LAUNCH_NOT_READY / FIRST_LAUNCH_NOT_CONFIRMED가 나올 수 있습니다.",
    "실패 응답: 401이면 RETURNPICK_CRON_SECRET과 Vercel CRON_SECRET 값이 서로 다릅니다."
  ].join("\n");
}

function productionDeployRunbook(readiness: ApiReadinessSummary) {
  const missingEnv = readiness.blockingEnv.length ? readiness.blockingEnv.join(", ") : "없음";
  return [
    "ReturnPick 승인 후 운영 전환 명령",
    "",
    "0. 현재 누락 환경변수",
    `   ${missingEnv}`,
    "",
    "1. Vercel Production 값 최신 점검",
    "   npm run doctor:production:launch:fresh",
    "",
    "2. 배포 전 안전 점검만 실행",
    "   npm run deploy:production:launch",
    "",
    "3. 점검 결과가 맞으면 운영 배포",
    "   npm run deploy:production:launch -- confirm",
    "",
    "4. 배포 직후 첫 후보 수집, 링크 보강, 네이버 가격 보강까지 진행",
    "   npm run deploy:production:go-live -- confirm",
    "",
    "안전 장치:",
    "- confirm이 없으면 실제 배포나 데이터 작업을 시작하지 않습니다.",
    "- 환경변수 값이 비어 있거나 형식이 틀리면 배포 전에 멈춥니다.",
    "- 첫 가동은 launch doctor가 통과해야만 이어집니다.",
    "",
    "보조 명령:",
    "- 누락 키 복구표: npm run env:repair",
    "- 공개 배포 점검: npm run check:production",
    "- 첫 가동만 별도 실행: npm run launch:production -- standard confirm"
  ].join("\n");
}

function recordFromUnknown(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function operatorNextActionFromDetail(detail?: Record<string, unknown>) {
  const value = detail?.operator_next_action;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function publicQualityBlockerSummaryFromDetail(detail?: Record<string, unknown>) {
  const raw = detail?.public_quality_blocker_summary;
  if (!Array.isArray(raw)) return [];

  return raw
    .map(recordFromUnknown)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      blocker: typeof item.blocker === "string" ? item.blocker : "",
      count: Number(item.count ?? 0)
    }))
    .filter((item) => item.blocker && Number.isFinite(item.count) && item.count > 0)
    .slice(0, 5);
}

function numberFromDetail(detail: Record<string, unknown> | undefined, key: string) {
  const value = detail?.[key];
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function booleanFromNestedDetail(detail: Record<string, unknown> | undefined, parentKey: string, childKey: string) {
  const parent = recordFromUnknown(detail?.[parentKey]);
  const value = parent?.[childKey];
  return typeof value === "boolean" ? value : null;
}

function publicQualityMetricCardsFromDetail(detail?: Record<string, unknown>) {
  if (!detail) return [];
  const publishedCount = numberFromDetail(detail, "published_count");
  if (publishedCount == null) return [];

  const hiddenCount = numberFromDetail(detail, "published_customer_hidden_count") ?? numberFromDetail(detail, "published_public_quality_blockers") ?? 0;
  const readyCount = numberFromDetail(detail, "published_public_ready_count") ?? Math.max(0, publishedCount - hiddenCount);
  const missingAffiliateCount = numberFromDetail(detail, "published_missing_affiliate_url") ?? 0;
  const badAffiliateCount = numberFromDetail(detail, "published_non_partners_affiliate_url") ?? 0;
  const approvalReuseCount = numberFromDetail(detail, "approval_sample_link_reuse") ?? 0;
  const constraintOk = booleanFromNestedDetail(detail, "public_affiliate_constraint", "rejected_bad_public_affiliate_url");

  return [
    { label: "공개 상품", value: `${publishedCount.toLocaleString("ko-KR")}개`, tone: "text-ink" },
    { label: "고객 공개 가능", value: `${readyCount.toLocaleString("ko-KR")}개`, tone: readyCount > 0 ? "text-pine" : "text-steel" },
    { label: "고객 화면 숨김", value: `${hiddenCount.toLocaleString("ko-KR")}개`, tone: hiddenCount > 0 ? "text-coral" : "text-pine" },
    { label: "링크 보강 필요", value: `${missingAffiliateCount.toLocaleString("ko-KR")}개`, tone: missingAffiliateCount > 0 ? "text-coral" : "text-pine" },
    { label: "비정상 링크", value: `${badAffiliateCount.toLocaleString("ko-KR")}개`, tone: badAffiliateCount > 0 ? "text-coral" : "text-pine" },
    { label: "승인용 링크 재사용", value: `${approvalReuseCount.toLocaleString("ko-KR")}개`, tone: approvalReuseCount > 0 ? "text-coral" : "text-pine" },
    { label: "DB 링크 제약", value: constraintOk === false ? "미적용" : constraintOk === true ? "통과" : "확인필요", tone: constraintOk === false ? "text-coral" : "text-pine" }
  ];
}

function publicQualityActionButtonsFromDetail(detail?: Record<string, unknown>) {
  if (!detail) return [];
  const hiddenCount = numberFromDetail(detail, "published_customer_hidden_count") ?? numberFromDetail(detail, "published_public_quality_blockers") ?? 0;
  const missingAffiliateCount = numberFromDetail(detail, "published_missing_affiliate_url") ?? 0;
  const badAffiliateCount = numberFromDetail(detail, "published_non_partners_affiliate_url") ?? 0;
  const approvalReuseCount = numberFromDetail(detail, "approval_sample_link_reuse") ?? 0;
  const actions: Array<{ label: string; anchor: string; helper: string }> = [];

  if (missingAffiliateCount > 0 || badAffiliateCount > 0 || approvalReuseCount > 0) {
    actions.push({
      label: "링크 보강 큐로 이동",
      anchor: "admin-affiliate-links",
      helper: "상품별 쿠팡 파트너스 링크를 보완합니다."
    });
  }

  if (hiddenCount > 0) {
    actions.push({
      label: "공개 보강 후보로 이동",
      anchor: "admin-candidate-review",
      helper: "가격·이미지·상품별 링크 같은 공개 품질 blocker와 반품 정보 확인필요 경고를 확인합니다."
    });
  }

  return actions;
}

function getSupabaseSchemaIssue(checks: ApiConnectionCheck[]) {
  const supabaseCheck = checks.find((check) => check.id === "supabase");
  const detail = recordFromUnknown(supabaseCheck?.detail);
  const schemaVersion = recordFromUnknown(detail?.schema_version);
  if (!schemaVersion || schemaVersion.ok === true) return null;

  return {
    expected: String(schemaVersion.expected ?? "최신 schema.sql"),
    actual: schemaVersion.actual ? String(schemaVersion.actual) : "없음",
    status: supabaseCheck?.status ?? "error"
  };
}

function stepMeta(done: boolean) {
  return done ? "bg-pine/10 text-pine" : "bg-lemon/20 text-ink";
}

function modeLabel(readiness: ApiReadinessSummary) {
  if (readiness.mode === "manual_launch_ready") return "수동 출시 가능";
  if (readiness.launchReady) return "운영 준비 완료";
  if (readiness.apiKeysReady) return "API 키 입력됨";
  return "승인 대기";
}

function nextLaunchAction(readiness: ApiReadinessSummary, checks: ApiConnectionCheck[], connectionChecksPassed: boolean) {
  const failedChecks = checks
    .filter((check) => readiness.requiredConnectionCheckIds.includes(check.id) && check.status === "error")
    .map((check) => check.label);

  if (readiness.mode === "manual_launch_ready") {
    return {
      stage: "수동 링크 출시",
      title: "상품별 쿠팡 파트너스 링크를 검수해 바로 게시하세요.",
      body: "쿠팡 API 권한은 자동 후보 수집 기능에만 필요합니다. 실제 상품 URL과 상품별 파트너스 링크를 관리자에서 확인한 뒤 승인·게시하고, API 권한이 열리면 자동 수집을 추가합니다.",
      bullets: ["상품별 파트너스 링크 수동 등록", "반품가·등급·재고 검수", "API 권한 발급 후 자동화 전환"]
    };
  }

  if (!readiness.apiKeysReady) {
    return {
      stage: "승인 대기",
      title: "지금은 승인용 페이지와 수동 파트너스 링크를 유지하세요.",
      body: "쿠팡 최종승인 전에는 Partners API 키가 나오지 않으므로 자동 API 수집은 대기합니다. 공개 승인 페이지와 수동 링크 운영을 먼저 준비하세요.",
      bullets: ["승인용 페이지 캡처 유지", "상품별 수동 파트너스 링크만 게시", "Supabase·Cron은 미리 준비"]
    };
  }

  if (!readiness.runtimeReady || readiness.blockingEnv.length) {
    return {
      stage: "환경변수 보강",
      title: "누락 키를 Vercel에 넣고 재배포하세요.",
      body: "쿠팡 API 키는 들어갔지만 운영 저장소, 공개 URL, Cron 보호값 중 하나가 아직 부족합니다. 누락 키만 복사해서 Vercel Environment Variables에 채우면 됩니다.",
      bullets: readiness.blockingEnv.slice(0, 10)
    };
  }

  if (!checks.length) {
    return {
      stage: "연결 테스트",
      title: "실제 연결 테스트를 먼저 실행하세요.",
      body: "핵심 환경변수는 모두 있어 보입니다. 첫 가동 전에 쿠팡 딥링크, Supabase 쓰기/RLS, 공개 승인 페이지, Cron 인증과 공개 웹 참고 수집 사용 시 robots.txt 경로를 실제로 한 번 확인해야 합니다. 네이버와 텔레그램은 설정된 경우 별도로 점검됩니다.",
      bullets: ["상단의 실제 연결 테스트 클릭", "오류 카드가 나오면 해당 키 또는 SQL 먼저 수정", "모두 OK면 첫 가동 실행으로 이동"]
    };
  }

  if (!connectionChecksPassed) {
    return {
      stage: "연결 오류 수정",
      title: "실패한 연결 테스트부터 고치세요.",
      body: "첫 가동은 핵심 연결 테스트가 모두 통과해야 시작됩니다. 실패한 카드의 세부정보를 보고 쿠팡 키, Supabase SQL, Cron secret, 공개 URL을 먼저 맞추세요.",
      bullets: failedChecks.length ? failedChecks.slice(0, 10) : ["실제 연결 테스트를 다시 실행해 상태를 갱신"]
    };
  }

  return {
    stage: "첫 가동 실행",
    title: "아래에서 표준 런칭으로 첫 실데이터 수집을 시작하세요.",
    body: "API와 운영 연결이 모두 준비됐습니다. 첫 가동 실행은 목업 없이 후보 수집, 파트너스 링크 보강, 네이버 최저가 보강을 묶어서 처리하고 성공 마커를 남깁니다.",
    bullets: ["표준 런칭 선택", "첫 가동 실행 클릭", "변화량과 데이터 신호 확인"]
  };
}

export default function AdminApiReadinessPanel({ password }: { password: string }) {
  const [readiness, setReadiness] = useState<ApiReadinessSummary | null>(null);
  const [checks, setChecks] = useState<ApiConnectionCheck[]>([]);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [envCopyMessage, setEnvCopyMessage] = useState("");
  const [schemaCopyMessage, setSchemaCopyMessage] = useState("");
  const [connectionReportMessage, setConnectionReportMessage] = useState("");
  const [githubSchedulerCopyMessage, setGithubSchedulerCopyMessage] = useState("");
  const [deployRunbookCopyMessage, setDeployRunbookCopyMessage] = useState("");
  const [generatedSecrets, setGeneratedSecrets] = useState<Record<string, string>>({});

  async function loadReadiness() {
    try {
      const response = await fetch("/api/admin/api-readiness", { headers: headers(password) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setReadiness(null);
        setLoadError(adminApiErrorMessage(data.error, "API 준비 상태를 불러오지 못했습니다."));
        return;
      }
      setReadiness(data.readiness ?? null);
      setLoadError("");
    } catch {
      setReadiness(null);
      setLoadError("관리자 API에 연결하지 못했습니다. 배포 상태와 관리자 비밀번호 설정을 확인하세요.");
    }
  }

  useEffect(() => {
    void loadReadiness();
  }, [password]);

  async function runChecks() {
    setRunning(true);
    try {
    setMessage("입력된 키로 실제 연결 테스트를 실행 중입니다.");
    const response = await fetch("/api/admin/api-readiness", {
      method: "POST",
      headers: headers(password)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(adminApiErrorMessage(data.message ?? data.error, "연결 테스트에 실패했습니다."));
      setRunning(false);
      return;
    }
    setReadiness(data.readiness ?? null);
    setChecks(data.checks ?? []);
    setMessage("연결 테스트가 완료되었습니다.");
    setRunning(false);
    } catch {
      setMessage("네트워크 문제로 API 연결 테스트를 실행하지 못했습니다. Vercel 배포 상태와 관리자 비밀번호를 확인하세요.");
      setChecks([]);
      setRunning(false);
    }
  }

  const readyCount = useMemo(() => readiness?.items.filter((item) => item.state === "ready").length ?? 0, [readiness]);
  const missingCount = readiness?.blockingItemIds.length ?? 0;
  const optionalMissingCount = readiness?.optionalMissingItemIds.length ?? 0;

  async function copyEnvTemplate(scope: "all" | "missing") {
    if (!readiness) return;
    const missingEnvSet = new Set(readiness.blockingEnv);
    const rows = scope === "missing" ? vercelEnvRows.filter((row) => missingEnvSet.has(row.name)) : vercelEnvRows;
    const text = rows.map((row) => `${row.name}=${generatedSecrets[row.name] ?? row.value}`).join("\n");

    if (!rows.length) {
      setEnvCopyMessage("누락된 필수 환경변수가 없습니다.");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setEnvCopyMessage(scope === "missing" ? "누락된 키 목록을 복사했습니다. Vercel에서 값을 채워 넣으세요." : "전체 필수 키 템플릿을 복사했습니다.");
    } catch {
      setEnvCopyMessage("브라우저에서 복사가 막혔습니다. 아래 변수명을 직접 선택해 Vercel에 입력하세요.");
    }
  }

  function generateOperationalSecrets() {
    setGeneratedSecrets({
      ADMIN_PASSWORD: createOperationalSecret("rp-admin"),
      CRON_SECRET: createOperationalSecret("rp-cron")
    });
    setEnvCopyMessage("운영 보안값을 만들었습니다. 복사 버튼을 누르면 ADMIN_PASSWORD와 CRON_SECRET 값이 함께 들어갑니다.");
  }

  async function copySupabaseSchemaRunbook() {
    const text = [
      "ReturnPick Supabase 최신 SQL 재적용",
      "",
      "1. 로컬 프로젝트에서 C:\\projects\\returnpick\\sql\\schema.sql 파일을 엽니다.",
      "2. 파일 전체 내용을 복사합니다.",
      "3. Supabase Dashboard > SQL Editor > New query에 붙여넣고 실행합니다.",
      "4. 실행이 끝나면 Vercel을 재배포합니다.",
      "5. ReturnPick /admin > 승인 후 운영 즉시 가동 준비 > 실제 연결 테스트를 다시 누릅니다.",
      "",
      `기대 schema_version: ${supabaseSchemaIssue?.expected ?? "2026-08-01-public-column-boundary"}`,
      "확인 항목: returnpick_schema_meta, is_strict_coupang_partners_url, product_snapshots, RLS 정책, 공개 컬럼 권한, affiliate_events"
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setSchemaCopyMessage("Supabase SQL 재적용 체크리스트를 복사했습니다.");
    } catch {
      setSchemaCopyMessage("복사가 막혔습니다. C:\\projects\\returnpick\\sql\\schema.sql 전체를 Supabase SQL Editor에서 실행하세요.");
    }
  }

  async function copyGithubSchedulerReadinessRunbook() {
    try {
      await navigator.clipboard.writeText(githubSchedulerReadinessRunbook());
      setGithubSchedulerCopyMessage("GitHub Actions 1시간 스케줄러 준비도 체크리스트를 복사했습니다.");
    } catch {
      setGithubSchedulerCopyMessage("브라우저에서 복사가 막혔습니다. GitHub secret과 variable 이름을 직접 입력하세요.");
    }
  }

  async function copyProductionDeployRunbook() {
    if (!readiness) return;
    try {
      await navigator.clipboard.writeText(productionDeployRunbook(readiness));
      setDeployRunbookCopyMessage("운영 전환 명령과 안전 순서를 복사했습니다.");
    } catch {
      setDeployRunbookCopyMessage("복사가 막혔습니다. 아래 명령을 직접 실행하세요.");
    }
  }

  async function copyConnectionFailureReport() {
    const failedChecks = checks.filter((check) => check.status === "error");
    if (!failedChecks.length) {
      setConnectionReportMessage("복사할 실패 연결 테스트가 없습니다.");
      return;
    }

    const text = [
      "ReturnPick 실제 연결 테스트 실패 보고서",
      "",
      `점검 시각: ${readiness?.checkedAt ?? new Date().toISOString()}`,
      `현재 모드: ${readiness ? modeLabel(readiness) : "확인필요"}`,
      `차단 항목: ${readiness?.blockingItemIds.join(", ") || "없음"}`,
      "",
      ...failedChecks.flatMap((check, index) => {
        const details = checkDetailEntries(check.detail);
        const operatorNextAction = operatorNextActionFromDetail(check.detail);
        const publicQualityBlockerSummary = publicQualityBlockerSummaryFromDetail(check.detail);
        return [
          `${index + 1}. ${check.label}`,
          `- 상태: ${check.status}`,
          `- 메시지: ${check.message}`,
          ...(operatorNextAction ? ["- 다음 조치:", `  - ${operatorNextAction}`] : []),
          ...(publicQualityBlockerSummary.length
            ? [
                "- 품질 blocker 요약:",
                ...publicQualityBlockerSummary.map((item) => `  - ${item.blocker}: ${item.count}건`)
              ]
            : []),
          ...(details.length
            ? ["- 진단 세부정보:", ...details.map(([key, value]) => `  - ${key}: ${formatCheckDetailValue(value)}`)]
            : ["- 진단 세부정보: 없음"]),
          ""
        ];
      }),
      "다음 행동:",
      "1. 위 실패 카드의 환경변수 또는 Supabase SQL 적용 상태를 수정합니다.",
      "2. Vercel을 재배포합니다.",
      "3. /admin에서 실제 연결 테스트를 다시 실행합니다."
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setConnectionReportMessage("실패 연결 테스트 보고서를 복사했습니다.");
    } catch {
      setConnectionReportMessage("복사가 막혔습니다. 실패 카드의 메시지와 진단 세부정보를 확인하세요.");
    }
  }

  function scrollToFirstLaunchRunner() {
    scrollToAdminAnchor("admin-first-launch");
  }

  if (!readiness) {
    return (
      <section id="admin-api-readiness" className="scroll-mt-4 rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <AlertTriangle className={loadError ? "mt-0.5 shrink-0 text-coral" : "mt-0.5 shrink-0 text-steel"} size={18} aria-hidden />
          <div>
            <h2 className="text-lg font-black">승인 후 운영 즉시 가동 준비</h2>
            <p className="mt-2 text-sm font-bold text-steel">
              {loadError || "API 준비 상태를 확인하는 중입니다."}
            </p>
            {loadError ? (
              <p className="mt-2 text-xs font-semibold leading-5 text-steel">
                운영 배포에서는 먼저 Vercel Environment Variables에 `ADMIN_PASSWORD`를 등록하고 재배포한 뒤 같은 값으로 로그인하세요.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  const itemById = new Map(readiness.items.map((item) => [item.id, item]));
  const checkById = new Map(checks.map((check) => [check.id, check]));
  const blockingItemIdSet = new Set(readiness.blockingItemIds);
  const missingEnvSet = new Set(readiness.blockingEnv);
  const optionalMissingEnvSet = new Set(readiness.optionalMissingEnv);
  const optionalItemIdSet = new Set(readiness.optionalItemIds);
  const readinessItems = [...readiness.items].sort((left, right) => {
    const leftIsBlocking = blockingItemIdSet.has(left.id);
    const rightIsBlocking = blockingItemIdSet.has(right.id);
    return Number(rightIsBlocking) - Number(leftIsBlocking);
  });
  const configuredEnvSet = new Set(readiness.items.flatMap((item) => item.requiredEnv.filter((env) => !item.missingEnv.includes(env))));
  const requiredRuntimeReady = readiness.runtimeReady;
  const apiEnvReady = readiness.apiKeysReady;
  const connectionChecksPassed = readiness.requiredConnectionCheckIds.every((id) => checkById.get(id)?.status === "ok");
  const nextAction = nextLaunchAction(readiness, checks, connectionChecksPassed);
  const supabaseSchemaIssue = getSupabaseSchemaIssue(checks);
  const failedConnectionCheckCount = checks.filter((check) => check.status === "error").length;
  const launchSteps = [
    {
      title: "운영 필수 환경변수 입력",
      done: requiredRuntimeReady,
      description: "관리자 비밀번호, Supabase, 공개 URL, Cron 보호값, 승인용 링크가 먼저 준비되어야 합니다."
    },
    {
      title: "쿠팡 API 자동화 연결",
      done: apiEnvReady,
      description: "선택 단계입니다. API 권한이 없을 때는 상품별 파트너스 링크를 수동 검수하고, 권한 발급 후 자동 후보 수집과 딥링크 보강을 켭니다."
    },
    {
      title: "핵심 연결 테스트 통과",
      done: connectionChecksPassed,
      description: apiEnvReady
        ? "쿠팡 딥링크, Supabase 읽기·쓰기, 공개 상품 데이터 품질, 공개 승인 페이지, Cron 인증과 공개 웹 참고 수집 사용 시 robots.txt 경로를 확인합니다."
        : "Supabase 읽기·쓰기, 공개 상품 데이터 품질, 공개 승인 페이지와 Cron 인증을 확인합니다. 쿠팡 API 연결은 권한 발급 후 추가합니다."
    },
    {
      title: apiEnvReady ? "목업 끄고 첫 후보 수집" : "상품별 링크 수동 등록·검수",
      done: false,
      description: apiEnvReady
        ? "자동 후보 수집에서 목업 대체 허용을 끄고 실행해 실제 API/허용 소스만 들어오는지 확인합니다."
        : "자동 후보 수집 대신 실제 상품 URL, 상품별 파트너스 링크, 반품 정보와 재고를 관리자에서 확인한 뒤 게시합니다."
    },
    {
      title: "선택 가격 보강과 후보 검수",
      done: false,
      description: "네이버 API가 연결되면 최저가를 보강하고, 연결 전에는 가격확인필요 상태로 반품가·등급·제휴 URL을 검수합니다."
    },
    {
      title: "게시 후 선택 채널 발송",
      done: false,
      description: "사이트 게시는 텔레그램 없이도 가능하며, Bot 연동이 준비되면 게시 상품의 텔레그램 후보 발송을 실행합니다."
    }
  ];

  return (
    <section id="admin-api-readiness" className="scroll-mt-4 space-y-4 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <PlugZap className="text-pine" size={20} aria-hidden />
            <p className="text-xs font-black text-pine">API Launch Readiness</p>
          </div>
          <h2 className="mt-1 text-xl font-black">승인 후 운영 즉시 가동 준비</h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-steel">
            쿠팡 API 권한 전에는 상품별 수동 파트너스 링크로 운영하고, API 권한이 열리면 자동 후보 수집과 딥링크 보강으로 확장합니다. 네이버 가격 비교와 텔레그램은 준비되는 즉시 기능별로 활성화됩니다.
          </p>
          {message ? <p className="mt-2 text-sm font-bold text-pine">{message}</p> : null}
          {readiness.apiKeysReady && !readiness.launchReady ? (
            <p className="mt-2 rounded-lg border border-coral/30 bg-coral/10 px-3 py-2 text-xs font-black text-coral">
              API 키는 들어갔지만 운영 필수 설정이 남아 있습니다. 누락 환경변수: {readiness.blockingEnv.length ? readiness.blockingEnv.join(", ") : "연결 테스트 필요"}
            </p>
          ) : null}
          {readiness.optionalMissingItemIds.length ? (
            <p className="mt-2 rounded-lg border border-lemon/40 bg-lemon/10 px-3 py-2 text-xs font-black text-ink">
              선택 연동 대기: {readiness.optionalMissingItemIds.map((id) => itemById.get(id)?.label ?? id).join(", ")}. 핵심 출시와 사이트 게시는 차단하지 않습니다.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="focus-ring rounded-lg border border-line p-2 hover:bg-mist" onClick={loadReadiness} type="button" title="새로고침">
            <RefreshCw size={18} aria-hidden />
          </button>
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-black text-white hover:bg-pine disabled:opacity-60"
            disabled={running}
            onClick={runChecks}
            type="button"
          >
            <Activity size={16} aria-hidden /> 실제 연결 테스트
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg bg-mist p-4">
          <p className="text-xs font-black text-steel">현재 모드</p>
          <p className="mt-2 text-2xl font-black">{modeLabel(readiness)}</p>
          <p className="mt-1 text-xs font-bold text-steel">확인 {formatDate(readiness.checkedAt)}</p>
        </div>
        <div className="rounded-lg bg-mist p-4">
          <p className="text-xs font-black text-steel">준비된 연동</p>
          <p className="mt-2 text-2xl font-black text-pine">{readyCount}개</p>
          <p className="mt-1 text-xs font-bold text-steel">키 입력 후 자동 활성화</p>
        </div>
        <div className="rounded-lg bg-mist p-4">
          <p className="text-xs font-black text-steel">가동 차단 설정</p>
          <p className="mt-2 text-2xl font-black text-coral">{readiness.blockingItemIds.length}개</p>
          <p className="mt-1 text-xs font-bold text-steel">{missingCount}개 설정 항목 중 운영 필수 누락</p>
        </div>
        <div className="rounded-lg bg-mist p-4">
          <p className="text-xs font-black text-steel">선택 연동 대기</p>
          <p className="mt-2 text-2xl font-black text-ink">{optionalMissingCount}개</p>
          <p className="mt-1 text-xs font-bold text-steel">네이버 가격 비교·텔레그램 발송</p>
        </div>
      </div>

      <div className="rounded-lg border border-pine/30 bg-pine/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-pine">
              <ListChecks size={18} aria-hidden />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-pine">Next Launch Action · {nextAction.stage}</p>
              <h3 className="mt-1 text-lg font-black">{nextAction.title}</h3>
              <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-steel">{nextAction.body}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {readiness.launchReady && connectionChecksPassed ? (
              <button
                className="focus-ring rounded-lg bg-pine px-3 py-2 text-xs font-black text-white hover:bg-ink"
                onClick={scrollToFirstLaunchRunner}
                type="button"
              >
                첫 가동 실행으로 이동
              </button>
            ) : null}
            <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-pine">
              {readiness.launchReady && connectionChecksPassed ? "실행 가능" : "확인 필요"}
            </span>
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {nextAction.bullets.map((bullet) => (
            <div key={bullet} className="rounded-lg bg-white px-3 py-2 text-xs font-black text-ink">
              {bullet}
            </div>
          ))}
        </div>
      </div>

      {supabaseSchemaIssue ? (
        <div className="rounded-lg border border-coral/30 bg-coral/10 p-4 text-coral">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide">Supabase Schema Action</p>
              <h3 className="mt-1 text-lg font-black">Supabase 최신 SQL 적용 필요</h3>
              <p className="mt-1 max-w-3xl text-sm font-bold leading-6">
                Supabase SQL Editor에서 `sql/schema.sql` 전체를 다시 실행한 뒤, Vercel 재배포 후 실제 연결 테스트를 다시 누르세요.
              </p>
              {schemaCopyMessage ? <p className="mt-2 text-xs font-black text-coral">{schemaCopyMessage}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="focus-ring inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-black text-coral hover:bg-coral/10"
                onClick={copySupabaseSchemaRunbook}
                type="button"
              >
                <ClipboardCopy size={15} aria-hidden /> SQL 적용 체크리스트 복사
              </button>
              <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-coral">schema.sql 재실행</span>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg bg-white/75 px-3 py-2 text-xs font-black text-ink">
              기대 버전: {supabaseSchemaIssue.expected}
            </div>
            <div className="rounded-lg bg-white/75 px-3 py-2 text-xs font-black text-ink">
              현재 DB 버전: {supabaseSchemaIssue.actual}
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-line p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-black">승인 후 첫 운영 순서</h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-steel">최종승인 후 키를 넣으면 아래 순서대로 확인하고 바로 첫 상품 수집까지 진행합니다.</p>
          </div>
          <span className="rounded-md bg-mist px-2 py-1 text-xs font-black text-steel">Launch Runbook</span>
        </div>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {launchSteps.map((step, index) => (
            <div key={step.title} className="rounded-lg bg-mist p-3">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-ink">{index + 1}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black">{step.title}</p>
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-black ${stepMeta(step.done)}`}>{step.done ? "완료" : "대기"}</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold leading-5 text-steel">{step.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-pine/30 bg-pine/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-pine">Production Deploy Guard</p>
            <h3 className="mt-1 text-lg font-black">API 승인 후 운영 전환 명령</h3>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-steel">
              Vercel에 실제 키를 넣은 뒤에는 아래 명령 순서로만 배포하세요. `confirm`이 없으면 실제 배포와 데이터 작업은 시작하지 않고,
              환경변수와 운영 연결이 모두 통과해야 첫 후보 수집으로 넘어갑니다.
            </p>
            {deployRunbookCopyMessage ? <p className="mt-2 text-xs font-black text-pine">{deployRunbookCopyMessage}</p> : null}
          </div>
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-xs font-black text-white hover:bg-pine"
            onClick={copyProductionDeployRunbook}
            type="button"
          >
            <ClipboardCopy size={15} aria-hidden /> 운영 전환 명령 복사
          </button>
        </div>
        <div className="mt-3 grid gap-2 lg:grid-cols-3">
          <div className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-ink">
            <p className="font-black text-steel">1. 최신 값 점검</p>
            <p className="mt-1 break-all font-mono font-black">npm run doctor:production:launch:fresh</p>
          </div>
          <div className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-ink">
            <p className="font-black text-steel">2. 운영 배포</p>
            <p className="mt-1 break-all font-mono font-black">npm run deploy:production:launch -- confirm</p>
          </div>
          <div className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-ink">
            <p className="font-black text-steel">3. 첫 가동까지</p>
            <p className="mt-1 break-all font-mono font-black">npm run deploy:production:go-live -- confirm</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-line p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-black">Vercel 환경변수 입력표</h3>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-steel">
              최종승인 후 Vercel Environment Variables에 아래 키를 채우면 됩니다. API 키와 Supabase 키 값은 화면에 표시하지 않고, 공개 URL과 지금 만든 운영 보안값만 복사합니다.
            </p>
            {envCopyMessage ? <p className="mt-2 text-xs font-black text-pine">{envCopyMessage}</p> : null}
            {generatedSecrets.ADMIN_PASSWORD || generatedSecrets.CRON_SECRET ? (
              <div className="mt-3 rounded-lg border border-pine/30 bg-pine/5 p-3 text-xs font-bold text-ink">
                <p className="font-black text-pine">생성된 운영 보안값</p>
                <p className="mt-1 text-steel">이 값은 브라우저 화면에만 있고 저장하지 않습니다. Vercel에 붙여넣은 뒤 재배포하세요.</p>
                <div className="mt-2 grid gap-2">
                  {["ADMIN_PASSWORD", "CRON_SECRET"].map((name) =>
                    generatedSecrets[name] ? (
                      <div key={name} className="rounded-md bg-white px-2 py-1.5">
                        <span className="font-mono font-black">{name}=</span>
                        <span className="break-all font-mono">{generatedSecrets[name]}</span>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-pine px-3 py-2 text-xs font-black text-pine hover:bg-pine/10"
              onClick={generateOperationalSecrets}
              type="button"
            >
              <KeyRound size={15} aria-hidden /> 보안값 생성
            </button>
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-black hover:bg-mist"
              onClick={() => copyEnvTemplate("missing")}
              type="button"
            >
              <ClipboardCopy size={15} aria-hidden /> 누락 키만 복사
            </button>
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-xs font-black text-white hover:bg-pine"
              onClick={() => copyEnvTemplate("all")}
              type="button"
            >
              <ClipboardCopy size={15} aria-hidden /> 전체 템플릿 복사
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {vercelEnvRows.map((row) => {
            const configured = configuredEnvSet.has(row.name);
            const missing = missingEnvSet.has(row.name);
            const optionalMissing = optionalMissingEnvSet.has(row.name);
            const generatedValue = generatedSecrets[row.name];
            return (
              <div key={row.name} className="rounded-lg bg-mist p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-steel">{row.group}</p>
                    <p className="break-all font-mono text-xs font-black text-ink">{row.name}</p>
                  </div>
                  <span className={`rounded-md px-2 py-1 text-[11px] font-black ${configured ? "bg-pine/10 text-pine" : missing ? "bg-coral/10 text-coral" : optionalMissing ? "bg-lemon/30 text-ink" : "bg-white text-steel"}`}>
                    {configured ? "입력됨" : missing ? "필수 누락" : optionalMissing ? "선택 연동" : "확인필요"}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold leading-5 text-steel">{row.note}</p>
                {generatedValue ? <p className="mt-2 break-all font-mono text-xs font-bold text-pine">생성값: {generatedValue}</p> : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-lemon/40 bg-lemon/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-pine">Hourly Scheduler Readiness</p>
            <h3 className="mt-1 text-lg font-black">GitHub Actions 1시간 스케줄러 수동 확인</h3>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-steel">
              Vercel 앱은 GitHub Repository secret 값을 직접 읽을 수 없습니다. 승인 후 1시간 자동 운영을 쓰려면 GitHub에서
              `RETURNPICK_CRON_SECRET`과 `RETURNPICK_SITE_URL`을 한 번 확인하고 `ReturnPick Hourly Scheduler`를 수동 실행하세요.
            </p>
            {githubSchedulerCopyMessage ? <p className="mt-2 text-xs font-black text-pine">{githubSchedulerCopyMessage}</p> : null}
          </div>
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-xs font-black text-white hover:bg-pine"
            onClick={copyGithubSchedulerReadinessRunbook}
            type="button"
          >
            <ClipboardCopy size={15} aria-hidden /> GitHub 스케줄러 체크 복사
          </button>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <div className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-ink">
            <p className="font-black text-steel">Secret</p>
            <p className="mt-1 font-mono font-black">RETURNPICK_CRON_SECRET</p>
          </div>
          <div className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-ink">
            <p className="font-black text-steel">Variable</p>
            <p className="mt-1 font-mono font-black">RETURNPICK_SITE_URL</p>
          </div>
          <div className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-ink">
            <p className="font-black text-steel">Manual smoke test</p>
            <p className="mt-1 font-black">Actions에서 수동 실행 후 200 응답 확인</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-line p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-black">출시 필수 차단 항목</h3>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-steel">
              출시를 막는 필수 항목부터 보여주고, 준비도 API가 안내하는 다음 조치를 함께 표시합니다. 실제 환경변수 값은 이 화면에 노출하지 않습니다.
            </p>
          </div>
          <span className={readiness.blockingItemIds.length ? "rounded-md bg-coral/10 px-2 py-1 text-xs font-black text-coral" : "rounded-md bg-pine/10 px-2 py-1 text-xs font-black text-pine"}>
            {readiness.blockingItemIds.length ? `차단 ${readiness.blockingItemIds.length}건` : "필수 차단 없음"}
          </span>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {readinessItems.map((item) => {
          const isOptional = optionalItemIdSet.has(item.id) || (item.id === "coupang" && !readiness.apiKeysReady);
          const isLaunchBlocker = blockingItemIdSet.has(item.id);
          const meta = isOptional && item.state !== "ready"
            ? { label: "선택 대기", className: "bg-lemon/30 text-ink", icon: AlertTriangle }
            : stateMeta(item.state);
          return (
            <article key={item.id} className={`min-w-0 break-words rounded-lg border p-4 ${isLaunchBlocker ? "border-coral/40 bg-coral/5" : "border-line"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="text-pine" size={17} aria-hidden />
                  <h3 className="font-black">{item.label}</h3>
                  <span className={isLaunchBlocker ? "rounded-md bg-coral/10 px-2 py-0.5 text-[11px] font-black text-coral" : isOptional ? "rounded-md bg-lemon/30 px-2 py-0.5 text-[11px] font-black text-ink" : "rounded-md bg-mist px-2 py-0.5 text-[11px] font-black text-steel"}>
                    {isOptional ? "선택 기능" : "출시 필수"}
                  </span>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-black ${meta.className}`}>
                  <meta.icon size={14} aria-hidden /> {meta.label}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold leading-6 text-steel">{item.message}</p>
              {item.missingEnv.length ? (
                <p className={isOptional ? "mt-2 break-all text-xs font-black leading-5 text-ink" : "mt-2 break-all text-xs font-black leading-5 text-coral"}>
                  {isOptional ? "선택 연동 대기" : "누락"}: {item.missingEnv.join(", ")}
                </p>
              ) : (
                <p className="mt-2 text-xs font-black leading-5 text-pine">{isOptional ? "선택 기능 연결 완료" : "필수 값 입력 완료"}</p>
              )}
              <p className="mt-2 text-xs font-semibold leading-5 text-steel">{item.nextAction}</p>
            </article>
          );
        })}
        </div>
      </div>

      {checks.length ? (
        <div className="rounded-lg border border-line p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-black">최근 연결 테스트 결과</h3>
              {connectionReportMessage ? <p className="mt-1 text-xs font-black text-pine">{connectionReportMessage}</p> : null}
            </div>
            {failedConnectionCheckCount > 0 ? (
              <button
                className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-black hover:bg-mist"
                onClick={copyConnectionFailureReport}
                type="button"
              >
                <ClipboardCopy size={15} aria-hidden /> 실패 보고서 복사
              </button>
            ) : null}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {checks.map((check) => {
              const detailEntries = checkDetailEntries(check.detail);
              const operatorNextAction = operatorNextActionFromDetail(check.detail);
              const publicQualityBlockerSummary = publicQualityBlockerSummaryFromDetail(check.detail);
              const publicQualityMetricCards = check.id === "data_quality" ? publicQualityMetricCardsFromDetail(check.detail) : [];
              const publicQualityActionButtons = check.id === "data_quality" ? publicQualityActionButtonsFromDetail(check.detail) : [];
              return (
                <div key={check.id} className={`rounded-lg border p-3 ${checkMeta(check.status)}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black">{check.label}</p>
                    <span className="text-xs font-black uppercase">{check.status}</span>
                  </div>
                  <p className="mt-1 text-xs font-bold leading-5">{check.message}</p>
                  {operatorNextAction ? (
                    <div className="mt-3 rounded-lg bg-white/75 px-3 py-2 text-ink">
                      <p className="text-[11px] font-black uppercase tracking-wide text-pine">다음 조치</p>
                      <p className="mt-1 text-xs font-bold leading-5">{operatorNextAction}</p>
                    </div>
                  ) : null}
                  {publicQualityMetricCards.length ? (
                    <div className="mt-3 rounded-lg bg-white/75 px-3 py-2 text-ink">
                      <p className="text-[11px] font-black uppercase tracking-wide text-pine">공개 품질 운영 요약</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {publicQualityMetricCards.map((item) => (
                          <div key={item.label} className="rounded-md bg-mist px-2 py-1.5">
                            <p className="text-[11px] font-black text-steel">{item.label}</p>
                            <p className={`mt-0.5 text-sm font-black ${item.tone}`}>{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {publicQualityActionButtons.length ? (
                    <div className="mt-3 rounded-lg bg-white/75 px-3 py-2 text-ink">
                      <p className="text-[11px] font-black uppercase tracking-wide text-pine">바로 보강하기</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {publicQualityActionButtons.map((action) => (
                          <button
                            key={action.anchor}
                            className="focus-ring rounded-lg border border-line bg-white px-3 py-2 text-xs font-black hover:bg-mist"
                            onClick={() => scrollToAdminAnchor(action.anchor)}
                            title={action.helper}
                            type="button"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {publicQualityBlockerSummary.length ? (
                    <div className="mt-3 rounded-lg bg-white/75 px-3 py-2 text-ink">
                      <p className="text-[11px] font-black uppercase tracking-wide text-pine">품질 blocker 요약</p>
                      <div className="mt-2 space-y-1">
                        {publicQualityBlockerSummary.map((item) => (
                          <div key={item.blocker} className="flex items-center justify-between gap-3 rounded-md bg-mist px-2 py-1.5 text-xs font-bold">
                            <span className="min-w-0 break-words">{item.blocker}</span>
                            <span className="shrink-0 rounded-md bg-white px-2 py-0.5 font-black text-pine">{item.count}건</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {detailEntries.length ? (
                    <div className="mt-3 border-t border-current/15 pt-2">
                      <p className="text-[11px] font-black uppercase tracking-wide opacity-80">진단 세부정보</p>
                      <dl className="mt-2 space-y-1">
                        {detailEntries.map(([key, value]) => (
                          <div key={key} className="grid gap-1 rounded-md bg-white/65 px-2 py-1.5 text-[11px] sm:grid-cols-[120px_1fr]">
                            <dt className="break-all font-black opacity-80">{key}</dt>
                            <dd className="break-words font-mono font-bold">{formatCheckDetailValue(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
