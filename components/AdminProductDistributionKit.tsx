"use client";

import Link from "next/link";
import { Copy, ExternalLink, FileText, Megaphone, MessageCircle, RefreshCw, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ProductDistributionKit } from "@/lib/productDistributionKit";
import type { ProductWithScore } from "@/lib/types";

type Notice = { type: "info" | "success" | "error"; message: string };

type ApiResponse = {
  kit?: ProductDistributionKit;
  products?: ProductWithScore[];
  status?: string;
  message?: string;
  error?: string;
  blockers?: string[];
  warnings?: string[];
};

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

function noticeClassName(type: Notice["type"]) {
  if (type === "error") return "border-coral/30 bg-coral/10 text-coral";
  if (type === "success") return "border-pine/30 bg-pine/10 text-pine";
  return "border-line bg-mist text-steel";
}

export default function AdminProductDistributionKit({ password, refreshToken }: { password: string; refreshToken: number }) {
  const [products, setProducts] = useState<ProductWithScore[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [kit, setKit] = useState<ProductDistributionKit | null>(null);
  const [activeChannel, setActiveChannel] = useState<"telegram" | "naverBlog">("telegram");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [running, setRunning] = useState<"load" | "kit" | "copy" | "send" | null>(null);

  const loadProducts = useCallback(async () => {
    setRunning("load");
    try {
      const response = await fetch("/api/admin/products?published=true&status=published&customer_ready=true", { headers: headers(password), cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok || !Array.isArray(data.products)) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "공개 상품 목록을 불러오지 못했습니다." });
        return;
      }

      const nextProducts = data.products.sort((a, b) => (b.latest_score?.total_score ?? 0) - (a.latest_score?.total_score ?? 0));
      setProducts(nextProducts);
      setSelectedProductId((current) => (current && nextProducts.some((product) => product.id === current) ? current : nextProducts[0]?.id ?? ""));
      if (!nextProducts.length) {
        setNotice({ type: "info", message: "아직 공개 상품이 없습니다. 고객공개 품질을 통과한 상품을 먼저 게시하세요." });
      }
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 공개 상품 목록을 불러오지 못했습니다." });
    } finally {
      setRunning(null);
    }
  }, [password]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadProducts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadProducts, refreshToken]);

  async function generateKit() {
    if (!selectedProductId) {
      setNotice({ type: "error", message: "배포할 공개 상품을 선택하세요." });
      return;
    }
    setRunning("kit");
    setKit(null);
    setNotice({ type: "info", message: "상품별 상세 링크와 채널별 원고를 만드는 중입니다." });
    try {
      const response = await fetch(`/api/admin/content-kit?product_id=${encodeURIComponent(selectedProductId)}`, { headers: headers(password), cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok || !data.kit) {
        const details = data.blockers?.length ? ` 보강 필요: ${data.blockers.join(", ")}` : "";
        setNotice({ type: "error", message: `${data.message ?? data.error ?? "배포 원고를 만들지 못했습니다."}${details}` });
        return;
      }
      setKit(data.kit);
      setNotice({ type: "success", message: "상품별 텔레그램·네이버 블로그 원고를 확인했습니다." });
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 배포 원고를 만들지 못했습니다." });
    } finally {
      setRunning(null);
    }
  }

  async function copyText(value: string, label: string) {
    setRunning("copy");
    try {
      await navigator.clipboard.writeText(value);
      setNotice({ type: "success", message: `${label}을 복사했습니다.` });
    } catch {
      setNotice({ type: "error", message: `${label}을 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인하세요.` });
    } finally {
      setRunning(null);
    }
  }

  async function sendTelegram() {
    if (!kit) return;
    setRunning("send");
    setNotice({ type: "info", message: "확인한 상품 원고를 텔레그램으로 발송 중입니다." });
    try {
      const response = await fetch("/api/admin/telegram", {
        method: "POST",
        headers: headers(password),
        body: JSON.stringify({ productId: kit.productId, mode: "send" })
      });
      const data = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "텔레그램 발송에 실패했습니다." });
        return;
      }
      setNotice({
        type: data.status === "sent" ? "success" : "info",
        message:
          data.status === "sent"
            ? "상품별 텔레그램 발송이 완료되었습니다."
            : "텔레그램 설정 전입니다. 원고를 복사해 등록 채널에 수동 게시할 수 있습니다."
      });
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 텔레그램 발송을 완료하지 못했습니다." });
    } finally {
      setRunning(null);
    }
  }

  const channel = kit?.[activeChannel];

  return (
    <section id="admin-product-distribution" className="scroll-mt-6 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-pine">
            <Megaphone size={18} aria-hidden />
            <p className="text-xs font-black">공개 딜 유입 확장</p>
          </div>
          <h2 className="mt-1 text-lg font-black">상품별 채널 배포 키트</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-steel">
            공개 품질을 통과한 상품을 골라 상세 페이지로 연결되는 텔레그램·네이버 블로그 원고를 만듭니다. 쿠팡 직링크를 숨기지 않고, 제휴 고지와 가격 변동 안내를 원고에 함께 넣습니다.
          </p>
        </div>
        <Link className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-black hover:bg-mist" href="#admin-candidate-review">
          공개 상품 검토 <ExternalLink size={15} aria-hidden />
        </Link>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
        <label className="text-sm font-bold text-steel">
          배포할 공개 상품
          <select
            className="focus-ring mt-1 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm font-bold text-ink"
            value={selectedProductId}
            onChange={(event) => {
              setSelectedProductId(event.target.value);
              setKit(null);
            }}
          >
            <option value="">상품을 선택하세요</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {(product.latest_score?.total_score ?? "-") + "점 · " + product.title}
              </option>
            ))}
          </select>
        </label>
        <button className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-pine px-4 text-sm font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60" disabled={running !== null || !selectedProductId} onClick={() => void generateKit()} type="button">
          <RefreshCw size={16} aria-hidden /> {running === "kit" ? "생성 중" : "배포 키트 생성"}
        </button>
        <button className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-black hover:bg-mist disabled:cursor-not-allowed disabled:opacity-60" disabled={running !== null} onClick={() => void loadProducts()} type="button">
          <RefreshCw size={16} aria-hidden /> 새로고침
        </button>
      </div>

      {notice ? (
        <p className={`mt-3 rounded-lg border px-3 py-2 text-sm font-bold ${noticeClassName(notice.type)}`} role="status" aria-live="polite">
          {notice.message}
        </p>
      ) : null}

      {kit && channel ? (
        <div className="mt-5 border-t border-line pt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black text-pine">{kit.categoryLabel} · {kit.priceLabel} {kit.priceText}</p>
              <p className="mt-1 text-sm font-black text-ink">{kit.productName}</p>
              <p className="mt-1 text-xs font-bold text-steel">{kit.returnEvidenceLabel} · {kit.verdict} · {kit.score ?? "확인필요"}점</p>
            </div>
            <Link className="focus-ring inline-flex items-center gap-2 text-sm font-black text-pine hover:text-ink" href={kit.publicUrl} target="_blank" rel="noopener noreferrer">
              공개 상세 보기 <ExternalLink size={15} aria-hidden />
            </Link>
          </div>

          <div className="mt-4 inline-flex rounded-lg border border-line bg-mist p-1" role="tablist" aria-label="상품 배포 채널">
            <button className={`focus-ring inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-black ${activeChannel === "telegram" ? "bg-white text-ink shadow-sm" : "text-steel"}`} onClick={() => setActiveChannel("telegram")} role="tab" aria-selected={activeChannel === "telegram"} type="button">
              <MessageCircle size={16} aria-hidden /> 텔레그램
            </button>
            <button className={`focus-ring inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-black ${activeChannel === "naverBlog" ? "bg-white text-ink shadow-sm" : "text-steel"}`} onClick={() => setActiveChannel("naverBlog")} role="tab" aria-selected={activeChannel === "naverBlog"} type="button">
              <FileText size={16} aria-hidden /> 네이버 블로그
            </button>
          </div>

          {activeChannel === "telegram" ? (
            <div className="mt-4" role="tabpanel">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black">텔레그램 원고</p>
                <div className="flex flex-wrap gap-2">
                  <button className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-black hover:bg-mist disabled:opacity-60" disabled={running !== null} onClick={() => copyText(kit.telegram.message, "텔레그램 원고")} type="button">
                    <Copy size={15} aria-hidden /> 원고 복사
                  </button>
                  <button className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-sm font-black text-white hover:bg-pine disabled:opacity-60" disabled={running !== null} onClick={() => void sendTelegram()} type="button">
                    <Send size={15} aria-hidden /> {running === "send" ? "발송 중" : "확인 후 채널 발송"}
                  </button>
                </div>
              </div>
              <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap bg-ink p-4 text-sm leading-6 text-white">{kit.telegram.message}</pre>
              <p className="mt-2 break-all text-xs font-semibold text-steel">추적 링크: {kit.telegram.trackedUrl}</p>
            </div>
          ) : (
            <div className="mt-4" role="tabpanel">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                <div className="min-w-0">
                  <p className="text-xs font-black text-steel">네이버 블로그 제목</p>
                  <p className="mt-1 break-words text-sm font-black">{kit.naverBlog.title}</p>
                </div>
                <button className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-black hover:bg-mist disabled:opacity-60" disabled={running !== null} onClick={() => copyText(kit.naverBlog.title, "블로그 제목")} type="button">
                  <Copy size={15} aria-hidden /> 제목 복사
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black">네이버 블로그 원고</p>
                <div className="flex flex-wrap gap-2">
                  <button className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-black hover:bg-mist disabled:opacity-60" disabled={running !== null} onClick={() => copyText(kit.naverBlog.body, "블로그 본문")} type="button">
                    <Copy size={15} aria-hidden /> 본문 복사
                  </button>
                  <a className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-black hover:bg-mist" href={kit.naverBlog.publisherUrl} target="_blank" rel="noopener noreferrer">
                    등록 채널 열기 <ExternalLink size={15} aria-hidden />
                  </a>
                </div>
              </div>
              <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap bg-mist p-4 text-sm leading-6 text-ink">{kit.naverBlog.body}</pre>
              <p className="mt-2 break-all text-xs font-semibold text-steel">추적 링크: {kit.naverBlog.trackedUrl}</p>
            </div>
          )}

          <div className="mt-3 rounded-lg border border-pine/20 bg-pine/5 p-3">
            <p className="text-[11px] font-black text-pine">제휴 안내</p>
            <p className="mt-1 text-xs font-bold leading-5 text-ink">{kit.disclosure}</p>
          </div>
        </div>
      ) : products.length === 0 ? (
        <p className="mt-5 border-y border-line py-5 text-sm font-bold leading-6 text-steel">
          공개 상품이 생기면 여기서 상품별 원고를 만들 수 있습니다. 먼저 <Link className="text-pine underline" href="#admin-candidate-review">후보 검토</Link>에서 실제 상품을 승인·게시하세요.
        </p>
      ) : null}
    </section>
  );
}
