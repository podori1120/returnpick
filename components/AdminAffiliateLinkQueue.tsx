"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, Link2, RefreshCw, Search, Upload, Wand2 } from "lucide-react";
import { getCategoryLabel } from "@/lib/category";
import { buildCoupangSearchUrl, isApprovalSampleAffiliateUrl, isCoupangPartnersLink, isUsableAffiliateUrl } from "@/lib/coupangLink";
import { formatPrice } from "@/lib/format";
import type { ProductWithScore } from "@/lib/types";

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

type SaveMode = "save" | "publish";
type BackfillMatchEvidence = {
  relevance_score?: number;
  min_relevance?: number;
  matched_tokens?: string[];
  candidate_count?: number;
  url_candidate_count?: number;
  relevance_candidate_count?: number;
  rejected_by_relevance_count?: number;
};

type BackfillResultItem = {
  product_id: string;
  title: string;
  status: string;
  reason?: string;
  query?: string | null;
  source_url?: string | null;
  manual_search_url?: string | null;
  matched_title?: string | null;
  match?: BackfillMatchEvidence | null;
};

type BackfillResult = {
  status: string;
  scanned_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  items?: BackfillResultItem[];
};

type ProductsResponse = {
  products?: ProductWithScore[];
  error?: string;
  message?: string;
};

type BackfillResponse = BackfillResult & {
  error?: string;
  message?: string;
};

type BulkImportResult = {
  status: string;
  scanned_count: number;
  valid_count?: number;
  updated_count: number;
  published_count?: number;
  skipped_count: number;
  error_count: number;
  dry_run?: boolean;
  publish_requested?: boolean;
  items?: Array<{ product_id: string; title?: string | null; status: string; reason?: string; affiliate_url?: string | null }>;
};

type BulkImportResponse = BulkImportResult & {
  error?: string;
  message?: string;
};

type AffiliateLinkVerification = {
  ok: boolean;
  code: string;
  message: string;
  final_url?: string;
  product_id?: string;
  http_status?: number;
  redirect_count: number;
  checked_at: string;
};

type AffiliateLinkVerificationResponse = {
  verification?: AffiliateLinkVerification;
  error?: string;
  message?: string;
};

function noticeClassName(type: "info" | "success" | "error") {
  if (type === "error") return "border-coral/30 bg-coral/10 text-coral";
  if (type === "success") return "border-pine/30 bg-pine/10 text-pine";
  return "border-line bg-mist text-steel";
}

function backfillMessage(result: BackfillResult) {
  const base = `확인 ${result.scanned_count}개, 저장 ${result.updated_count}개, 건너뜀 ${result.skipped_count}개, 오류 ${result.error_count}개`;
  if (result.status === "API_NOT_CONFIGURED") return `쿠팡 파트너스 API 키가 없어 자동 보강은 대기 상태입니다. ${base}`;
  if (result.status === "partial" || result.status === "error") return `파트너스 링크 자동 보강 일부 실패: ${base}`;
  return `파트너스 링크 자동 보강 완료: ${base}`;
}

function bulkImportMessage(result: BulkImportResult) {
  const valid = result.dry_run ? `, 저장 가능 ${result.valid_count ?? 0}개` : "";
  const published = result.published_count ? `, 게시 ${result.published_count}개` : "";
  const base = `확인 ${result.scanned_count}줄${valid}, 저장 ${result.updated_count}개${published}, 건너뜀 ${result.skipped_count}개, 오류 ${result.error_count}개`;
  if (result.dry_run) return `대량 링크 검증 완료: ${base}`;
  if (result.status === "partial" || result.status === "error") return `대량 링크 입력 일부 실패: ${base}`;
  return `대량 링크 입력 완료: ${base}`;
}

function linkResultStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ok: "완료",
    partial: "일부 완료",
    error: "실패",
    API_NOT_CONFIGURED: "API 키 필요",
    updated: "저장 완료",
    valid: "검증 통과",
    dry_run: "저장 가능",
    skipped: "건너뜀"
  };
  return labels[status] ?? status;
}

