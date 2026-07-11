"use client";

import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw, SearchCheck } from "lucide-react";

type Summary = {
  total: number;
  missing_naver_lowest_price: number;
  published_missing_naver_lowest_price: number;
  needs_review_missing_naver_lowest_price: number;
  naver_api_configured: boolean;
};

type BackfillResult = {
  status: string;
  target_count: number;
  checked_count: number;
  updated_count: number;
  no_match_count: number;
  error_count: number;
  details?: BackfillDetail[];
};

type BackfillDetail = {
  product_id: string;
  title: string;
  status: string;
  price?: number;
  query?: string;
  queries?: string[];
  reason?: string;
};

type BackfillResponse = {
  summary?: Summary;
  result?: BackfillResult;
  error?: string;
  message?: string;
};

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

function formatWon(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function noticeClassName(type: "info" | "success" | "error") {
  if (type === "error") return "border-coral/30 bg-coral/10 text-coral";
  if (type === "success") return "border-pine/30 bg-pine/10 text-pine";
  return "border-line bg-mist text-steel";
}

function resultMessage(result: BackfillResult) {
  if (result.status === "API_NOT_CONFIGURED") {
    return "NAVER_CLIENT_ID / NAVER_CLIENT_SECRET이 없어 실제 네이버 최저가를 채울 수 없습니다.";
  }

  const base = `${result.checked_count}개 확인, ${result.updated_count}개 보강, ${result.no_match_count}개 매칭 실패, ${result.error_count}개 오류`;
  if (result.status === "completed" && result.target_count === 0) return "보강할 상품이 없습니다. 실행 범위와 네이버 최저가 누락 여부를 확인하세요.";
  if (result.status === "completed_with_errors") return `${base} · 일부 오류가 있어 상세를 확인하세요.`;
  if (result.no_match_count > 0 && result.updated_count === 0) return `${base} · 상품명이나 모델명을 보완한 뒤 다시 시도하세요.`;
  return base;
}

function detailStatusLabel(status: string) {
  const labels: Record<string, string> = {
    updated: "가격 보강 완료",
    ok: "가격 보강 완료",
    no_match: "매칭 실패",
    error: "오류",
    API_NOT_CONFIGURED: "API 키 필요"
  };
  return labels[status] ?? status;
}

function detailStatusClassName(status: string) {
  if (status === "updated" || status === "ok") return "text-pine";
  if (status === "error" || status === "API_NOT_CONFIGURED") return "text-coral";
  return "text-steel";
}

function naverShoppingSearchUrl(query: string) {
  return `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(query)}`;
}

function detailQueries(detail: BackfillDetail) {
  return Array.from(new Set([detail.query, ...(detail.queries ?? [])].filter((query): query is string => Boolean(query?.trim())))).slice(0, 3);
}

export default function AdminPriceBackfillPanel({ password, onCompleted }: { password: string; onCompleted: () => void }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<{ type: "info" | "success" | "error"; message: string } | null>(null);
  const [lastResult, setLastResult] = useState<BackfillResult | null>(null);
  const [includeCandidates, setIncludeCandidates] = useState(true);

  async function loadSummary() {
    try {
      const response = await fetch("/api/admin/prices/backfill", { headers: headers(password) });
      const data = (await response.json().catch(() => ({}))) as BackfillResponse;
      if (!response.ok || !data.summary) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "네이버 최저가 보강 현황을 불러오지 못했습니다." });
        return;
      }
      setSummary(data.summary);
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 네이버 최저가 보강 현황을 불러오지 못했습니다." });
    }
  }

  useEffect(() => {
    void loadSummary();
  }, [password]);

  async function runBackfill() {
    setRunning(true);
    setLastResult(null);
    setNotice({ type: "info", message: includeCandidates ? "게시 상품과 검토 후보의 네이버 최저가 누락분을 보강 중입니다." : "게시 상품의 네이버 최저가 누락분을 보강 중입니다." });
    try {
      const response = await fetch("/api/admin/prices/backfill", {
        method: "POST",
        headers: headers(password),
        body: JSON.stringify({ publishedOnly: !includeCandidates, onlyMissing: true, limit: 40 })
      });
      const data = (await response.json().catch(() => ({}))) as BackfillResponse;
      const result = data.result;
      if (!response.ok || !result) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "보강 결과를 확인하지 못했습니다." });
        return;
      }
      setLastResult(result);
      setNotice({
        type: result.status === "completed_with_errors" || result.status === "API_NOT_CONFIGURED" ? "error" : "success",
        message: resultMessage(result)
      });
      await loadSummary();
      onCompleted();
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 네이버 최저가 보강을 실행하지 못했습니다." });
    } finally {
      setRunning(false);
    }
  }

  return (
    <section id="admin-price-backfill" className="scroll-mt-4 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black text-pine">Naver Price Backfill</p>
          <h2 className="text-lg font-black">네이버 최저가 보강</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-steel">
            비어 있는 네이버 최저가를 공식 네이버 쇼핑 API로 다시 검색합니다. API 키가 없으면 값을 임의로 채우지 않습니다.
          </p>
          <p className="mt-1 text-xs font-bold text-steel">
            게시 상품만 또는 검토 후보까지 포함해 최대 40개씩 처리하고, 매칭 검색어와 실패 사유를 남깁니다.
          </p>
          {notice ? (
            <p className={`mt-2 rounded-lg border px-3 py-2 text-sm font-bold ${noticeClassName(notice.type)}`} role="status" aria-live="polite">
              {notice.message}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button className="focus-ring rounded-lg border border-line p-2 hover:bg-mist" onClick={loadSummary} type="button" title="새로고침">
            <RefreshCw size={18} aria-hidden />
          </button>
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-black text-white hover:bg-pine disabled:opacity-60"
            onClick={runBackfill}
            disabled={running}
            type="button"
          >
            <SearchCheck size={16} aria-hidden /> 누락 최저가 보강
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-line bg-mist p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-steel">실행 범위</p>
            <p className="mt-1 text-sm font-bold text-ink">
              {includeCandidates ? "게시 상품 + 검토 후보" : "게시 상품만"}
            </p>
          </div>
          <label className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-black text-ink">
            <input checked={includeCandidates} onChange={(event) => setIncludeCandidates(event.target.checked)} type="checkbox" />
            검토 후보까지 포함
          </label>
        </div>
        <p className="mt-2 text-xs font-semibold leading-5 text-steel">
          후보까지 포함하면 승인 전 검토 테이블의 가격 기준도 함께 채워져 점수와 할인율 판단이 빨라집니다. API 호출량을 아끼려면 체크를 끄고 게시 상품만 보강하세요.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-5">
        <div className="rounded-lg bg-mist p-3">
          <p className="text-xs font-black text-steel">전체 상품</p>
          <p className="mt-1 text-xl font-black">{summary?.total ?? 0}</p>
        </div>
        <div className="rounded-lg bg-mist p-3">
          <p className="text-xs font-black text-steel">전체 누락</p>
          <p className="mt-1 text-xl font-black">{summary?.missing_naver_lowest_price ?? 0}</p>
        </div>
        <div className="rounded-lg bg-mist p-3">
          <p className="text-xs font-black text-steel">게시 상품 누락</p>
          <p className="mt-1 text-xl font-black">{summary?.published_missing_naver_lowest_price ?? 0}</p>
        </div>
        <div className="rounded-lg bg-mist p-3">
          <p className="text-xs font-black text-steel">검토 후보 누락</p>
          <p className="mt-1 text-xl font-black">{summary?.needs_review_missing_naver_lowest_price ?? 0}</p>
        </div>
        <div className="rounded-lg bg-mist p-3">
          <p className="text-xs font-black text-steel">API 상태</p>
          <p className={summary?.naver_api_configured ? "mt-1 text-xl font-black text-pine" : "mt-1 text-xl font-black text-coral"}>
            {summary?.naver_api_configured ? "연결됨" : "키 필요"}
          </p>
        </div>
      </div>

      {lastResult?.details?.length ? (
        <div className="mt-4 rounded-lg border border-line">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-mist px-3 py-2">
            <p className="text-xs font-black text-steel">최근 보강 상세</p>
            <p className="text-xs font-bold text-steel">
              대상 {lastResult.target_count}개 · 확인 {lastResult.checked_count}개
            </p>
          </div>
          <div className="divide-y divide-line">
            {lastResult.details.slice(0, 6).map((detail) => {
              const queries = detailQueries(detail);
              const primaryQuery = queries[0];
              return (
                <div key={`${detail.product_id}-${detail.status}`} className="grid gap-2 px-3 py-2 text-xs sm:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-black text-ink">{detail.title}</p>
                    <p className="mt-1 font-bold text-steel">
                      <span className={detailStatusClassName(detail.status)}>{detailStatusLabel(detail.status)}</span>
                      {primaryQuery ? ` · ${primaryQuery}` : ""}
                    </p>
                    {detail.reason ? <p className="mt-1 font-bold text-coral">{detail.reason}</p> : null}
                    {queries.length ? (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="font-black text-steel">재검색어</span>
                        {queries.map((query) => (
                          <a
                            key={query}
                            className="focus-ring inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 font-bold text-steel hover:bg-mist"
                            href={naverShoppingSearchUrl(query)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {query}
                            <ExternalLink size={12} aria-hidden />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <p className={detail.price ? "font-black text-pine" : "font-black text-steel"}>{detail.price ? formatWon(detail.price) : "가격 미확정"}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