function linkResultStatusClassName(status: string) {
  if (status === "ok" || status === "updated" || status === "valid" || status === "dry_run") return "text-pine";
  if (status === "error" || status === "API_NOT_CONFIGURED") return "text-coral";
  return "text-steel";
}

function linkResultReasonLabel(reason?: string | null) {
  if (!reason) return null;
  if (reason === "COUPANG_API_NOT_CONFIGURED") return "쿠팡 파트너스 API 키가 아직 없습니다.";
  if (reason === "PRODUCT_ID_AND_LINK_REQUIRED") return "상품 ID와 파트너스 링크가 모두 필요합니다.";
  if (reason === "DUPLICATE_PRODUCT_ID") return "같은 상품 ID가 중복 입력되었습니다.";
  if (reason === "APPROVAL_SAMPLE_LINK_NOT_ALLOWED") return "승인용 샘플 링크는 실상품에 사용할 수 없습니다.";
  if (reason === "PRODUCT_NOT_FOUND") return "해당 상품 ID를 찾지 못했습니다.";
  if (reason === "PUBLISHED") return "저장 후 게시까지 완료했습니다.";
  if (reason === "INVALID_AFFILIATE_URL") return "상품별 쿠팡 파트너스 단축 링크 형식이 아닙니다.";
  if (reason.startsWith("PUBLISH_BLOCKED_PUBLIC_QUALITY")) return `링크는 저장했지만 게시 전 품질 확인이 필요합니다. ${reason.split(":").slice(1).join(":").trim()}`;
  if (reason.startsWith("DIRECT_DEEPLINK_FAILED")) return "기존 쿠팡 URL을 파트너스 링크로 변환하지 못했습니다.";
  if (reason.includes("COUPANG_MATCH_RELEVANCE_TOO_LOW") || reason.includes("MATCH_RELEVANCE_TOO_LOW")) return "쿠팡 검색 결과의 상품명/스펙 관련도가 낮아 자동 저장하지 않았습니다.";
  if (reason.includes("NO_USABLE_PARTNERS_URL")) return "API 응답에서 사용할 수 있는 파트너스 링크를 찾지 못했습니다.";
  if (reason.includes("NO_PRODUCT_URL")) return "매칭 상품에 변환 가능한 쿠팡 상품 URL이 없습니다.";
  if (reason.includes("NO_MATCH")) return "쿠팡 검색에서 매칭 상품을 찾지 못했습니다.";
  if (reason.startsWith("AFFILIATE_BACKFILL_UPDATE_FAILED")) return "파트너스 링크를 DB에 저장하지 못했습니다.";
  return reason.slice(0, 180);
}

function backfillMatchSummary(item: BackfillResultItem) {
  const match = item.match;
  if (!match) return null;

  const score = match.relevance_score ?? 0;
  const minScore = match.min_relevance ?? 0;
  const tokens = match.matched_tokens?.filter(Boolean).slice(0, 4).join(", ");
  const parts = [`관련도 ${score}/${minScore}`];
  if (tokens) parts.push(`매칭 ${tokens}`);
  if (typeof match.url_candidate_count === "number") parts.push(`URL 후보 ${match.url_candidate_count}개`);
  if (typeof match.rejected_by_relevance_count === "number" && match.rejected_by_relevance_count > 0) {
    parts.push(`관련도 제외 ${match.rejected_by_relevance_count}개`);
  }
  return parts.join(" · ");
}

function backfillResultLinks(item: BackfillResultItem) {
  const links = [
    item.manual_search_url ? { href: item.manual_search_url, label: "쿠팡 검색 열기" } : null,
    item.source_url && item.source_url !== item.manual_search_url ? { href: item.source_url, label: "원본 보기" } : null
  ].filter((link): link is { href: string; label: string } => Boolean(link));
  return links.slice(0, 2);
}

function backfillManualItems(result: BackfillResult | null) {
  return (
    result?.items
      ?.filter((item) => item.status === "skipped" || item.status === "error")
      .slice(0, 24) ?? []
  );
}

function buildBackfillManualTemplate(result: BackfillResult | null) {
  return backfillManualItems(result)
    .map((item) => {
      const title = item.matched_title ?? item.title;
      const referenceUrl = item.manual_search_url ?? item.source_url ?? "";
      return `${item.product_id}\t상품별 파트너스 링크 붙여넣기\t${title}\t${referenceUrl}`;
    })
    .join("\n");
}

export default function AdminAffiliateLinkQueue({
  password,
  refreshToken,
  onCompleted
}: {
  password: string;
  refreshToken: number;
  onCompleted: () => void;
}) {
  const [products, setProducts] = useState<ProductWithScore[]>([]);
  const [query, setQuery] = useState("");
  const [publishedOnly, setPublishedOnly] = useState(false);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [bulkText, setBulkText] = useState("");
  const [bulkPublish, setBulkPublish] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null);
  const [bulkImportRunning, setBulkImportRunning] = useState(false);
  const [bulkImportResult, setBulkImportResult] = useState<BulkImportResult | null>(null);
  const [checkingLinkId, setCheckingLinkId] = useState<string | null>(null);
  const [linkVerifications, setLinkVerifications] = useState<Record<string, AffiliateLinkVerification & { checked_url: string }>>({});
  const [notice, setNotice] = useState<{ type: "info" | "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadProducts() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/products", { headers: headers(password) });
      const data = (await response.json().catch(() => ({}))) as ProductsResponse;
      if (!response.ok || !Array.isArray(data.products)) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "파트너스 링크 보강 대상을 불러오지 못했습니다." });
        return;
      }
      const nextProducts = data.products;
      setProducts(nextProducts);
      setInputs((current) => ({
        ...Object.fromEntries(nextProducts.map((product) => [product.id, product.affiliate_url ?? ""])),
        ...current
      }));
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 파트너스 링크 보강 대상을 불러오지 못했습니다." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, [password, refreshToken]);

  const missingProducts = useMemo(
    () =>
      products
        .filter((product) => !isUsableAffiliateUrl(product.affiliate_url))
        .filter((product) => (publishedOnly ? product.is_published || product.sourcing_status === "published" : true))
        .filter((product) => (query ? product.title.toLowerCase().includes(query.toLowerCase()) : true))
        .sort((a, b) => {
          const aPublished = a.is_published || a.sourcing_status === "published" ? 1 : 0;
          const bPublished = b.is_published || b.sourcing_status === "published" ? 1 : 0;
          return bPublished - aPublished || (b.latest_score?.total_score ?? 0) - (a.latest_score?.total_score ?? 0);
        }),
    [products, publishedOnly, query]
  );
  const publicReadyCount = products.filter((product) => product.is_published && product.sourcing_status === "published" && isUsableAffiliateUrl(product.affiliate_url)).length;
  const hiddenPublishedCount = products.filter((product) => (product.is_published || product.sourcing_status === "published") && !isUsableAffiliateUrl(product.affiliate_url)).length;
  const visibleProducts = missingProducts.slice(0, 24);

  async function copyTitle(product: ProductWithScore) {
    await navigator.clipboard.writeText(product.title);
    setCopiedId(product.id);
    window.setTimeout(() => setCopiedId((current) => (current === product.id ? null : current)), 1500);
  }

  async function verifyAffiliateUrl(product: ProductWithScore) {
    const affiliateUrl = inputs[product.id]?.trim() ?? "";
    if (!isCoupangPartnersLink(affiliateUrl)) {
      setLinkVerifications((current) => ({
        ...current,
        [product.id]: {
          ok: false,
          code: "INVALID_AFFILIATE_URL",
          message: "https://link.coupang.com/a/... 형식의 파트너스 링크를 먼저 입력하세요.",
          redirect_count: 0,
          checked_at: new Date().toISOString(),
          checked_url: affiliateUrl
        }
      }));
      return;
    }

    setCheckingLinkId(product.id);
    setLinkVerifications((current) => {
      const next = { ...current };
      delete next[product.id];
      return next;
    });
    try {
      const response = await fetch("/api/admin/affiliate-links/verify", {
        method: "POST",
        headers: headers(password),
        body: JSON.stringify({ affiliate_url: affiliateUrl })
      });
      const data = (await response.json().catch(() => ({}))) as AffiliateLinkVerificationResponse;
      if (!response.ok || !data.verification) {
        setLinkVerifications((current) => ({
          ...current,
          [product.id]: {
            ok: false,
            code: data.error ?? "LINK_VERIFICATION_FAILED",
            message: data.message ?? "링크 목적지를 확인하지 못했습니다.",
            redirect_count: 0,
            checked_at: new Date().toISOString(),
            checked_url: affiliateUrl
          }
        }));
        return;
      }
      setLinkVerifications((current) => ({ ...current, [product.id]: { ...data.verification!, checked_url: affiliateUrl } }));
    } catch {
      setLinkVerifications((current) => ({
        ...current,
        [product.id]: {
          ok: false,
          code: "LINK_VERIFICATION_NETWORK_ERROR",
          message: "네트워크 문제로 링크 목적지를 확인하지 못했습니다.",
          redirect_count: 0,
          checked_at: new Date().toISOString(),
          checked_url: affiliateUrl
        }
      }));
    } finally {
      setCheckingLinkId(null);
    }
  }

  function buildBulkTemplate() {
    return missingProducts
      .slice(0, 24)
      .map((product) => `${product.id}\t${product.title}\t${buildCoupangSearchUrl(product)}`)
      .join("\n");
  }

  async function copyBulkTemplate() {
    const template = buildBulkTemplate();
    if (!template) {
      setNotice({ type: "info", message: "현재 복사할 링크 보강 대상이 없습니다." });
      return;
    }
    setBulkText(template);
    try {
      await navigator.clipboard.writeText(template);
      setNotice({ type: "success", message: "대량 입력 템플릿을 복사했습니다. 각 줄의 상품 ID 옆에 상품별 파트너스 링크를 붙여넣으세요." });
    } catch {
      setNotice({ type: "info", message: "브라우저가 클립보드 복사를 막아 템플릿을 입력창에만 채웠습니다." });
    }
  }

  async function fillBackfillFailuresTemplate() {
    const template = buildBackfillManualTemplate(backfillResult);
    if (!template) {
      setNotice({ type: "info", message: "대량 입력으로 넘길 자동 보강 실패 항목이 없습니다." });
      return;
    }
    setBulkText(template);
    try {
      await navigator.clipboard.writeText(template);
      setNotice({ type: "success", message: "자동 보강 실패 항목을 대량 입력 템플릿으로 옮겼습니다. 각 줄의 빈칸에 상품별 파트너스 링크를 붙여넣으세요." });
    } catch {
      setNotice({ type: "info", message: "자동 보강 실패 항목을 대량 입력창에 채웠습니다. 각 줄의 빈칸에 상품별 파트너스 링크를 붙여넣으세요." });
    }
  }

  async function runBulkImport(mode: "dry_run" | "save") {
    if (!bulkText.trim()) {
      setNotice({ type: "error", message: "상품 ID와 쿠팡 파트너스 링크가 들어간 줄을 붙여넣어 주세요." });
      return;
    }
    setBulkImportRunning(true);
    setBulkImportResult(null);
    setNotice({ type: "info", message: mode === "dry_run" ? "상품별 파트너스 링크를 저장 전 검증 중입니다." : "상품별 파트너스 링크를 대량 저장 중입니다." });
    try {
      const response = await fetch("/api/admin/affiliate-links/import", {
        method: "POST",
        headers: headers(password),
        body: JSON.stringify({ entries: bulkText, dryRun: mode === "dry_run", publish: mode === "save" && bulkPublish })
      });
      const data = (await response.json().catch(() => ({}))) as BulkImportResponse;
      if (!response.ok) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "대량 링크 입력에 실패했습니다." });
        return;
      }
      setBulkImportResult(data);
      setNotice({ type: data.status === "ok" ? "success" : "error", message: bulkImportMessage(data) });
      if (mode === "save") {
        await loadProducts();
        onCompleted();
      }
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 대량 링크 입력을 실행하지 못했습니다." });
    } finally {
      setBulkImportRunning(false);
    }
  }

  async function saveAffiliateUrl(product: ProductWithScore, mode: SaveMode) {
    const affiliateUrl = inputs[product.id]?.trim() ?? "";
    if (!isUsableAffiliateUrl(affiliateUrl)) {
      setNotice({ type: "error", message: "상품별 쿠팡 파트너스 링크를 입력하세요. 예: https://link.coupang.com/a/..." });
      return;
    }
    if (isApprovalSampleAffiliateUrl(affiliateUrl)) {
      setNotice({ type: "error", message: "승인용 샘플 링크는 심사용 페이지 전용입니다. 이 상품의 상품별 파트너스 링크를 새로 입력하세요." });
      return;
    }
    setSavingId(product.id);
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: headers(password),
        body: JSON.stringify(mode === "publish" ? { affiliate_url: affiliateUrl, action: "publish" } : { affiliate_url: affiliateUrl })
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
        setNotice({ type: "error", message: data.message ?? data.error ?? "파트너스 링크 저장에 실패했습니다." });
        return;
      }
      setNotice({ type: "success", message: mode === "publish" ? "파트너스 링크를 저장하고 게시했습니다." : "파트너스 링크를 저장했습니다." });
      await loadProducts();
      onCompleted();
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 파트너스 링크를 저장하지 못했습니다." });
    } finally {
      setSavingId(null);
    }
  }

  async function runApiBackfill() {
    setBackfillRunning(true);
    setBackfillResult(null);
    setNotice({ type: "info", message: "쿠팡 API로 상품별 파트너스 링크를 보강 중입니다." });
    try {
      const response = await fetch("/api/admin/affiliate-links/backfill", {
        method: "POST",
        headers: headers(password),
        body: JSON.stringify({ limit: 24 })
      });
      const data = (await response.json().catch(() => ({}))) as BackfillResponse;
      if (!response.ok) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "API 기반 파트너스 링크 보강에 실패했습니다." });
        return;
      }
      setBackfillResult(data);
      setNotice({
        type: data.status === "ok" ? "success" : "error",
        message: backfillMessage(data)
      });
      await loadProducts();
      onCompleted();
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 API 기반 파트너스 링크 보강을 실행하지 못했습니다." });
    } finally {
      setBackfillRunning(false);
    }
  }

  const backfillManualItemCount = backfillManualItems(backfillResult).length;

  return (
    <section id="admin-affiliate-links" className="scroll-mt-4 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-pine">Affiliate Link Queue</p>
          <h2 className="text-xl font-black">상품별 파트너스 링크 보강</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-steel">
            승인 대기 중에는 쿠팡 파트너스 웹에서 상품별 링크를 직접 만들고 여기에 붙여넣습니다. 링크가 준비된 상품만 공개 딜과 구매 CTA에 노출됩니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-3 py-2 text-sm font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
            onClick={runApiBackfill}
            disabled={backfillRunning}
            type="button"
          >
            <Wand2 size={15} aria-hidden /> API로 24개 자동 보강
          </button>
          <button className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-black hover:bg-mist disabled:opacity-60" onClick={loadProducts} disabled={loading} type="button">
            <RefreshCw size={15} aria-hidden /> {loading ? "불러오는 중" : "새로고침"}
          </button>
        </div>
      </div>

      {notice ? (
        <p className={`mt-4 rounded-lg border px-3 py-2 text-sm font-bold ${noticeClassName(notice.type)}`} role="status" aria-live="polite">
          {notice.message}
        </p>
      ) : null}

      {backfillResult ? (
        <div className="mt-4 rounded-lg border border-line bg-mist p-4 text-sm font-bold text-steel">
          <p className="font-black text-ink">
            API 자동 보강 결과: <span className={linkResultStatusClassName(backfillResult.status)}>{linkResultStatusLabel(backfillResult.status)}</span> · 확인 {backfillResult.scanned_count}개 · 저장 {backfillResult.updated_count}개 · 건너뜀{" "}
            {backfillResult.skipped_count}개 · 오류 {backfillResult.error_count}개
          </p>
          {backfillResult.status === "API_NOT_CONFIGURED" ? (
            <p className="mt-2 text-coral">쿠팡 파트너스 API 키가 아직 없어 자동 보강은 대기 상태입니다. 최종승인 후 API 키를 넣고 다시 실행하세요.</p>
          ) : null}
          {backfillManualItemCount ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-black text-ink hover:bg-mist"
                onClick={fillBackfillFailuresTemplate}
                type="button"
              >
                <Copy size={13} aria-hidden /> 실패 {backfillManualItemCount}개 대량 입력으로 보내기
              </button>
              <span className="text-xs font-bold text-steel">검색 URL은 참고용입니다. 쿠팡 파트너스에서 만든 상품별 링크로 바꿔 붙여넣으세요.</span>
            </div>
          ) : null}
          {backfillResult.items?.slice(0, 3).length ? (
            <ul className="mt-2 space-y-1 text-xs">
              {backfillResult.items.slice(0, 3).map((item) => {
                const resultLinks = backfillResultLinks(item);
                const matchSummary = backfillMatchSummary(item);
                return (
                  <li key={`${item.product_id}-${item.status}`}>
                    <span className={`font-black ${linkResultStatusClassName(item.status)}`}>{linkResultStatusLabel(item.status)}</span>:{" "}
                    {item.matched_title ?? item.title}
                    {item.query ? <span className="text-steel"> · 검색어 {item.query}</span> : null}
                    {matchSummary ? <span className="text-steel"> · {matchSummary}</span> : null}
                    {linkResultReasonLabel(item.reason) ? <span className="text-coral"> · {linkResultReasonLabel(item.reason)}</span> : null}
                    {resultLinks.length ? (
                      <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                        {resultLinks.map((link) => (
                          <a
                            className="focus-ring inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 font-black text-ink hover:bg-mist"
                            href={link.href}
                            key={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink size={12} aria-hidden /> {link.label}
                          </a>
                        ))}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-line bg-mist p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black">대량 링크 입력</h3>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-steel">
              여러 상품을 한 번에 보강할 때는 각 줄에 상품 ID와 상품별 쿠팡 파트너스 링크를 함께 붙여넣으세요. 제목은 참고용이며 저장 기준은 상품 ID입니다.
            </p>
          </div>
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-black hover:bg-mist disabled:opacity-60"
            onClick={copyBulkTemplate}
            disabled={!missingProducts.length}
            type="button"
          >
            <Copy size={15} aria-hidden /> 템플릿 복사
          </button>
        </div>
        <textarea
          className="focus-ring mt-3 min-h-28 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
          value={bulkText}
          onChange={(event) => setBulkText(event.target.value)}
          placeholder={`상품ID\thttps://link.coupang.com/a/상품별링크\n예: 33f28f30-79f6-425e-ac6b-275bc330d620\thttps://link.coupang.com/a/...`}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-2 text-xs font-bold text-steel">
            <p>승인용 샘플 링크와 일반 쿠팡 상품 URL은 저장하지 않습니다. 한 번에 최대 80줄까지 처리합니다.</p>
            <label className="inline-flex items-center gap-2">
              <input checked={bulkPublish} onChange={(event) => setBulkPublish(event.target.checked)} type="checkbox" />
              저장한 상품을 바로 게시 상태로 전환
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-black hover:bg-mist disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => runBulkImport("dry_run")}
              disabled={bulkImportRunning || !bulkText.trim()}
              type="button"
            >
              {bulkImportRunning ? "확인 중" : "검증만"}
            </button>
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-4 py-2 text-sm font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => runBulkImport("save")}
              disabled={bulkImportRunning || !bulkText.trim()}
              type="button"
            >
              <Upload size={15} aria-hidden /> {bulkImportRunning ? "저장 중" : bulkPublish ? "대량 저장 후 게시" : "대량 저장"}
            </button>
          </div>
        </div>
        {bulkImportResult ? (
          <div className="mt-3 rounded-lg border border-line bg-white p-3 text-sm font-bold text-steel">
            <p className="font-black text-ink">
              대량 입력 결과: <span className={linkResultStatusClassName(bulkImportResult.status)}>{linkResultStatusLabel(bulkImportResult.status)}</span> · 확인 {bulkImportResult.scanned_count}줄
              {bulkImportResult.dry_run ? ` · 저장 가능 ${bulkImportResult.valid_count ?? 0}개` : ""} · 저장 {bulkImportResult.updated_count}개
              {bulkImportResult.published_count ? ` · 게시 ${bulkImportResult.published_count}개` : ""} · 건너뜀 {bulkImportResult.skipped_count}개 · 오류 {bulkImportResult.error_count}개
            </p>
            {bulkImportResult.items?.slice(0, 4).length ? (
              <ul className="mt-2 space-y-1 text-xs">
                {bulkImportResult.items.slice(0, 4).map((item, index) => (
                  <li key={`${item.product_id}-${index}`}>
                    <span className={`font-black ${linkResultStatusClassName(item.status)}`}>{linkResultStatusLabel(item.status)}</span>:{" "}
                    {item.title ?? item.product_id}
                    {linkResultReasonLabel(item.reason) ? <span className="text-coral"> · {linkResultReasonLabel(item.reason)}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-mist p-4">
          <p className="text-xs font-black text-steel">보강 필요</p>
          <p className="mt-1 text-2xl font-black">{missingProducts.length.toLocaleString("ko-KR")}개</p>
        </div>
        <div className="rounded-lg border border-line bg-mist p-4">
          <p className="text-xs font-black text-steel">공개 숨김 상태</p>
          <p className="mt-1 text-2xl font-black">{hiddenPublishedCount.toLocaleString("ko-KR")}개</p>
        </div>
        <div className="rounded-lg border border-line bg-mist p-4">
          <p className="text-xs font-black text-steel">공개 가능</p>
          <p className="mt-1 text-2xl font-black">{publicReadyCount.toLocaleString("ko-KR")}개</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel" size={16} aria-hidden />
          <input
            className="focus-ring w-full rounded-lg border border-line py-2 pl-9 pr-3 text-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="상품명으로 보강 대상 검색"
          />
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-bold text-steel">
          <input checked={publishedOnly} onChange={(event) => setPublishedOnly(event.target.checked)} type="checkbox" />
          기존 게시 상품 먼저
        </label>
      </div>

      <div className="mt-4 space-y-3">
        {visibleProducts.map((product) => {
          const inputValue = inputs[product.id] ?? "";
          const approvalSampleAffiliate = isApprovalSampleAffiliateUrl(inputValue);
          const linkReady = isUsableAffiliateUrl(inputValue) && !approvalSampleAffiliate;
          const verification = linkVerifications[product.id]?.checked_url === inputValue.trim() ? linkVerifications[product.id] : null;
          const searchUrl = buildCoupangSearchUrl(product);
          return (
            <article key={product.id} className="rounded-lg border border-line p-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-black">
                    <span className="rounded-md bg-mist px-2 py-1 text-steel">{getCategoryLabel(product.category)}</span>
                    <span className="rounded-md bg-lemon/30 px-2 py-1 text-ink">{product.sourcing_status}</span>
                    <span className="rounded-md bg-pine/10 px-2 py-1 text-pine">{product.latest_score?.total_score ?? 0}점</span>
                  </div>
                  <h3 className="mt-2 line-clamp-2 text-sm font-black">{product.title}</h3>
                  <p className="mt-1 text-xs font-bold text-steel">
                    판매가 {formatPrice(product.return_price ?? product.source_price)} · 네이버 {formatPrice(product.naver_lowest_price)} · 재고{" "}
                    {product.stock_count ?? "확인필요"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-black hover:bg-mist"
                      href={searchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={14} aria-hidden /> 쿠팡에서 상품 찾기
                    </a>
                    <button className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-black hover:bg-mist" onClick={() => copyTitle(product)} type="button">
                      <Copy size={14} aria-hidden /> {copiedId === product.id ? "복사됨" : "상품명 복사"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-black text-steel">
                    상품별 파트너스 URL
                    <input
                      className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink"
                      value={inputValue}
                      onChange={(event) => {
                        setInputs((current) => ({ ...current, [product.id]: event.target.value }));
                        setLinkVerifications((current) => {
                          const next = { ...current };
                          delete next[product.id];
                          return next;
                        });
                      }}
                      placeholder="https://link.coupang.com/a/..."
                    />
                  </label>
                  <p className={linkReady ? "mt-2 text-xs font-bold text-pine" : "mt-2 text-xs font-bold text-coral"}>
                    {linkReady
                      ? "저장하면 구매 CTA 공개 준비가 됩니다. 실제 상품 확인 후 저장하는 것을 권장합니다."
                      : approvalSampleAffiliate
                        ? "승인용 샘플 링크는 이 상품에 저장하거나 게시할 수 없습니다."
                        : "쿠팡 파트너스에서 만든 상품별 링크를 붙여넣어 주세요."}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button
                      className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-black hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => verifyAffiliateUrl(product)}
                      disabled={!isCoupangPartnersLink(inputValue) || checkingLinkId !== null}
                      type="button"
                    >
                      <RefreshCw className={checkingLinkId === product.id ? "animate-spin" : ""} size={14} aria-hidden />
                      {checkingLinkId === product.id ? "목적지 확인 중" : "자동 목적지 확인"}
                    </button>
                    {isCoupangPartnersLink(inputValue) ? (
                      <a
                        className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-black hover:bg-mist"
                        href={inputValue}
                        target="_blank"
                        rel="nofollow sponsored noopener noreferrer"
                      >
                        <ExternalLink size={14} aria-hidden /> 브라우저로 직접 열기
                      </a>
                    ) : (
                      <button
                        className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-black opacity-50"
                        disabled
                        type="button"
                      >
                        <ExternalLink size={14} aria-hidden /> 브라우저로 직접 열기
                      </button>
                    )}
                  </div>
                  {verification ? (
                    <div
                      className={
                        verification.ok
                          ? "mt-2 rounded-lg bg-pine/10 p-3 text-xs font-bold text-pine"
                          : verification.code === "INVALID_AFFILIATE_URL" || verification.code === "REDIRECT_BLOCKED"
                            ? "mt-2 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700"
                            : "mt-2 rounded-lg bg-lemon/30 p-3 text-xs font-bold text-ink"
                      }
                      role="status"
                      aria-live="polite"
                    >
                      <p>{verification.message}</p>
                      {verification.product_id ? (
                        <p className="mt-1">상품번호 {verification.product_id} · HTTP {verification.http_status ?? "확인필요"} · 이동 {verification.redirect_count}회</p>
                      ) : null}
                      <p className="mt-1 font-semibold">자동 확인 결과는 참고 신호이며 저장·게시의 강제 차단 조건은 아닙니다.</p>
                    </div>
                  ) : null}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button
                      className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-black hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => saveAffiliateUrl(product, "save")}
                      disabled={!linkReady || savingId === product.id}
                      type="button"
                    >
                      <Link2 size={14} aria-hidden /> 링크 저장
                    </button>
                    <button
                      className="focus-ring rounded-lg bg-pine px-3 py-2 text-xs font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => saveAffiliateUrl(product, "publish")}
                      disabled={!linkReady || savingId === product.id}
                      type="button"
                    >
                      저장 후 게시
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        {!visibleProducts.length ? (
          <div className="rounded-lg border border-line bg-mist p-6 text-center text-sm font-bold text-steel">현재 조건에 맞는 링크 보강 대상이 없습니다.</div>
        ) : null}
      </div>
    </section>
  );
}
